import { scrapeDiscordWeb } from "@dsale/scraper/src/index";
import type Discord from "@dsale/scraper/src/types/discord";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { Builds } from "../models/builds";
import { scrapeBuildWithWorker } from "../scraper";
import { Routes } from "./builds.openapi";

const app = new OpenAPIHono();

// @ts-expect-error Paginator types don't detect customLabels
// docs -> builds, totalDocs -> totalBuilds
app.openapi(Routes.root, async (c) => {
	const { page, limit, sort_by, sort_direction } = c.req.valid("query");

	const aggregate = Builds.aggregate([
		{
			$project: {
				_id: 0,
				build_hash: 1,
				build_number: 1,
				build_date: 1,
				release_channels: 1,
				environment: 1,
				db_created_at: 1,
				db_updated_at: 1,
				files: { $size: "$files" },
				experiments: { $size: "$experiments" },
			},
		},
	]);

	const result = await Builds.aggregatePaginate(aggregate, {
		page,
		limit,
		sort: {
			[sort_by]: sort_direction,
		},
		customLabels: { docs: "builds", totalDocs: "totalBuilds" },
	});

	return c.json(result);
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

		const result = await scrapeBuildWithWorker(release_channel as any).catch(
			console.error,
		);

		scraping[release_channel] = false;

		if (!result?.build_hash) {
			return c.json({
				status: "build_failed",
				message: "Failed to scrape build",
			});
		}

		return c.redirect(`/api/builds/${result.build_hash}`);
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
