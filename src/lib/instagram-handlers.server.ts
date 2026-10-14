import { adminDb, assertConfigured, encryptToken, exchangeInstagramCode, hashState, instagramAppId, randomState, redirectUri, scopes } from "./instagram-oauth.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE = /^[a-f0-9]{64}$/;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const cookieName = (state: string) => `__Host-rsm-instagram-${state}`;
const cookie = (state: string, value: string, age: number) => `${cookieName(state)}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const denied = () => json({ error: "Sem permissão para conectar o Instagram deste cliente" }, 403);
async function allowed(db: ReturnType<typeof adminDb>, userId: string, clientId: string) {
  const { data, error } = await db.rpc("can_manage_instagram", { _user_id: userId, _client_id: clientId });
  if (error) throw new Error("Permission verification unavailable");
  return data === true;
}
async function authenticate(request: Request, db: ReturnType<typeof adminDb>) {
  const bearer = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return null;
  const { data, error } = await db.auth.getUser(bearer);
  return error ? null : data.user;
}
export async function startInstagram(request: Request) {
  try {
    if (!request.headers.has("Authorization")) return json({ error: "Não autenticado" }, 401);
    assertConfigured();
    const origin = new URL(redirectUri()).origin;
    if (new URL(request.url).origin !== origin || request.headers.get("Origin") !== origin) return denied();
    const db = adminDb();
    const user = await authenticate(request, db);
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const input = await request.json().catch(() => null);
    if (!UUID.test(input?.client_id ?? "")) return json({ error: "Cliente inválido" }, 400);
    if (!await allowed(db, user.id, input.client_id)) return denied();
    const state = randomState();
    const browser = randomState();
    const { error } = await db.from("instagram_oauth_states").insert({
      state_hash: await hashState(state), browser_hash: await hashState(browser), user_id: user.id,
      client_id: input.client_id, expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    if (error) throw new Error("State storage failed");
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({ client_id: instagramAppId(), redirect_uri: redirectUri(), response_type: "code", scope: scopes, state }).toString();
    return Response.json({ authorization_url: url.toString() }, { headers: { ...headers, "Set-Cookie": cookie(state, browser, 600) } });
  } catch {
    return json({ error: "Integração ainda indisponível" }, 503);
  }
}
export async function callbackInstagram(request: Request) {
  let consumedState: string | undefined;
  let clientId: string | undefined;
  let diagnostic = "callback_unexpected";
  const diagnosticCodes: Record<string, string> = {
    "Instagram configuration unavailable": "configuration_missing",
    "Instagram disabled": "configuration_disabled",
    "Invalid Instagram redirect configuration": "configuration_redirect",
    "Invalid Instagram encryption configuration": "configuration_encryption",
    "Permission verification unavailable": "permission_check",
    "Instagram request failed": "instagram_request",
    "Instagram authorization exchange failed": "authorization_exchange",
    "Instagram exchange redirect mismatch": "meta_redirect_mismatch",
    "Instagram exchange invalid credentials": "meta_invalid_credentials",
    "Instagram exchange invalid code": "meta_invalid_code",
    "Instagram exchange permission error": "meta_permissions",
    "Instagram exchange HTTP 400": "meta_http_400",
    "Instagram exchange unauthorized": "meta_unauthorized",
    "Instagram exchange server error": "meta_server_error",
    "Instagram exchange network error": "meta_network",
    "Instagram exchange unexpected redirect": "meta_unexpected_redirect",
    "Instagram exchange rate limited": "meta_rate_limited",
    "Instagram long token exchange failed": "long_token_exchange",
    "Instagram profile lookup failed": "profile_lookup",
    "Invalid Instagram account response": "token_response",
    "Instagram permissions missing": "permissions_missing",
    "Invalid Instagram token response": "long_token_response",
    "Invalid Instagram profile response": "profile_response",
  };
  const result = (status: string) => new Response(null, { status: 303, headers: {
    ...headers, Location: `${clientId ? `/management/clients/${clientId}` : "/management/clients"}?tab=settings&instagram_connection=${status}${status === "error" && process.env.RSM_ENVIRONMENT === "staging" ? `&instagram_diagnostic=${diagnostic}` : ""}`,
    ...(consumedState ? { "Set-Cookie": cookie(consumedState, "", 0) } : {}),
  } });
  try {
    assertConfigured();
    const url = new URL(request.url);
    if (url.origin !== new URL(redirectUri()).origin) return result("invalid");
    const state = url.searchParams.get("state");
    if (!state || !STATE.test(state)) return result("invalid");
    const browser = request.headers.get("Cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName(state)}=`))?.split("=")[1];
    if (!browser || !STATE.test(browser)) return result("invalid");
    const db = adminDb();
    // Atomic DELETE ... RETURNING, bound to the browser, client, user and TTL.
    const { data, error } = await db.from("instagram_oauth_states").delete()
      .eq("state_hash", await hashState(state)).eq("browser_hash", await hashState(browser))
      .gt("expires_at", new Date().toISOString()).select("user_id,client_id").maybeSingle();
    consumedState = state;
    if (error || !data?.user_id || !UUID.test(data.client_id ?? "")) return result("expired");
    if (!await allowed(db, data.user_id, data.client_id)) return result("forbidden");
    clientId = data.client_id;
    if (url.searchParams.has("error")) return result("denied");
    const code = url.searchParams.get("code");
    if (!code || code.length > 4096) return result("invalid");
    diagnostic = "token_exchange";
    const account = await exchangeInstagramCode(code);
    // Recheck immediately before writing, in case access/churn changed during consent.
    if (!await allowed(db, data.user_id, data.client_id)) return result("forbidden");
    diagnostic = "connection_save";
    const { error: saveError } = await db.from("instagram_connections").upsert({
      user_id: data.user_id, client_id: data.client_id, instagram_user_id: account.instagramUserId,
      username: account.username, encrypted_access_token: await encryptToken(account.token),
      token_expires_at: account.expiresAt, updated_at: new Date().toISOString(),
    }, { onConflict: "client_id,instagram_user_id" });
    if (saveError) return result("error");
    return result("connected");
  } catch (error) {
    // Only fixed diagnostic labels in staging. Never expose messages, URLs or tokens.
    if (error instanceof Error && Object.hasOwn(diagnosticCodes, error.message))
      diagnostic = diagnosticCodes[error.message];
    return result("error");
  }
}
// Staging-only, authenticated egress check. Never uses a real OAuth code,
// token, client id or app secret; never reads or exposes an upstream response body.
function safeProbeError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message.slice(0, 200).toLowerCase() : "";
  if (name === "TimeoutError" || name === "AbortError" || /timed? out|aborted/.test(message)) return "timeout";
  if (/network connection lost|connection (?:lost|reset|refused)|disconnected|socket hang up/.test(message)) return "connection_lost";
  if (/dns|resolve|enotfound|no such host/.test(message)) return "dns";
  if (/tls|ssl|certificate|handshake/.test(message)) return "tls";
  if (/invalid redirect|unsupported redirect|requestinitializer|unsupported|invalid request/.test(message)) return "request_configuration";
  return "network_other";
}
export async function instagramNetworkDiagnostic(request: Request) {
  if (process.env.RSM_ENVIRONMENT !== "staging") return json({ error: "Não disponível" }, 404);
  try {
    const origin = new URL(redirectUri()).origin;
    if (new URL(request.url).origin !== origin || request.headers.get("Origin") !== origin) return denied();
    const db = adminDb();
    const user = await authenticate(request, db);
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const input = await request.json().catch(() => null);
    if (!UUID.test(input?.client_id ?? "")) return json({ error: "Cliente inválido" }, 400);
    if (!await allowed(db, user.id, input.client_id)) return denied();
    const endpoint = "https://api.instagram.com/oauth/access_token";
    const probes = [
      { label: "get", init: { method: "GET" } },
      { label: "post", init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: "rsm-staging-probe-invalid",
          client_secret: "rsm-staging-probe-invalid",
          grant_type: "authorization_code",
          redirect_uri: "https://example.invalid/diagnostic",
          code: "rsm-staging-probe-invalid",
        }),
      } },
    ];
    const results = await Promise.all(probes.map(async ({ label, init }) => {
      try {
        const response = await fetch(endpoint, {
          ...init, redirect: "manual", signal: AbortSignal.timeout(8000),
        });
        // Any HTTP response, including 400/405, proves the subrequest reached a server.
        // No response body, raw headers or Location are ever recorded.
        await response.body?.cancel().catch(() => {});
        return { method: label, reachable: true, status: response.status,
          category: response.status >= 300 && response.status < 400 ? "redirect_refused" : "http_response" };
      } catch (error) {
        return { method: label, reachable: false, status: null, category: safeProbeError(error) };
      }
    }));
    return json({ checks: results });
  } catch {
    return json({ error: "Diagnóstico de rede indisponível" }, 503);
  }
}
export async function instagramStatus(request: Request) {
  try {
    if (!request.headers.has("Authorization")) return json({ error: "Não autenticado" }, 401);
    const db = adminDb();
    const user = await authenticate(request, db);
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const clientId = new URL(request.url).searchParams.get("client_id") ?? "";
    if (!UUID.test(clientId)) return json({ error: "Cliente inválido" }, 400);
    if (!await allowed(db, user.id, clientId)) return denied();
    let enabled = true;
    try { assertConfigured(); } catch { enabled = false; }
    const { data, error } = await db.from("instagram_connections")
      .select("instagram_user_id,username,token_expires_at").eq("client_id", clientId);
    if (error) throw new Error("Status unavailable");
    return json({ enabled, connections: (data ?? []).map(c => ({ ...c,
      expired: !c.token_expires_at || Date.parse(c.token_expires_at) <= Date.now(),
    })) });
  } catch { return json({ error: "Não foi possível verificar a conexão" }, 503); }
}
