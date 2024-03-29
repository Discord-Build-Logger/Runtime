import type { DiscordWebScraper } from "@dsale/scraper/src/app/discord_web";
import type Discord from "@dsale/scraper/src/types/discord";
import { Builds } from "../models/builds";

export async function scrapeBuildToDB(
	scraper: DiscordWebScraper,
	release_channel: Discord.ReleaseChannel,
): Promise<DiscordWebScraper> {
	const existingBuild = await Builds.findOne({
		build_hash: scraper.build.build_hash,
	});

	if (existingBuild?.build_hash) {
		// If the build exists, we can add the new release channel entry.
		if (!existingBuild.release_channels?.[release_channel]) {
			await Builds.updateOne(
				{
					build_hash: existingBuild.build_hash,
				},
				{
					$set: {
						[`release_channels.${release_channel}`]: scraper.build.build_date,
					},
				},
			);
		}

		return scraper;
	}

	await scraper.beginScrapingFiles();

	await Builds.updateOne(
		{
			build_hash: scraper.build.build_hash,
		},
		{
			$set: scraper.build,
		},
		{
			upsert: true,
		},
	);

	return scraper;
}
