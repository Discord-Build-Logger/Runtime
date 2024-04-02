import type DiscordWebScraper from "@dsale/scraper/src/app/discord_web";
import type Discord from "@dsale/scraper/src/types/discord";

export enum WorkerEvent {
	BuildRootGrabbed,
	BuildScrapeSuccess,
	BuildScrapeFail,
	Timeout,
}

export interface InputMessageData {
	event_type: "start" | "scrape";
	release_channel: Discord.ReleaseChannel;
}

export interface OutputMessageData {
	event: WorkerEvent;
	reason?: string;
	build_hash?: string;
	build?: DiscordWebScraper["build"];
}
