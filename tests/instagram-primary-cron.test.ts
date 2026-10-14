import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// @ts-ignore: Cloudflare staging handler intentionally ships as an ESM module.
import { scheduledStagingInstagram } from "../workers/instagram-primary-cron-staging.mjs";

const isolated = "https://dtladsjhmnzdxcmgivne.supabase.co";
const base = {
  RSM_ENVIRONMENT: "staging",
  SUPABASE_URL: isolated,
  RSM_PUBLISH_ENABLED: "true",
  RSM_PRIMARY_PUBLISH_ENABLED: "true",
};

test("existing OAuth Worker cron does nothing by default or if any safety gate fails", () => {
  let scheduled = 0;
  const ctx = { waitUntil(_p: Promise<unknown>) { scheduled++; } };
  const disabled = [
    {},
    { ...base, RSM_PUBLISH_ENABLED: undefined },
    { ...base, RSM_PRIMARY_PUBLISH_ENABLED: undefined },
    { ...base, RSM_PUBLISH_ENABLED: "false" },
    { ...base, RSM_PRIMARY_PUBLISH_ENABLED: "false" },
    { ...base, RSM_ENVIRONMENT: "production" },
    { ...base, SUPABASE_URL: "https://zttgcamgixlkbkbdvrtb.supabase.co" },
    { ...base, SUPABASE_URL: "https://example.supabase.co" },
  ];
  for (const env of disabled) scheduledStagingInstagram({}, env, ctx);
  assert.equal(scheduled, 0);
});

test("even after explicit double opt-in, missing encryption secret prevents any publication", async () => {
  let requested = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { requested++; throw Error("must never call upstream"); };
  let pending: Promise<unknown> | undefined;
  try {
    scheduledStagingInstagram({}, {
      ...base,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      // Existing Cloudflare encryption secret deliberately unavailable here.
    }, { waitUntil(p) { pending = p; } });
    assert.ok(pending, "both gates should forward the scheduled event");
    await assert.rejects(pending, /staging_configuration_invalid/);
    assert.equal(requested, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("staging configuration never embeds either publishing switch or the encryption key", async () => {
  const content = await readFile(new URL("../scripts/staging-config.mjs", import.meta.url), "utf8");
  assert.ok(content.includes('triggers: { crons: ["* * * * *"] }'));
  assert.ok(!content.includes("RSM_PRIMARY_PUBLISH_ENABLED"));
  assert.ok(!content.includes("RSM_PUBLISH_ENABLED"));
  assert.ok(!content.includes("INSTAGRAM_TOKEN_ENCRYPTION_KEY"));
});
