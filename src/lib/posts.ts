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
  { value: "idea", label: "Ideia", tone: "bg-slate-500/10 text-slate-500 border-slate-500/20", dot: "bg-slate-400" },
  { value: "production", label: "Produção", tone: "bg-blue-500/10 text-blue-500 border-blue-500/20", dot: "bg-blue-500" },
  { value: "review", label: "Revisão", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  { value: "approved", label: "Aprovado", tone: "bg-violet-500/10 text-violet-500 border-violet-500/20", dot: "bg-violet-500" },
  { value: "scheduled", label: "Agendado", tone: "bg-sky-500/10 text-sky-500 border-sky-500/20", dot: "bg-sky-500" },
  { value: "published", label: "Publicado", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
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
