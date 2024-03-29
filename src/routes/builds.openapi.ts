import Discord from "@dsale/scraper/types/discord";
import { createRoute, z } from "@hono/zod-openapi";

export const zBuildSchema = ({ with_files = true, with_experiments = true }) =>
	z.object({
		build_hash: z.string(),
		build_number: z.number(),
		build_date: z.date(),
		release_channels: z
			.object({
				stable: z.date(),
				ptb: z.date(),
				canary: z.date(),
				staging: z.date(),
			})
			.partial(),
		environment: z.enum([
			Discord.Environment.production,
			Discord.Environment.development,
		]),
		GLOBAL_ENV: z.record(z.any()),
		files: with_files
			? z.array(
					z.object({
						path: z.string(),
						tags: z.array(z.string()),
					}),
				)
			: z.number(),
		experiments: with_experiments ? z.array(z.record(z.any())) : z.number(),
		plugins: z.record(z.any()),
		db_created_at: z.date(),
		db_updated_at: z.date(),
	});

export const zBuildPaginatorSchema = z.object({
	builds: zBuildSchema({
		with_experiments: false,
		with_files: false,
	}),
	totalBuilds: z.number(),
	limit: z.number(),
	hasPrevPage: z.boolean(),
	hasNextPage: z.boolean(),
	page: z.number().optional(),
	totalPages: z.number(),
	offset: z.number(),
	prevPage: z.number().optional().nullable(),
	nextPage: z.number().optional().nullable(),
	pagingCounter: z.number(),
	meta: z.any().optional(),
});

export const Routes = {
	root: createRoute({
		method: "get",
		path: "/",
		request: {
			query: z.object({
				page: z.number({ coerce: true }).min(1).default(1),
				limit: z.number({ coerce: true }).min(1).max(100).default(50),
				sort_by: z
					.enum([
						"build_number",
						"build_date",
						"db_created_at",
						"db_updated_at",
					])
					.default("build_date"),
				sort_direction: z.enum(["asc", "desc"]).default("desc"),
			}),
		},
		responses: {
			200: {
				description: "List of builds.",
				content: {
					"application/json": {
						schema: zBuildPaginatorSchema,
					},
				},
			},
		},
	}),

	getBuild: createRoute({
		method: "get",
		path: "/{build_hash}",
		request: {
			params: z.object({
				build_hash: z.string(),
			}),
		},
		responses: {
			200: {
				description: "Build information.",
				content: {
					"application/json": {
						schema: zBuildSchema({
							with_experiments: true,
							with_files: true,
						}),
					},
				},
			},
			404: {
				description: "Build not found.",
			},
		},
	}),
};
