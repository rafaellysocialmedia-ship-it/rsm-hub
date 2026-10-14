// Dedicated Cloudflare Cron Worker for isolated staging Instagram Feed publishing.
// No HTTP API. No user-controlled URL. No automatic retry after an uncertain publish.
const STAGING_DB = "https://dtladsjhmnzdxcmgivne.supabase.co";
const GRAPH = "https://graph.instagram.com/v24.0";
const UUID = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;


function configured(env) {
  if (env.RSM_ENVIRONMENT !== "staging" || env.RSM_PUBLISH_ENABLED !== "true")
    return false;
  if (env.SUPABASE_URL !== STAGING_DB || !env.SUPABASE_SERVICE_ROLE_KEY || !env.INSTAGRAM_TOKEN_ENCRYPTION_KEY)
    throw new Error("staging_configuration_invalid");
  return true;
}
function serviceHeaders(env, extra = {}) {
  return { apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra };
}
async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    redirect: "manual", signal: AbortSignal.timeout(20000), ...options,
  });
  if (response.status >= 300 && response.status < 400) throw new Error("redirect_refused");
  if (!response.ok) throw new Error(response.status >= 500 ? "upstream_5xx" : "upstream_4xx");
  return response.json();
}
async function dbRpc(env, method, body = {}) {
  return jsonFetch(`${STAGING_DB}/rest/v1/rpc/${method}`, {
    method: "POST", headers: serviceHeaders(env, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}
async function patchJob(env, jobId, previous, patch) {
  const url = new URL(`${STAGING_DB}/rest/v1/instagram_publish_jobs`);
  url.searchParams.set("id", `eq.${jobId}`);
  url.searchParams.set("status", `eq.${previous}`);
  const rows = await jsonFetch(url, {
    method: "PATCH", headers: serviceHeaders(env, {
      "Content-Type": "application/json", Prefer: "return=representation",
    }), body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("job_conflict");
}
async function decrypt(json, base64) {
  const payload = JSON.parse(json);
  if (payload.version !== 1 || !payload.iv || !payload.data) throw new Error("token_format");
  const decode = input => Uint8Array.from(atob(input), x => x.charCodeAt(0));
  const bytes = decode(base64);
  if (bytes.length !== 32) throw new Error("key_invalid");
  const key = await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(payload.iv) }, key, decode(payload.data));
  return new TextDecoder().decode(raw);
}
function plainCaption(html) {
  // Stored RichTextEditor captions are HTML. Treat as text, never feed HTML to IG.
  return String(html || "")
    .replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .trim().slice(0, 2200);
}
async function mediaSignedUrl(env, storagePath) {
  if (typeof storagePath !== "string" || storagePath.includes("..") || storagePath.startsWith("/"))
    throw new Error("media_path");
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  const signed = await jsonFetch(`${STAGING_DB}/storage/v1/object/sign/post-files/${encoded}`, {
    method: "POST", headers: serviceHeaders(env, { "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!signed.signedURL || typeof signed.signedURL !== "string") throw new Error("sign_failed");
  const raw = signed.signedURL;
  const path = raw.startsWith("https://") ? raw
    : raw.startsWith("/storage/v1/") ? raw
    : `/storage/v1/${raw.replace(/^\\/+/, "")}`;
  const url = new URL(path, STAGING_DB);
  if (url.origin !== STAGING_DB || !url.pathname.startsWith("/storage/v1/object/sign/post-files/"))
    throw new Error("signed_url_untrusted");
  return url.toString();
}
async function graphPost(path, token, values) {
  return jsonFetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...values, access_token: token }),
  });
}
async function graphStatus(containerId, token) {
  if (!/^\d+$/.test(containerId)) throw new Error("container_id");
  return jsonFetch(`${GRAPH}/${containerId}?fields=status_code`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
async function finalizePost(env, job) {
  // Mixed-network posts remain scheduled editorially for other networks.
  const url = new URL(`${STAGING_DB}/rest/v1/posts`);
  url.searchParams.set("id", `eq.${job.post_id}`);
  url.searchParams.set("status", "eq.scheduled");
  const rows = await jsonFetch(url, {
    method: "GET",
    headers: serviceHeaders(env, { Accept: "application/json" }),
  });
  if (!Array.isArray(rows) || rows.length !== 1) return;
  const list = rows[0].social_networks || [];
  if (list.length > 1 || (list.length === 0 && rows[0].social_network !== "Instagram")) return;
  // Publishing is confirmed only after Meta has returned a media ID.
  const update = new URL(`${STAGING_DB}/rest/v1/posts`);
  update.searchParams.set("id", `eq.${job.post_id}`);
  update.searchParams.set("status", "eq.scheduled");
  await jsonFetch(update, { method: "PATCH",
    headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ status: "published", publication_source: "instagram_api",
      publication_confirmed_at: new Date().toISOString() }),
  });
}
async function handleJob(env, job) {
  if (!UUID.test(job.job_id) || !UUID.test(job.post_id) || !/^\d+$/.test(job.instagram_user_id))
    throw new Error("invalid_job");
  let token;
  try {
    token = await decrypt(job.encrypted_access_token, env.INSTAGRAM_TOKEN_ENCRYPTION_KEY);
    if (job.phase === "create") {
      const image_url = await mediaSignedUrl(env, job.storage_path);
      const caption = plainCaption(job.caption);
      if (!caption) throw new Error("caption_required");
      const result = await graphPost(`${job.instagram_user_id}/media`, token, { image_url, caption });
      if (!/^\d+$/.test(String(result.id ?? ""))) throw new Error("container_missing");
      await patchJob(env, job.job_id, "processing", {
        status: "prepared", creation_id: String(result.id), lease_at: null,
        reason_code: null,
      });
      return;
    }
    if (job.phase !== "check") throw new Error("invalid_phase");
    const status = await graphStatus(job.creation_id, token);
    if (status.status_code === "IN_PROGRESS" || status.status_code === "PENDING") {
      await patchJob(env, job.job_id, "processing", { status: "prepared", lease_at: null, reason_code: null });
      return;
    }
    if (status.status_code !== "FINISHED") {
      await patchJob(env, job.job_id, "processing", { status: "failed", lease_at: null, reason_code: "instagram_container_failed" });
      return;
    }
    await patchJob(env, job.job_id, "processing", { status: "publishing", lease_at: new Date().toISOString() });
    try {
      const published = await graphPost(`${job.instagram_user_id}/media_publish`, token, { creation_id: job.creation_id });
      if (!/^\d+$/.test(String(published.id ?? ""))) throw new Error("publish_unconfirmed");
      await patchJob(env, job.job_id, "publishing", {
        status: "published",published_media_id: String(published.id),
        published_at: new Date().toISOString(),lease_at: null,reason_code: null,
      });
      await finalizePost(env, job);
    } catch {
      // Meta might have published just before a lost response. Never auto-retry.
      await patchJob(env, job.job_id, "publishing", {
        status: "uncertain", lease_at: null, reason_code: "publish_needs_manual_check",
      }).catch(() => {});
    }
  } catch {
    // Creating a container cannot publish a post. After publishing starts
    // failures are handled as uncertain above, never automatic duplicate.
    await patchJob(env,job.job_id,"processing", {
      status: "failed",lease_at: null,reason_code: "publish_preparation_failed",
    }).catch(() => {});
  }
}
async function run(env) {
  if (!configured(env)) return;
  for (let i=0;i<5;i++) {
    const jobs = await dbRpc(env,"claim_due_instagram_publish_job");
    if (!Array.isArray(jobs) || jobs.length===0) break;
    await handleJob(env,jobs[0]);
  }
}
export default {
  async fetch() { return new Response("Not found", { status: 404 }); },
  async scheduled(_event,env,ctx) { ctx.waitUntil(run(env)); },
};
