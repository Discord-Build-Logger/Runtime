import { Discord } from "@dsale/scraper/types/discord";
import mongoose, { Schema, type InferSchemaType } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

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
		[Discord.ReleaseChannel.stable]: Date,
		[Discord.ReleaseChannel.ptb]: Date,
		[Discord.ReleaseChannel.canary]: Date,
		[Discord.ReleaseChannel.staging]: Date,
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

BuildSchema.plugin(aggregatePaginate);

BuildSchema.set("toJSON", {
	versionKey: false,
	transform: (_doc, ret) => {
		ret._id = undefined;
	},
});

type BuildDocument = InferSchemaType<typeof BuildSchema>;

export const Builds = mongoose.model<
	BuildDocument,
	mongoose.AggregatePaginateModel<BuildDocument>
>("Build", BuildSchema);
