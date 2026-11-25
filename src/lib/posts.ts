import type { Database } from "@/integrations/supabase/types";

export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
export type PostStatus = Database["public"]["Enums"]["post_status"];
export type PostFile = Database["public"]["Tables"]["post_files"]["Row"];
export type PostComment = Database["public"]["Tables"]["post_comments"]["Row"];

/**
 * Fluxo de conteúdo em 6 etapas (Lote 6). Os valores do banco (post_status)
 * não mudam: cada etapa agrupa um ou mais status. "value" é o status gravado
 * quando alguém escolhe a etapa.
 */
export type StageKey =
  | "pauta"
  | "producao"
  | "revisao_interna"
  | "aprovacao_cliente"
  | "agendado"
  | "publicado"
  | "arquivado";

export type PostStage = {
  key: StageKey;
  value: PostStatus;
  label: string;
  statuses: PostStatus[];
  tone: string;
  dot: string;
  outOfFlow?: boolean;
};

export const POST_STAGES: PostStage[] = [
  { key: "pauta", value: "idea", label: "Pauta", statuses: ["idea"], tone: "bg-slate-500/10 text-slate-700 border-slate-500/30", dot: "bg-slate-400" },
  { key: "producao", value: "production", label: "Produção", statuses: ["production", "recording", "changes_requested"], tone: "bg-blue-500/10 text-blue-700 border-blue-500/30", dot: "bg-blue-500" },
  { key: "revisao_interna", value: "editing", label: "Revisão interna", statuses: ["editing"], tone: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30", dot: "bg-indigo-500" },
  { key: "aprovacao_cliente", value: "review", label: "Aprovação do cliente", statuses: ["review"], tone: "bg-amber-500/10 text-amber-700 border-amber-500/30", dot: "bg-amber-500" },
  { key: "agendado", value: "scheduled", label: "Agendado", statuses: ["approved", "to_schedule", "scheduled"], tone: "bg-sky-500/10 text-sky-700 border-sky-500/30", dot: "bg-sky-500" },
  { key: "publicado", value: "published", label: "Publicado", statuses: ["published"], tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", dot: "bg-emerald-500" },
  { key: "arquivado", value: "archived", label: "Arquivado", statuses: ["archived", "rejected"], tone: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30", dot: "bg-zinc-400", outOfFlow: true },
];

/** As 6 etapas do fluxo, sem Arquivado. */
export const FLOW_STAGES = POST_STAGES.filter((s) => !s.outOfFlow);

/**
 * Lista usada por seletores, filtros e colunas: 6 etapas + Arquivado.
 * Mantém o nome antigo para as telas que já importavam POST_STATUS.
 */
export const POST_STATUS = POST_STAGES;

export function stageOf(status: PostStatus | string | null | undefined): PostStage {
  return POST_STAGES.find((s) => s.statuses.includes(status as PostStatus)) ?? POST_STAGES[0];
}

/** Rótulo, cor e status de gravação da etapa à qual o status pertence. */
export function statusMeta(s: PostStatus | string | null | undefined) {
  return stageOf(s);
}

/** O status pertence à etapa cujo valor (status gravado) é stageValue? */
export function inStage(status: PostStatus | string | null | undefined, stageValue: string) {
  return stageOf(status).value === stageValue;
}

/** Filtro de etapa (aceita lista separada por vírgula, como os filtros salvos). */
export function matchesStageFilter(status: PostStatus | string | null | undefined, filter: string) {
  if (!filter || filter === "all") return true;
  // Filtros salvos antes do Lote 6 podem ter status antigos (ex.: "approved").
  return filter.split(",").some((v) => inStage(status, stageOf(v).value));
}

type SchedulablePost = Pick<Post, "status" | "scheduled_date" | "scheduled_time">;

/** Aprovado ou pronto, mas sem data e hora: mostra "Falta agendar". */
export function needsScheduling(post: SchedulablePost) {
  return (
    (post.status === "approved" || post.status === "to_schedule") &&
    !(post.scheduled_date && post.scheduled_time)
  );
}

/** Status gravado ao mover um post para uma etapa (ex.: arrastar no quadro). */
export function statusForStage(stageValue: PostStatus, post?: SchedulablePost): PostStatus {
  if (stageValue === "scheduled" && post && !(post.scheduled_date && post.scheduled_time)) {
    return "to_schedule";
  }
  return stageValue;
}

export type PostBadge = { key: "gravacao" | "ajuste" | "falta_agendar"; label: string; tone: string; title?: string };

export const BADGE_TONES = {
  gravacao: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/30",
  ajuste: "bg-red-500/10 text-red-700 border-red-500/40",
  falta_agendar: "bg-orange-500/10 text-orange-700 border-orange-500/40",
} as const;

/** Selos: Gravação, Ajuste solicitado (com o motivo do cliente) e Falta agendar. */
export function postBadges(
  post: SchedulablePost & { in_recording?: boolean | null },
  changeReason?: string | null,
): PostBadge[] {
  const badges: PostBadge[] = [];
  if (post.status === "changes_requested") {
    badges.push({
      key: "ajuste",
      label: "Ajuste solicitado",
      tone: BADGE_TONES.ajuste,
      title: changeReason ? `Motivo do cliente: ${changeReason}` : undefined,
    });
  }
  if ((post.in_recording || post.status === "recording") && stageOf(post.status).key === "producao") {
    badges.push({ key: "gravacao", label: "Gravação", tone: BADGE_TONES.gravacao });
  }
  if (needsScheduling(post)) {
    badges.push({ key: "falta_agendar", label: "Falta agendar", tone: BADGE_TONES.falta_agendar });
  }
  return badges;
}

/** Rótulos dos eventos do fluxo gravados na linha do tempo (post_activity_log). */
export const FLOW_ACTIVITY_LABELS: Record<string, string> = {
  sent_to_internal_review: "Enviado para revisão interna",
  internal_review_approved: "Revisão interna aprovada",
  internal_review_returned: "Devolvido para produção",
  internal_review_skipped: "Revisão interna pulada",
  schedule_changed: "Data, hora ou redes alteradas",
  status_migrated: "Etapa convertida",
};

export const SOCIAL_NETWORKS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "X (Twitter)",
  "Threads",
  "Pinterest",
] as const;

export const POST_FORMATS = [
  "Feed",
  "Reels",
  "Story",
  "Carrossel",
  "Vídeo",
  "Live",
  "Artigo",
] as const;

export const POST_OBJECTIVES = [
  "Awareness",
  "Engajamento",
  "Tráfego",
  "Conversão",
  "Branding",
  "Educacional",
] as const;

export type RecurrenceRule = {
  frequency: "none" | "daily" | "weekly" | "biweekly" | "monthly";
  count?: number;
};

export function postNetworks(post: Pick<Post, "social_network"> & { social_networks?: string[] | null }): string[] {
  const list = (post.social_networks ?? []).filter(Boolean);
  if (list.length > 0) return list;
  return post.social_network ? [post.social_network] : [];
}
