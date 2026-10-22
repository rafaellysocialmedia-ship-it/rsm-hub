import { createFileRoute } from "@tanstack/react-router";
import { adminDb, hashState, instagramAppId, randomState, redirectUri, scopes } from "@/lib/instagram-oauth.server";

export const Route = createFileRoute("/api/integrations/instagram/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const bearer = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
          if (!bearer) return Response.json({ error: "Não autenticado" }, { status: 401 });
          const db = adminDb();
          const { data, error } = await db.auth.getUser(bearer);
          if (error || !data.user) return Response.json({ error: "Sessão inválida" }, { status: 401 });
          const state = randomState();
          const { error: insertError } = await db.from("instagram_oauth_states").insert({
            state_hash: await hashState(state), user_id: data.user.id,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          });
          if (insertError) throw insertError;
          const url = new URL("https://www.instagram.com/oauth/authorize");
          url.search = new URLSearchParams({
            client_id: instagramAppId(), redirect_uri: redirectUri,
            response_type: "code", scope: scopes, state,
          }).toString();
          return Response.json({ authorization_url: url.toString() }, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          console.error("Instagram OAuth start failed", error instanceof Error ? error.message : "unknown");
          return Response.json({ error: "Integração ainda indisponível" }, { status: 503 });
        }
      },
    },
  },
});
