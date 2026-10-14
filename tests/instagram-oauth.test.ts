import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { startInstagram, callbackInstagram, instagramStatus } from "../src/lib/instagram-handlers.server";
import { encryptToken, hashState, scopes } from "../src/lib/instagram-oauth.server";

const client = "10000000-0000-4000-8000-000000000001";
const user = "20000000-0000-4000-8000-000000000001";
const origin = "https://oauth-test.example";
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let states: Record<string, any>;
let saved: any[];
let permitted: boolean;
let upstreamFailure: string;
let grantedScopes: string[];
let calls: string[];
let databaseFailure: boolean;
let shortTokenShape: "flat" | "wrapped" | "empty" | "multiple" | "mixed";
let permissionsAsString: boolean;
beforeEach(() => {
  Object.assign(process.env, { INSTAGRAM_OAUTH_ENABLED: "true", INSTAGRAM_REDIRECT_URI: `${origin}/api/integrations/instagram/callback`,
    INSTAGRAM_APP_ID: "test-app", INSTAGRAM_APP_SECRET: "test-secret", INSTAGRAM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    SUPABASE_URL: "https://database-test.example", SUPABASE_SERVICE_ROLE_KEY: "test-service-key" });
  states = {}; saved = []; permitted = true; upstreamFailure = ""; grantedScopes = scopes.split(","); calls = []; databaseFailure = false;
  shortTokenShape = "flat"; permissionsAsString = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    const ok = (body: unknown) => Response.json(body);
    if (url.pathname === "/auth/v1/user") return new Headers(init?.headers).get("Authorization") === "Bearer valid-session"
      ? ok({ id: user }) : Response.json({ message: "Invalid session" }, { status: 401 });
    if (url.pathname === "/rest/v1/rpc/can_manage_instagram") return ok(permitted);
    if (databaseFailure && url.hostname === "database-test.example") return Response.json({ message: "test database failure" }, { status: 500 });
    if (url.pathname === "/rest/v1/instagram_oauth_states") {
      if (init?.method === "POST") { const row = JSON.parse(String(init.body)); states[row.state_hash] = row; return new Response(null, { status: 201 }); }
      const hash = url.searchParams.get("state_hash")!.slice(3);
      const row = states[hash];
      const matched = row && row.browser_hash === url.searchParams.get("browser_hash")?.slice(3) && Date.parse(row.expires_at) > Date.now();
      if (matched) delete states[hash];
      return ok(matched ? [{ user_id: row.user_id, client_id: row.client_id }] : []);
    }
    if (url.pathname === "/rest/v1/instagram_connections") {
      if (init?.method === "POST") { saved.push(JSON.parse(String(init.body))); return new Response(null, { status: 201 }); }
      assert.equal(url.searchParams.get("select"), "instagram_user_id,username,token_expires_at");
      return ok(saved.map(({ instagram_user_id, username, token_expires_at }) => ({ instagram_user_id, username, token_expires_at })));
    }
    if (url.hostname === "api.instagram.com") {
      if (upstreamFailure === "code") throw new Error("Sensitive test-secret must never be logged");
      assert.equal(new URLSearchParams(String(init?.body)).get("redirect_uri"), process.env.INSTAGRAM_REDIRECT_URI);
      if (upstreamFailure.startsWith("meta:")) {
        const [, scenario] = upstreamFailure.split(":");
        const errors: Record<string, { status: number; text: string }> = {
          redirect: { status: 400, text: "Error validating verification code. Please make sure your redirect_uri is identical" },
          credentials: { status: 400, text: "Invalid client_id or client_secret" },
          code: { status: 400, text: "No matching code found." },
          permissions: { status: 403, text: "Permission was denied" },
          unknown: { status: 400, text: "Something unexpected happened. Sensitive test-secret should remain private." },
          rate: { status: 429, text: "Rate limit" },
          unavailable: { status: 503, text: "Temporary outage" },
        };
        const sample = errors[scenario];
        if (!sample) throw new Error("Unknown mock Meta error scenario");
        return Response.json({ error_type: "OAuthException", code: sample.status, error_message: sample.text }, { status: sample.status });
      }
      const short = { access_token: "test-short-token", user_id: "12345678901234567",
        permissions: permissionsAsString ? grantedScopes.join(", ") : grantedScopes };
      if (shortTokenShape === "wrapped") return ok({ data: [short] });
      if (shortTokenShape === "empty") return ok({ data: [] });
      if (shortTokenShape === "multiple") return ok({ data: [short, short] });
      if (shortTokenShape === "mixed") return ok({ ...short, data: [short] });
      return ok(short);
    }
    if (url.pathname === "/access_token") return upstreamFailure === "long" ? new Response(null, { status: 400 }) : ok({ access_token: "test-long-token", expires_in: 5184000 });
    if (url.pathname === "/me") return upstreamFailure === "profile" ? ok({ user_id: 123, username: "bad" }) : ok({ user_id: "12345678901234567", username: "test_profile" });
    throw new Error(`Unexpected mock request ${url.hostname}${url.pathname}`);
  };
});
afterEach(() => { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv); });
const startRequest = (body: unknown = { client_id: client }, token = "valid-session", requestOrigin = origin) => new Request(`${origin}/api/integrations/instagram/start`, {
  method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
async function begin() {
  const response = await startInstagram(startRequest()); assert.equal(response.status, 200);
  const { authorization_url } = await response.json();
  const state = new URL(authorization_url).searchParams.get("state")!;
  return { response, state, cookie: response.headers.get("Set-Cookie")!.split(";")[0] };
}
function callback(state: string, cookie = "", query = "code=test-code") {
  return callbackInstagram(new Request(`${origin}/api/integrations/instagram/callback?state=${state}&${query}`, { headers: { Cookie: cookie } }));
}
const result = (response: Response) => new URL(response.headers.get("Location")!, origin).searchParams.get("instagram_connection");
test("start requires authentication", async () => assert.equal((await startInstagram(new Request(`${origin}/start`, { method: "POST" }))).status, 401));
test("invalid session rejected", async () => assert.equal((await startInstagram(startRequest(undefined, "invalid"))).status, 401));
test("rejects cross-origin start", async () => assert.equal((await startInstagram(startRequest(undefined, undefined, "https://attacker.example"))).status, 403));
test("invalid client rejected without state writes", async () => { assert.equal((await startInstagram(startRequest({ client_id: "bad" }))).status, 400); assert.equal(Object.keys(states).length, 0); });
test("client permissions enforced", async () => { permitted = false; assert.equal((await startInstagram(startRequest())).status, 403); assert.equal(Object.keys(states).length, 0); });
test("integration disabled by default", async () => { delete process.env.INSTAGRAM_OAUTH_ENABLED; assert.equal((await startInstagram(startRequest())).status, 503); assert.equal(calls.length, 0); });
test("missing secret fails before storing state", async () => { delete process.env.INSTAGRAM_APP_SECRET; assert.equal((await startInstagram(startRequest())).status, 503); assert.equal(calls.length, 0); });
test("bad encryption key fails before consent", async () => { process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = "YQ=="; assert.equal((await startInstagram(startRequest())).status, 503); });
test("HTTP callback configuration rejected", async () => { process.env.INSTAGRAM_REDIRECT_URI = "http://test.example/api/integrations/instagram/callback"; assert.equal((await startInstagram(startRequest())).status, 503); });
test("state is hashed and cookie is secure", async () => { const { state, response } = await begin(); assert.ok(states[await hashState(state)]); assert.equal(states[state], undefined); assert.match(response.headers.get("Set-Cookie")!, /HttpOnly; Secure; SameSite=Lax/); assert.equal(response.headers.get("Cache-Control"), "no-store"); });
test("complete simulated flow saves encrypted token for client and exact string ID", async () => {
  const b = await begin(); const response = await callback(b.state, b.cookie);
  assert.equal(result(response), "connected"); assert.match(response.headers.get("Location")!, new RegExp(client));
  assert.equal(saved[0].client_id, client); assert.equal(saved[0].user_id, user); assert.equal(saved[0].instagram_user_id, "12345678901234567");
  assert.ok(!JSON.stringify(saved).includes("test-long-token")); assert.equal(JSON.parse(saved[0].encrypted_access_token).version, 1);
  assert.match(response.headers.get("Set-Cookie")!, /Max-Age=0/); assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
});
test("single wrapped Instagram Login response connects the intended client", async () => {
  shortTokenShape = "wrapped";
  const b = await begin(); const response = await callback(b.state, b.cookie);
  assert.equal(result(response), "connected");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].instagram_user_id, "12345678901234567");
});
test("comma-separated permissions with whitespace are accepted", async () => {
  permissionsAsString = true;
  const b = await begin();
  assert.equal(result(await callback(b.state, b.cookie)), "connected");
  assert.equal(saved.length, 1);
});
for (const shape of ["empty", "multiple", "mixed"] as const) {
  test(`ambiguous or malformed ${shape} token response never saves a connection`, async () => {
    shortTokenShape = shape; process.env.RSM_ENVIRONMENT = "staging";
    const b = await begin(); const response = await callback(b.state, b.cookie);
    assert.equal(result(response), "error");
    const redirect = new URL(response.headers.get("Location")!, origin);
    assert.equal(redirect.searchParams.get("instagram_diagnostic"), "token_response");
    assert.equal(saved.length, 0);
  });
}
for (const [failure, expected] of [
  ["code", "meta_network"], ["long", "long_token_exchange"],
  ["profile", "profile_response"],
] as const) {
  test(`staging callback reports sanitized ${failure} failure`, async () => {
    process.env.RSM_ENVIRONMENT = "staging";
    const b = await begin(); upstreamFailure = failure;
    const response = await callback(b.state, b.cookie);
    assert.equal(result(response), "error");
    const location = response.headers.get("Location")!;
    assert.equal(new URL(location, origin).searchParams.get("instagram_diagnostic"), expected);
    assert.ok(!location.includes("test-secret") && !location.includes("test-short-token"));
    assert.ok(!location.includes("Sensitive"));
    assert.equal(saved.length, 0);
  });
}
for (const [scenario, expected] of [
  ["redirect", "meta_redirect_mismatch"], ["credentials", "meta_invalid_credentials"],
  ["code", "meta_invalid_code"], ["permissions", "meta_permissions"],
  ["unknown", "meta_http_400"], ["rate", "meta_rate_limited"],
  ["unavailable", "meta_server_error"],
] as const) {
  test(`staging classifies Meta ${scenario} error without revealing upstream message`, async () => {
    process.env.RSM_ENVIRONMENT = "staging";
    upstreamFailure = `meta:${scenario}`;
    const b = await begin();
    const response = await callback(b.state, b.cookie);
    assert.equal(result(response), "error");
    const location = response.headers.get("Location")!;
    assert.equal(new URL(location, origin).searchParams.get("instagram_diagnostic"), expected);
    assert.ok(!location.includes("Sensitive") && !location.includes("test-secret"));
    assert.equal(saved.length, 0);
  });
}
test("production does not reveal classified Meta errors", async () => {
  process.env.RSM_ENVIRONMENT = "production"; upstreamFailure = "meta:credentials";
  const b = await begin(); const response = await callback(b.state, b.cookie);
  assert.equal(result(response), "error");
  assert.equal(new URL(response.headers.get("Location")!, origin).searchParams.get("instagram_diagnostic"), null);
});
test("production callback never discloses diagnostic labels", async () => {
  process.env.RSM_ENVIRONMENT = "production";
  const b = await begin(); upstreamFailure = "code";
  const response = await callback(b.state, b.cookie);
  assert.equal(result(response), "error");
  assert.equal(new URL(response.headers.get("Location")!, origin).searchParams.get("instagram_diagnostic"), null);
});
test("missing browser cookie cannot consume state", async () => { const b = await begin(); assert.equal(result(await callback(b.state)), "invalid"); assert.equal(Object.keys(states).length, 1); });
test("wrong browser cannot consume state", async () => { const b = await begin(); assert.equal(result(await callback(b.state, b.cookie.replace(/=.*/, `=${"b".repeat(64)}`))), "expired"); assert.equal(Object.keys(states).length, 1); });
test("expired state rejected", async () => { const b = await begin(); states[await hashState(b.state)].expires_at = new Date(0).toISOString(); assert.equal(result(await callback(b.state, b.cookie)), "expired"); assert.equal(saved.length, 0); });
test("callback cannot be replayed", async () => { const b = await begin(); await callback(b.state, b.cookie); assert.equal(result(await callback(b.state, b.cookie)), "expired"); assert.equal(saved.length, 1); });
test("concurrent callback saves at most once", async () => { const b = await begin(); const responses = await Promise.all([callback(b.state, b.cookie), callback(b.state, b.cookie)]); assert.deepEqual(responses.map(result).sort(), ["connected", "expired"]); assert.equal(saved.length, 1); });
test("denied consent consumes state without token exchange", async () => { const b = await begin(); assert.equal(result(await callback(b.state, b.cookie, "error=access_denied")), "denied"); assert.equal(Object.keys(states).length, 0); assert.ok(!calls.includes("/oauth/access_token")); });
test("permissions revoked after start rejected", async () => { const b = await begin(); permitted = false; assert.equal(result(await callback(b.state, b.cookie)), "forbidden"); assert.equal(saved.length, 0); });
test("missing code rejected after consuming state", async () => { const b = await begin(); assert.equal(result(await callback(b.state, b.cookie, "")), "invalid"); assert.equal(Object.keys(states).length, 0); });
test("malformed state rejected", async () => assert.equal(result(await callback("bad")), "invalid"));
for (const failure of ["code", "long", "profile"]) test(`upstream ${failure} failure saves nothing`, async () => { const b = await begin(); upstreamFailure = failure; assert.equal(result(await callback(b.state, b.cookie)), "error"); assert.equal(saved.length, 0); });
test("partial consent rejected", async () => { const b = await begin(); grantedScopes = ["instagram_business_basic"]; assert.equal(result(await callback(b.state, b.cookie)), "error"); assert.equal(saved.length, 0); });
test("database failure gives generic unavailable response", async () => { databaseFailure = true; assert.equal((await startInstagram(startRequest())).status, 503); });
test("status requires authentication and authorization", async () => { const url = `${origin}/status?client_id=${client}`; assert.equal((await instagramStatus(new Request(url))).status, 401); permitted = false; assert.equal((await instagramStatus(new Request(url, { headers: { Authorization: "Bearer valid-session" } }))).status, 403); });
test("status returns safe metadata only", async () => { const b = await begin(); await callback(b.state, b.cookie); const response = await instagramStatus(new Request(`${origin}/status?client_id=${client}`, { headers: { Authorization: "Bearer valid-session" } })); const data = await response.json(); assert.equal(data.connections[0].expired, false); assert.deepEqual(Object.keys(data.connections[0]).sort(), ["expired", "instagram_user_id", "token_expires_at", "username"]); assert.ok(!JSON.stringify(data).includes("test-long-token")); });
test("AES-GCM is randomized and decrypts with configured key", async () => {
  const a = JSON.parse(await encryptToken("fixture-token")); const b = JSON.parse(await encryptToken("fixture-token")); assert.notEqual(a.iv, b.iv);
  const key = await crypto.subtle.importKey("raw", Buffer.alloc(32, 7), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(a.iv, "base64") }, key, Buffer.from(a.data, "base64"));
  assert.equal(new TextDecoder().decode(plain), "fixture-token");
});
