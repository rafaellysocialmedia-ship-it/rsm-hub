import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o assistente de IA do Social Media Hub, uma plataforma brasileira de gestão de social media para agências e criadores. Ajude com:
- ideias de pauta e conteúdo para Instagram, TikTok, LinkedIn, YouTube, Facebook, X
- redação de legendas envolventes com CTAs
- roteiros para Reels/Shorts
- sugestões de hashtags relevantes
- reescrita/adequação de tom
- estratégia editorial e calendário

Sempre responda em português do Brasil, com tom prático, direto e adaptado ao público de marketing digital. Use markdown quando útil (listas, negrito).`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { messages, threadId } = (await request.json()) as {
          messages?: UIMessage[];
          threadId?: string;
        };
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Bad request", { status: 400 });
        }

        // Auth: read Supabase session from Authorization header
        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("ai_threads")
          .select("id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: SYSTEM_PROMPT,
          messages: convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            try {
              const last = finalMessages[finalMessages.length - 1];
              const prev = finalMessages[finalMessages.length - 2];
              const rows: Array<{
                thread_id: string;
                user_id: string;
                role: string;
                content: unknown;
              }> = [];
              if (prev && prev.role === "user") {
                rows.push({ thread_id: threadId, user_id: userId, role: "user", content: prev });
              }
              if (last && last.role === "assistant") {
                rows.push({ thread_id: threadId, user_id: userId, role: "assistant", content: last });
              }
              if (rows.length) {
                await supabase.from("ai_messages").insert(rows);
                await supabase
                  .from("ai_threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);
              }
            } catch (e) {
              console.error("Persist AI messages failed", e);
            }
          },
        });
      },
    },
  },
});
