import { createClient } from "@supabase/supabase-js";

export const redirectUri = "https://rsmmarketing.com.br/api/integrations/instagram/callback";
export const scopes = "instagram_business_basic,instagram_business_content_publish";
const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing server configuration: ${key}`);
  return value;
};
export const instagramAppId = () => required("INSTAGRAM_APP_ID");
const instagramSecret = () => required("INSTAGRAM_APP_SECRET");
export const adminDb = () =>
  createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export const randomState = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};
export async function hashState(state: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function encryptToken(plaintext: string) {
  const raw = Uint8Array.from(atob(required("INSTAGRAM_TOKEN_ENCRYPTION_KEY")), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("Instagram encryption key must be 32 bytes");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return JSON.stringify({
    version: 1,
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  });
}
export async function exchangeInstagramCode(code: string) {
  const body = new URLSearchParams({
    client_id: instagramAppId(),
    client_secret: instagramSecret(),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const result = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!result.ok) throw new Error("Instagram authorization code exchange failed");
  const short = await result.json() as { access_token?: string; user_id?: number | string };
  if (!short.access_token || !short.user_id) throw new Error("Instagram did not return account details");
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.search = new URLSearchParams({
    grant_type: "ig_exchange_token", client_secret: instagramSecret(), access_token: short.access_token,
  }).toString();
  const longResponse = await fetch(longUrl.toString());
  if (!longResponse.ok) throw new Error("Instagram long-lived token exchange failed");
  const long = await longResponse.json() as { access_token?: string; expires_in?: number };
  if (!long.access_token) throw new Error("Instagram did not return a long-lived token");
  return { instagramUserId: String(short.user_id), token: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null };
}
