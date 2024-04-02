import type DiscordWebScraper from "@dsale/scraper/src/app/discord_web";
import { scrapeDiscordWeb } from "@dsale/scraper/src/index";
import type Discord from "@dsale/scraper/src/types/discord";
import {
	type InputMessageData,
	type OutputMessageData,
	WorkerEvent,
} from "./worker.types";

let build: DiscordWebScraper;

if (!process.send) {
	throw new Error("No IPC channel found. Don't run this file directly.");
}

process.on("message", (event: InputMessageData) => {
	switch (event.event_type) {
		case "start":
			start(event.release_channel);
			break;
		case "scrape":
			scrape();
			break;
	}
});

async function start(release_channel: Discord.ReleaseChannel) {
	build = await scrapeDiscordWeb(release_channel);

	if (!build.build?.build_hash) {
		process.send!(<OutputMessageData>{
			event: WorkerEvent.BuildScrapeFail,
			reason: "No build hash found",
		});
		return;
	}

	process.send!(<OutputMessageData>{
		event: WorkerEvent.BuildRootGrabbed,
		build_hash: build.build.build_hash,
	});
}

async function scrape() {
	if (!build) {
		process.send!(<OutputMessageData>{
			event: WorkerEvent.BuildScrapeFail,
			reason: "No build root found",
		});
	}

	await build
		.beginScrapingFiles()
		.then(() => {
			process.send!(<OutputMessageData>{
				event: WorkerEvent.BuildScrapeSuccess,
				build_hash: build.build.build_hash,
				build: build.build,
			});
		})
		.catch(() => {
			process.send!(<OutputMessageData>{
				event: WorkerEvent.BuildScrapeFail,
				reason: "Failed to scrape files",
			});
		});
}
