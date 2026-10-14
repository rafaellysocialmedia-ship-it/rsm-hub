import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Instagram staging Cron Worker is isolated, private and disabled without opt-in", async () => {
  const worker = JSON.parse(await readFile(new URL("../wrangler.instagram-publisher.staging.json",import.meta.url),"utf8"));
  assert.equal(worker.name,"rsm-instagram-publisher-staging");
  assert.equal(worker.main,"workers/instagram-publisher-staging.mjs");
  assert.equal(worker.workers_dev,false);
  assert.equal(worker.preview_urls,false);
  assert.deepEqual(worker.triggers.crons,["* * * * *"]);
  assert.equal(worker.vars.SUPABASE_URL,"https://dtladsjhmnzdxcmgivne.supabase.co");
  assert.equal(worker.vars.RSM_ENVIRONMENT,"staging");
  assert.equal(Object.hasOwn(worker.vars,"RSM_PUBLISH_ENABLED"),false);
  assert.equal(worker.keep_vars,true);
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY","INSTAGRAM_TOKEN_ENCRYPTION_KEY","INSTAGRAM_APP_SECRET"])
    assert.equal(Object.hasOwn(worker.vars,key),false, key+" must never be a plaintext Worker variable");
});
