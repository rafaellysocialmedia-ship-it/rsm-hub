// This adapter is installed ONLY by scripts/build-staging.mjs.
// Nitro owns the generated index.js fetch handler. Keep it unchanged.
import siteWorker from "./index.js";
import { scheduledStagingInstagram } from "./instagram-primary-cron-staging.mjs";

if (!siteWorker || typeof siteWorker.fetch !== "function") {
  throw new Error("staging_web_worker_entry_invalid");
}

export default {
  // Preserve the existing TanStack/Nitro request handling and Cloudflare bindings.
  fetch(request, env, ctx) {
    return siteWorker.fetch(request, env, ctx);
  },
  // Cron runs with the SAME env (and Secrets) as the OAuth Worker.
  scheduled(event, env, ctx) {
    return scheduledStagingInstagram(event, env, ctx);
  },
};
