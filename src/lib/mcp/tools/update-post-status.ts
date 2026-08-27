import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_post_status",
  title: "Atualizar status da publicação",
  description: "Altera o status de uma publicação existente no calendário editorial.",
  inputSchema: {
    post_id: z.string().uuid().describe("ID da publicação."),
    status: z
      .enum([
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
      ])
      .describe("Novo status."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ post_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("posts")
      .update({ status })
      .eq("id", post_id)
      .select("id, title, status")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "Publicação não encontrada ou sem permissão." }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { post: data },
    };
  },
});
