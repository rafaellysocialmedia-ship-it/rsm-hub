import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description: "Lista tarefas da operação, com filtros por cliente, status e prazo.",
  inputSchema: {
    client_id: z.string().uuid().optional().describe("ID do cliente."),
    status: z.string().optional().describe("Status da tarefa (ex.: todo, doing, done)."),
    due_before: z.string().optional().describe("Somente tarefas com prazo até esta data (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(100).default(30).describe("Máximo de tarefas retornadas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id, status, due_before, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id, title, description, status, priority, client_id, assignee_id, due_date")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (client_id) query = query.eq("client_id", client_id);
    if (status) query = query.eq("status", status);
    if (due_before) query = query.lte("due_date", due_before);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
