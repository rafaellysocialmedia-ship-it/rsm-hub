import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "Listar clientes",
  description: "Lista os clientes visíveis para o usuário autenticado, com status e etapa da jornada.",
  inputSchema: {
    status: z
      .enum(["active", "paused", "prospect", "inactive"])
      .optional()
      .describe("Filtra por status do cliente."),
    search: z.string().trim().min(1).optional().describe("Busca por nome do cliente."),
    limit: z.number().int().min(1).max(100).default(25).describe("Máximo de clientes retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("clients")
      .select("id, name, status, journey_stage, plan, monthly_post_quota, segment, start_date")
      .order("name")
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});
