import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import mongoose from "mongoose";
import { Routes } from "./routes";

const { MONGO_HOST, MONGO_USER, MONGO_PASS, MONGO_DB } = process.env;
const mongoUrl = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${MONGO_DB}?authSource=admin`;

mongoose.connect(mongoUrl, {
	authSource: "admin",
});

const app = new OpenAPIHono({ strict: false });

app.doc("/api/openapi.json", {
	openapi: "3.0.0",
	info: {
		version: "0.0.1-beta.1",
		title: "Discord Build Logger API",
	},
});

app.get("/api/openapi", swaggerUI({ url: "/api/openapi.json" }));

app.get("/api", (c) =>
	c.json({
		meow: true,
		discord: "https://discord.gg/r5bmSXBEPC",
		docs: "/api/openapi",
	}),
);

app.route("/api/builds", Routes.Builds);

export default app;
