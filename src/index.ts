import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import mongoose from "mongoose";
import { Routes } from "./routes";

const { MONGO_USER, MONGO_PASS, MONGO_DB } = process.env;
const mongoUrl = `mongodb://${MONGO_USER}:${MONGO_PASS}@mongo:27017/${MONGO_DB}?authSource=admin`;

mongoose.connect(mongoUrl, {
	authSource: "admin",
});

const app = new OpenAPIHono({ strict: false });

app.doc("/openapi.json", {
	openapi: "3.0.0",
	info: {
		version: "0.0.1-beta.1",
		title: "Discord Build Logger API",
	},
});

app.get("/openapi", swaggerUI({ url: "/openapi.json" }));

app.get("/", (c) =>
	c.json({
		meow: true,
		discord: "https://discord.gg/r5bmSXBEPC",
		docs: "/openapi",
	}),
);

app.route("/builds", Routes.Builds);

export default app;
