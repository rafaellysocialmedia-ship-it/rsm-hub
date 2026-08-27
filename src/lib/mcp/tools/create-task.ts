import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description: "Cria uma tarefa na operação, opcionalmente vinculada a um cliente.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Título da tarefa."),
    description: z.string().optional().describe("Descrição/detalhes."),
    client_id: z.string().uuid().optional().describe("ID do cliente relacionado."),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Prioridade."),
    due_date: z.string().optional().describe("Prazo (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, created_by: ctx.getUserId() })
      .select("id, title, status, priority, due_date, client_id")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { task: data },
    };
  },
});
