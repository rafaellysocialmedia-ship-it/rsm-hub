import { createClient } from "@supabase/supabase-js";

export const scopes = "instagram_business_basic,instagram_business_content_publish";
export const callbackPath = "/api/integrations/instagram/callback";
const required = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error("Instagram configuration unavailable");
  return value;
};
export function redirectUri() {
  const url = new URL(required("INSTAGRAM_REDIRECT_URI"));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== callbackPath)
    throw new Error("Invalid Instagram redirect configuration");
  return url.toString();
}
export const instagramAppId = () => required("INSTAGRAM_APP_ID");
const instagramSecret = () => required("INSTAGRAM_APP_SECRET");
export const adminDb = () => createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
export function assertConfigured() {
  if (process.env.INSTAGRAM_OAUTH_ENABLED !== "true") throw new Error("Instagram disabled");
  redirectUri(); instagramAppId(); instagramSecret(); encryptionBytes();
}
function encryptionBytes() {
  const raw = Uint8Array.from(atob(required("INSTAGRAM_TOKEN_ENCRYPTION_KEY")), c => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("Invalid Instagram encryption configuration");
  return raw;
}
export const randomState = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
export async function hashState(state: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export async function encryptToken(plaintext: string) {
  const key = await crypto.subtle.importKey("raw", encryptionBytes(), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return JSON.stringify({ version: 1, iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))) });
}
// Never log upstream responses, errors or URLs: the exchange URL contains secrets.
async function metaJson(url: string | URL, init?: RequestInit, failureLabel = "Instagram request failed") {
  let response: Response;
  try {
    response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch {
    // Never expose upstream URLs, request bodies, tokens or error messages.
    throw new Error(failureLabel);
  }
  if (!response.ok) throw new Error(failureLabel);
  try {
    return await response.json();
  } catch {
    throw new Error(failureLabel);
  }
}

// Instagram Login's code exchange can be flat or a single record inside "data".
// Refuse ambiguous batches rather than bind the wrong professional account.
function parseShortToken(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid Instagram account response");
  let record = payload as Record<string, unknown>;
  if ("data" in record) {
    if ("access_token" in record || !Array.isArray(record.data) || record.data.length !== 1)
      throw new Error("Invalid Instagram account response");
    const [item] = record.data;
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Invalid Instagram account response");
    record = item as Record<string, unknown>;
  }
  return record;
}
export async function exchangeInstagramCode(code: string) {
  const short = parseShortToken(await metaJson("https://api.instagram.com/oauth/access_token", {
    method: "POST", body: new URLSearchParams({ client_id: instagramAppId(), client_secret: instagramSecret(),
      grant_type: "authorization_code", redirect_uri: redirectUri(), code }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }, "Instagram authorization exchange failed"));
  if (typeof short.access_token !== "string" || !short.access_token ||
      (typeof short.user_id !== "string" && typeof short.user_id !== "number") || !short.user_id)
    throw new Error("Invalid Instagram account response");
  const granted = Array.isArray(short.permissions) && short.permissions.every(value => typeof value === "string")
    ? short.permissions : typeof short.permissions === "string"
      ? short.permissions.split(",").map(value => value.trim()) : null;
  if (!granted || !scopes.split(",").every(scope => granted.includes(scope))) throw new Error("Instagram permissions missing");
  const url = new URL("https://graph.instagram.com/access_token");
  url.search = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: instagramSecret(), access_token: short.access_token }).toString();
  const long = await metaJson(url, undefined, "Instagram long token exchange failed") as { access_token?: string; expires_in?: number };
  if (typeof long.access_token !== "string" || !long.access_token || !Number.isFinite(long.expires_in) || long.expires_in! <= 0)
    throw new Error("Invalid Instagram token response");
  // Fetch the stable account ID as a string; numeric JSON IDs can exceed JS precision.
  const profile = await metaJson("https://graph.instagram.com/me?fields=user_id,username", {
    headers: { Authorization: `Bearer ${long.access_token}` },
  }, "Instagram profile lookup failed") as { user_id?: string; username?: string };
  if (typeof profile.user_id !== "string" || !/^\d+$/.test(profile.user_id) || typeof profile.username !== "string")
    throw new Error("Invalid Instagram profile response");
  return { instagramUserId: profile.user_id, username: profile.username, token: long.access_token,
    expiresAt: new Date(Date.now() + long.expires_in! * 1000).toISOString() };
}
