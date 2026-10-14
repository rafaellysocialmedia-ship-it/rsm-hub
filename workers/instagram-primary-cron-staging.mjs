// Scheduled event handler for the EXISTING OAuth staging Worker.
// Its Cloudflare Secrets remain in the same Worker; never export or copy them.
import publisher from "./instagram-publisher-staging.mjs";

const STAGING_SUPABASE_URL = "https://dtladsjhmnzdxcmgivne.supabase.co";

// Both opt-ins are absent by default. For now every cron invocation is a no-op.
// The publisher enforces additional staging/credentials checks internally.
export function scheduledStagingInstagram(event, env, ctx) {
  if (
    env?.RSM_ENVIRONMENT !== "staging" ||
    env.SUPABASE_URL !== STAGING_SUPABASE_URL ||
    env.RSM_PUBLISH_ENABLED !== "true" ||
    env.RSM_PRIMARY_PUBLISH_ENABLED !== "true"
  ) return;
  return publisher.scheduled(event, env, ctx);
}
