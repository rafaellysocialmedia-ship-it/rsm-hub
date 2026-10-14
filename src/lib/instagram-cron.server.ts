// Cron handler runs only inside the existing isolated OAuth staging Worker.
// Keep the original INSTAGRAM_TOKEN_ENCRYPTION_KEY in Cloudflare; never export it.
// @ts-ignore: Standalone Cloudflare .mjs Worker has no generated TypeScript declaration.
import publisher from "../../workers/instagram-publisher-staging.mjs";

const STAGING_SUPABASE_URL = "https://dtladsjhmnzdxcmgivne.supabase.co";

export type StagingCronEnv = Record<string, string | undefined>;
export type StagingCronContext = { waitUntil(promise: Promise<unknown>): void };

/**
 * Two explicit opt-in switches are required; neither belongs in Wrangler vars.
 * Until BOTH have been enabled deliberately after testing, the cron does nothing.
 * This gate is in addition to the publisher's own staging-only checks.
 */
export function handleInstagramCron(
  event: unknown,
  env: StagingCronEnv | null | undefined,
  ctx: StagingCronContext,
): void {
  if (
    env?.RSM_ENVIRONMENT !== "staging" ||
    env.SUPABASE_URL !== STAGING_SUPABASE_URL ||
    env.RSM_PUBLISH_ENABLED !== "true" ||
    env.RSM_PRIMARY_PUBLISH_ENABLED !== "true"
  ) return;
  publisher.scheduled(event, env, ctx);
}
