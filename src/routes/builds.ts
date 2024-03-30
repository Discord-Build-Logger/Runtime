import { scrapeDiscordWeb } from "@dsale/scraper/src/index";
import type Discord from "@dsale/scraper/src/types/discord";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { Builds } from "../models/builds";
import { Routes } from "./builds.openapi";
import { scrapeBuildToDB } from "./builds.utils";

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
	no_redirect: z.boolean({ coerce: true }).default(false),
	// TODO: https://github.com/colinhacks/zod/pull/2989
	wait: z
		.enum(["true", "false"])
		.default("true")
		.transform((v) => v !== "false"),
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
};

// let scraping = false;
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

		const { release_channel, no_redirect, wait } = c.req.valid("query");

		if (scraping[release_channel]) {
			return c.text("Already scraping. Please check back soon.", 409);
		}

		scraping[release_channel] = true;

		const build = await scrapeDiscordWeb(release_channel);

		try {
			const promise = scrapeBuildToDB(
				build,
				release_channel as Discord.ReleaseChannel,
			);
			if (!wait) {
				promise.catch(console.error).finally(() => {
					scraping[release_channel] = false;
				});

				return c.json({
					message: "Scraping started",
					build_hash: build.build.build_hash,
				});
			}

			await promise;

			scraping[release_channel] = false;
		} catch (e) {
			scraping[release_channel] = false;
			throw e;
		}

		scraping[release_channel] = false;

		if (no_redirect) {
			return c.json(build.build);
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
