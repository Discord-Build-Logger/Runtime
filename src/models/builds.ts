import { Discord } from "@dsale/scraper/src/types/discord";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BuildSchema = new Schema({
	build_hash: {
		type: String,
		required: true,
		unique: true,
		index: true,
	},
	build_number: Number,
	build_date: Date,
	release_channels: {
		[Discord.ReleaseChannel.stable as string]: Date,
		[Discord.ReleaseChannel.ptb as string]: Date,
		[Discord.ReleaseChannel.canary as string]: Date,
		[Discord.ReleaseChannel.staging as string]: Date,
	},
	environment: {
		type: String,
		enum: Discord.Environment,
	},
	GLOBAL_ENV: Object,
	files: [
		{
			_id: false,
			path: String,
			tags: [String],
		},
	],
	experiments: [Object],
	plugins: Object,
	db_created_at: {
		type: Date,
		default: Date.now,
	},
	db_updated_at: {
		type: Date,
		default: Date.now,
	},
});

BuildSchema.set("toJSON", {
	versionKey: false,
	transform: (_doc, ret) => {
		ret._id = undefined;
	},
});

type BuildDocument = InferSchemaType<typeof BuildSchema>;

export const Builds = mongoose.model<BuildDocument>("Build", BuildSchema);
