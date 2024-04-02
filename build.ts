Bun.build({
	target: "bun",
	entrypoints: ["src/index.ts", "src/worker.ts"],
	outdir: "./dist",
});
