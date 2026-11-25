import { z } from "zod";
import { POST_STAGES, stageOf, type PostStatus, type StageKey } from "@/lib/posts";

/** Etapas aceitas pela IA conectada: as 6 do fluxo + Arquivado. */
export const STAGE_KEYS = [
  "pauta",
  "producao",
  "revisao_interna",
  "aprovacao_cliente",
  "agendado",
  "publicado",
  "arquivado",
] as const satisfies readonly StageKey[];

export const stageInput = z
  .enum(STAGE_KEYS)
  .describe(
    "Etapa: pauta, producao, revisao_interna, aprovacao_cliente, agendado, publicado ou arquivado (fora do fluxo). " +
      "A equipe só envia para aprovacao_cliente depois da revisão interna.",
  );

export function stageByKey(key: StageKey) {
  return POST_STAGES.find((s) => s.key === key)!;
}

/** Status gravado para a etapa. Agendado sem data e hora fica como "Falta agendar". */
export function statusForStageKey(
  key: StageKey,
  post?: { scheduled_date?: string | null; scheduled_time?: string | null },
): PostStatus {
  const stage = stageByKey(key);
  if (key === "agendado" && !(post?.scheduled_date && post?.scheduled_time)) return "to_schedule";
  return stage.value;
}

/** Acrescenta a etapa legível ao post devolvido para a IA. */
export function withStage<T extends { status: string }>(post: T) {
  const stage = stageOf(post.status);
  return { ...post, etapa: stage.key, etapa_rotulo: stage.label };
}
