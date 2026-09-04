import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const output = join(root, ".output");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "server"), { recursive: true });
await cp(join(output, "server"), join(dist, "server"), { recursive: true });
await rename(join(dist, "server", "index.mjs"), join(dist, "server", "index.js"));
await cp(join(output, "public"), join(dist, "client"), { recursive: true });

const wranglerPath = join(dist, "server", "wrangler.json");
const wrangler = JSON.parse(await readFile(wranglerPath, "utf8"));
wrangler.assets = { ...wrangler.assets, binding: "ASSETS", directory: "../client" };
await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`);

await mkdir(join(dist, ".openai"), { recursive: true });
await cp(join(root, ".openai", "hosting.json"), join(dist, ".openai", "hosting.json"));
