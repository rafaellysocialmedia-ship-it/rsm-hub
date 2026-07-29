import type { Database } from "@/integrations/supabase/types";

export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
export type PostStatus = Database["public"]["Enums"]["post_status"];
export type PostFile = Database["public"]["Tables"]["post_files"]["Row"];
export type PostComment = Database["public"]["Tables"]["post_comments"]["Row"];

export const POST_STATUS: {
  value: PostStatus;
  label: string;
  tone: string;
  dot: string;
}[] = [
  { value: "idea", label: "Ideia", tone: "bg-slate-500/10 text-slate-600 border-slate-500/30", dot: "bg-slate-400" },
  { value: "production", label: "Produção", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30", dot: "bg-blue-500" },
  { value: "recording" as PostStatus, label: "Em gravação", tone: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30", dot: "bg-fuchsia-500" },
  { value: "editing" as PostStatus, label: "Em edição", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30", dot: "bg-indigo-500" },

  { value: "review", label: "Revisão", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30", dot: "bg-amber-500" },
  { value: "changes_requested" as PostStatus, label: "Ajuste solicitado", tone: "bg-red-500/10 text-red-600 border-red-500/40", dot: "bg-red-500" },
  { value: "approved", label: "Aprovado", tone: "bg-violet-500/10 text-violet-600 border-violet-500/30", dot: "bg-violet-500" },
  { value: "to_schedule" as PostStatus, label: "A agendar", tone: "bg-teal-500/10 text-teal-600 border-teal-500/30", dot: "bg-teal-500" },
  { value: "scheduled", label: "Agendado", tone: "bg-sky-500/10 text-sky-600 border-sky-500/30", dot: "bg-sky-500" },
  { value: "published", label: "Publicado", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", dot: "bg-emerald-500" },
  { value: "rejected" as PostStatus, label: "Reprovado", tone: "bg-rose-500/10 text-rose-600 border-rose-500/30", dot: "bg-rose-500" },
  { value: "archived" as PostStatus, label: "Arquivado", tone: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30", dot: "bg-zinc-400" },
];

export function statusMeta(s: PostStatus) {
  return POST_STATUS.find((x) => x.value === s) ?? POST_STATUS[0];
}

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
