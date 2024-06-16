import type Discord from "@dsale/scraper/src/types/discord";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { Builds } from "../models/builds";
// import { scrapeBuildWithWorker } from "../scraper";
import { Routes } from "./builds.openapi";
import { scrapeBuildToDB } from "./builds.utils";
import { scrapeDiscordWeb } from "@dsale/scraper/src";
import type DiscordWebScraper from "@dsale/scraper/src/app/discord_web";

const app = new OpenAPIHono();

// docs -> builds, totalDocs -> totalBuilds
app.openapi(Routes.root, async (c) => {
	const { page, limit, sort_by, sort_direction } = c.req.valid("query");

	const builds = await Builds.find(
		{},
		{
			_id: 0,
			build_hash: 1,
			build_number: 1,
			build_date: 1,
			release_channels: 1,
			environment: 1,
			db_created_at: 1,
			db_updated_at: 1,
			files_count: { $size: "$files" },
			experiments_count: { $size: "$experiments" },
		},
	)
		.limit(limit)
		.skip((page - 1) * limit)
		.sort({ [sort_by]: sort_direction });

	const totalBuilds = await Builds.countDocuments();

	const totalPages = Math.ceil(totalBuilds / limit);
	const hasPrevPage = page > 1;
	const hasNextPage = page < totalPages;

	return c.json({
		builds,
		totalBuilds,
		limit,
		page,
		totalPages,
		hasPrevPage,
		hasNextPage,
		prevPage: hasPrevPage ? page - 1 : null,
		nextPage: hasNextPage ? page + 1 : null,
	}) as any;
});

const ScrapeParams = z.object({
	release_channel: z.enum(["stable", "ptb", "canary"]).default("canary"),
	authorization: z.string().optional(),
});

const ScrapeAuth = z.object({
	Authorization: z.string().optional(),
});

const scraping: Record<Discord.ReleaseChannel, boolean> = {
	staging: false,
	canary: false,
	ptb: false,
	stable: false,
} as const;

app.get(
	"/scrape",
	zValidator("query", ScrapeParams),
	zValidator("header", ScrapeAuth),
	async (c) => {
		const authorization =
			c.req.valid("header").Authorization || c.req.valid("query").authorization;

		if (!authorization || authorization !== process.env.API_ACCESS_KEY) {
			return c.text("Unauthorized", 401);
		}

		const { release_channel } = c.req.valid("query");

		if (scraping[release_channel]) {
			return c.text("Already scraping. Please check back soon.", 409);
		}

		scraping[release_channel] = true;

		// const result = await scrapeBuildWithWorker(release_channel as any).catch(
		// 	console.error,
		// );

		let build!: DiscordWebScraper;

		try {
			build = await scrapeDiscordWeb(release_channel as any);
			if (!build?.build?.build_hash) {
				return c.json({
					status: "build_failed",
					message: "Failed to scrapeDiscordWeb",
				});
			}
			await scrapeBuildToDB(build, release_channel as any);
			scraping[release_channel] = false;
		} catch (e) {
			console.error(e);
			scraping[release_channel] = false;
		}

		scraping[release_channel] = false;

		if (!build?.build?.build_hash) {
			return c.json({
				status: "build_failed",
				message: "No build hash found",
			});
		}

		return c.redirect(`/api/builds/${build.build.build_hash}`);
	},
);

app.openapi(Routes.getBuild, async (c) => {
	const { build_hash } = c.req.valid("param");
	const build = await Builds.findOne({
		build_hash: build_hash,
	});

	if (!build) {
		return c.text("Build not found", 404);
	}

	return c.json(build);
});

export default app;
