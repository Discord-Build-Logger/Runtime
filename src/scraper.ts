import type Discord from "@dsale/scraper/src/types/discord";
import type { Subprocess } from "bun";
import { Builds } from "./models/builds";
import {
	type InputMessageData,
	type OutputMessageData,
	WorkerEvent,
} from "./worker.types";

export interface ScrapeBuildResponse {
	status: "build_success" | "build_failed";
	build_hash?: string;
}

const exec_command = import.meta.file.endsWith(".js")
	? "exec:scraper-dist"
	: "exec:scraper-dev";

export async function scrapeBuildWithWorker(
	release_channel: Discord.ReleaseChannel,
): Promise<ScrapeBuildResponse> {
	let worker: Subprocess<"ignore", "pipe", "inherit">;
	const result: ScrapeBuildResponse = await new Promise((resolve, reject) => {
		worker = Bun.spawn(["bun", "run", exec_command], {
			async ipc(event: any) {
				const result = await handler(event, release_channel);
				if (result.status === "build_success") {
					resolve(<ScrapeBuildResponse>{
						status: "build_success",
						build_hash: result.build_hash,
					});
				} else if (result.status === "build_failed") {
					reject({
						status: "build_failed",
						message: result.message,
					});
				} else if (result.status === "request_scrape") {
					worker.send(<InputMessageData>{
						event_type: "scrape",
					});
				}
			},
		});

		worker.send(<InputMessageData>{
			event_type: "start",
			release_channel,
		});

		setTimeout(() => {
			reject({
				status: "build_failed",
				message: "Timeout",
			});
		}, 30_000); // 30 seconds timeout
	});

	// @ts-expect-error ts is silly
	worker?.kill();

	return result;
}

interface HandlerResponse {
	status: "build_success" | "build_failed" | "request_scrape";
	build_hash?: string;
	message?: string;
}

async function handler(
	event: OutputMessageData,
	release_channel: Discord.ReleaseChannel,
): Promise<HandlerResponse> {
	switch (event.event) {
		case WorkerEvent.BuildRootGrabbed: {
			const buildExists = await Builds.findOne({
				build_hash: event.build_hash,
			});

			// If the build already exists
			if (buildExists?.build_hash) {
				// If the current release channel isn't logged
				if (!buildExists.release_channels?.canary) {
					await Builds.updateOne(
						{ build_hash: buildExists.build_hash },
						{
							$set: { [`release_channels.${release_channel}`]: new Date() },
						},
					);
				}
				return {
					status: "build_success",
					build_hash: event.build_hash,
				};
			}

			return {
				status: "request_scrape",
				build_hash: event.build_hash,
			};
		}

		case WorkerEvent.BuildScrapeSuccess: {
			await Builds.updateOne(
				{ build_hash: event.build_hash },
				{ $set: event.build },
				{ upsert: true },
			);

			return {
				status: "build_success",
				build_hash: event.build_hash,
			};
		}

		case WorkerEvent.BuildScrapeFail: {
			return {
				status: "build_failed",
				message: "Build scrape failed",
			};
		}

		case WorkerEvent.Timeout: {
			return {
				status: "build_failed",
				message: "Timeout",
			};
		}
	}
}
