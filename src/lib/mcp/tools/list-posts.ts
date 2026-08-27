import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const STATUSES = [
  "idea",
  "production",
  "recording",
  "editing",
  "review",
  "changes_requested",
  "approved",
  "to_schedule",
  "scheduled",
  "published",
  "rejected",
  "archived",
] as const;

export default defineTool({
  name: "list_posts",
  title: "Listar publicações",
  description:
    "Lista publicações do calendário editorial, com filtros por cliente, status e intervalo de datas agendadas.",
  inputSchema: {
    client_id: z.string().uuid().optional().describe("ID do cliente."),
    status: z.enum(STATUSES).optional().describe("Status da publicação."),
    from: z.string().optional().describe("Data inicial agendada (YYYY-MM-DD)."),
    to: z.string().optional().describe("Data final agendada (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(100).default(30).describe("Máximo de publicações retornadas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id, status, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("posts")
      .select(
        "id, title, status, client_id, scheduled_date, scheduled_time, social_networks, format, headline, caption, cta, hashtags",
      )
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (client_id) query = query.eq("client_id", client_id);
    if (status) query = query.eq("status", status);
    if (from) query = query.gte("scheduled_date", from);
    if (to) query = query.lte("scheduled_date", to);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { posts: data ?? [] },
    };
  },
});
