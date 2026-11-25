import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { stageInput, statusForStageKey, withStage } from "../stages";

export default defineTool({
  name: "update_post_status",
  title: "Mudar a etapa da publicação",
  description:
    "Move uma publicação para uma das 6 etapas do fluxo (Pauta, Produção, Revisão interna, Aprovação do cliente, Agendado, Publicado) ou para Arquivado.",
  inputSchema: {
    post_id: z.string().uuid().describe("ID da publicação."),
    etapa: stageInput,
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ post_id, etapa }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const current = await supabase
      .from("posts")
      .select("scheduled_date, scheduled_time")
      .eq("id", post_id)
      .maybeSingle();
    if (current.error) return { content: [{ type: "text", text: current.error.message }], isError: true };
    const status = statusForStageKey(etapa, current.data ?? undefined);
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
      content: [{ type: "text", text: JSON.stringify(withStage(data)) }],
      structuredContent: { post: withStage(data) },
    };
  },
});
