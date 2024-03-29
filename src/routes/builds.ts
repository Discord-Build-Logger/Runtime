import { scrapeDiscordWeb } from "@dsale/scraper";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { Builds } from "../models/builds";
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
	force: z.boolean({ coerce: true }).default(false),
	release_channel: z.enum(["stable", "ptb", "canary"]).default("canary"),
	no_redirect: z.boolean({ coerce: true }).default(false),
});

let scraping = false;
app.get("/scrape", zValidator("query", ScrapeParams), async (c) => {
	if (scraping) {
		return c.text("Already scraping. Please check back soon.", 409);
	}

	scraping = true;

	const { force, release_channel, no_redirect } = c.req.valid("query");
	const build = await scrapeDiscordWeb(release_channel);

	try {
		if (!force) {
			const existingBuild = await Builds.findOne({
				build_hash: build.build.build_hash,
			});

			if (existingBuild) {
				scraping = false;
				return c.redirect(`/builds/${build.build.build_hash}`);
			}
		}

		await build.beginScrapingFiles();

		await Builds.updateOne(
			{
				build_hash: build.build.build_hash,
			},
			{
				$set: build.build,
			},
			{
				upsert: true,
			},
		);
	} catch (e) {
		scraping = false;
		throw e;
	}

	scraping = false;

	if (no_redirect) {
		return c.json(build.build);
	}
	return c.redirect(`/builds/${build.build.build_hash}`);
});

/**
 * This needs to run last because it's a wildcard route.
 */
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
