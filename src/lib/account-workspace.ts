import { format } from "date-fns";
import type { Post } from "@/lib/posts";

export function localDate(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}
export function accountContentSummary(
  posts: Pick<Post, "status" | "scheduled_date">[],
  month = format(new Date(), "yyyy-MM"),
) {
  return {
    published: posts.filter((p) => p.status === "published" && p.scheduled_date?.startsWith(month))
      .length,
    scheduled: posts.filter((p) => p.status === "scheduled" && p.scheduled_date?.startsWith(month))
      .length,
    pending: posts.filter((p) => p.status === "review").length,
    changes: posts.filter((p) => p.status === "changes_requested").length,
    late: posts.filter(
      (p) =>
        p.scheduled_date &&
        p.scheduled_date < localDate() &&
        !["published", "archived", "rejected"].includes(p.status),
    ).length,
  };
}
export function safeExternalUrl(value?: string | null) {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export const STRATEGY_FIELDS = [
  ["objective", "Objetivo principal"],
  ["audience", "Público-alvo e persona"],
  ["positioning", "Posicionamento e diferenciais"],
  ["services", "Serviços prioritários"],
  ["voice", "Tom de voz"],
  ["pillars", "Pilares editoriais"],
  ["frequency", "Frequência e formatos"],
  ["identity", "Identidade visual"],
  ["references", "Referências e concorrentes"],
  ["guidelines", "Diretrizes importantes"],
  ["avoid", "Palavras e elementos a evitar"],
  ["cta", "CTAs"],
] as const;
export type PortalAccount = {
  can_view_finance: boolean;
  id: string;
  name: string;
  logo_url: string | null;
  plan: string | null;
  start_date: string | null;
  status: string;
  charges: {
    id: string;
    service_label: string | null;
    amount: number;
    due_date: string;
    status: string;
    paid_date: string | null;
    payment_url: string | null;
  }[];
  contracts: {
    id: string;
    service_label: string | null;
    amount: number;
    periodicity: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
  }[];
  signed_contracts: {
    id: string;
    title: string;
    status: string;
    signed_url: string | null;
    signature_provider: string | null;
    expires_at: string | null;
    storage_path: string | null;
  }[];
};
