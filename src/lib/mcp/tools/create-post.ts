import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_post",
  title: "Criar publicação",
  description:
    "Cria uma publicação no calendário editorial de um cliente (status inicial 'idea' por padrão).",
  inputSchema: {
    client_id: z.string().uuid().describe("ID do cliente dono da publicação."),
    title: z.string().trim().min(1).describe("Título interno da publicação."),
    status: z
      .enum(["idea", "production", "review", "approved", "to_schedule", "scheduled"])
      .default("idea")
      .describe("Status inicial."),
    scheduled_date: z.string().optional().describe("Data agendada (YYYY-MM-DD)."),
    scheduled_time: z.string().optional().describe("Hora agendada (HH:MM)."),
    social_networks: z.array(z.string()).optional().describe("Redes sociais de destino."),
    format: z.string().optional().describe("Formato (ex.: Reels, Carrossel)."),
    headline: z.string().optional().describe("Headline principal."),
    caption: z.string().optional().describe("Legenda."),
    cta: z.string().optional().describe("Chamada para ação."),
    hashtags: z.string().optional().describe("Hashtags."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...input, created_by: ctx.getUserId() })
      .select("id, title, status, client_id, scheduled_date")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { post: data },
    };
  },
});
