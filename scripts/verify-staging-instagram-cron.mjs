// Staging-only build artifact assertions. Never reads or prints Cloudflare secrets.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const server = join("dist", "server");
const read = name => readFile(join(server,name),"utf8");
const cfg = JSON.parse(await read("wrangler.staging.json"));

assert.equal(cfg.name, "rsm-hub-instagram-staging");
assert.equal(cfg.main, "instagram-primary-staging-entry.mjs");
assert.equal(cfg.keep_vars, true);
assert.equal(cfg.no_bundle, true);
assert.equal(cfg.vars.RSM_ENVIRONMENT, "staging");
assert.equal(cfg.vars.SUPABASE_URL, "https://dtladsjhmnzdxcmgivne.supabase.co");
assert.deepEqual(cfg.triggers, {crons:["* * * * *"]});
assert.deepEqual(cfg.routes, []);
for (const key of ["INSTAGRAM_TOKEN_ENCRYPTION_KEY","SUPABASE_SERVICE_ROLE_KEY","INSTAGRAM_APP_SECRET","RSM_PUBLISH_ENABLED","RSM_PRIMARY_PUBLISH_ENABLED"]) {
  assert.equal(Object.hasOwn(cfg.vars,key),false,key+" must not appear in plaintext Wrangler vars");
}
const index = await read("index.js");
assert.ok(index.length > 100,"Nitro web Worker must be present");
const entry = await read(cfg.main);
const cron = await read("instagram-primary-cron-staging.mjs");
const publisher = await read("instagram-publisher-staging.mjs");
assert.match(entry,/import siteWorker from ["']\.\/index\.js["']/);
assert.match(entry,/import \{ scheduledStagingInstagram \} from ["']\.\/instagram-primary-cron-staging\.mjs["']/);
assert.match(entry,/fetch\(request, env, ctx\)/);
assert.match(entry,/scheduled\(event, env, ctx\)/);
assert.match(cron,/RSM_PUBLISH_ENABLED !== "true"/);
assert.match(cron,/RSM_PRIMARY_PUBLISH_ENABLED !== "true"/);
assert.match(cron,/publisher\.scheduled\(event, env, ctx\)/);
assert.match(publisher,/env\.RSM_ENVIRONMENT !== "staging"/);
assert.match(publisher,/env\.RSM_PUBLISH_ENABLED !== "true"/);
assert.match(publisher,/INSTAGRAM_TOKEN_ENCRYPTION_KEY/);
console.log("PASS: staging Cron adapter, generated Worker entrypoint, isolation and double opt-in validated; no deployment");
