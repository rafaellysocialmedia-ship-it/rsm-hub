import { createFileRoute } from "@tanstack/react-router";
import { adminDb, encryptToken, exchangeInstagramCode, hashState } from "@/lib/instagram-oauth.server";

const resultRedirect = (status: string) =>
  Response.redirect(`https://rsmmarketing.com.br/dashboard?instagram_connection=${encodeURIComponent(status)}`, 303);

export const Route = createFileRoute("/api/integrations/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("error")) return resultRedirect("denied");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state || !/^[a-f0-9]{64}$/.test(state)) return resultRedirect("invalid");
        try {
          const db = adminDb();
          const stateHash = await hashState(state);
          // Delete and return atomically so the state cannot be used twice.
          const { data, error } = await db.from("instagram_oauth_states")
            .delete().eq("state_hash", stateHash)
            .gt("expires_at", new Date().toISOString()).select("user_id").maybeSingle();
          if (error || !data?.user_id) return resultRedirect("expired");
          const account = await exchangeInstagramCode(code);
          const encrypted = await encryptToken(account.token);
          const { error: saveError } = await db.from("instagram_connections").upsert({
            user_id: data.user_id, instagram_user_id: account.instagramUserId,
            encrypted_access_token: encrypted, token_expires_at: account.expiresAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,instagram_user_id" });
          if (saveError) throw saveError;
          return resultRedirect("connected");
        } catch (error) {
          console.error("Instagram OAuth callback failed", error instanceof Error ? error.message : "unknown");
          return resultRedirect("error");
        }
      },
    },
  },
});
