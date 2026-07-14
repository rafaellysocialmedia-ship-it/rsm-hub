import type { Post } from "@/lib/posts";

/**
 * Counts posts that "consume" the monthly quota.
 * A post consumes quota if it has a scheduled_date within the reference month
 * and is not archived or rejected.
 */
export function countMonthPosts(
  posts: Pick<Post, "scheduled_date" | "status" | "client_id">[],
  clientId: string | null,
  ref: Date = new Date(),
): number {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  return posts.filter((p) => {
    if (clientId && p.client_id !== clientId) return false;
    if (!p.scheduled_date) return false;
    const s = p.status as string;
    if (s === "archived" || s === "rejected") return false;
    const d = new Date(p.scheduled_date + "T00:00:00");
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}

export function quotaTone(used: number, quota: number): {
  bar: string;
  text: string;
  ring: string;
  label: string;
} {
  if (quota <= 0) return { bar: "bg-muted-foreground/40", text: "text-muted-foreground", ring: "stroke-muted-foreground/40", label: "—" };
  const pct = used / quota;
  if (used >= quota)
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      ring: "stroke-emerald-500",
      label: "Meta batida",
    };
  if (pct >= 0.8)
    return {
      bar: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      ring: "stroke-amber-500",
      label: "Reta final",
    };
  return {
    bar: "bg-primary",
    text: "text-primary",
    ring: "stroke-primary",
    label: `${quota - used} restante${quota - used === 1 ? "" : "s"}`,
  };
}

export function formatMonth(ref: Date = new Date()): string {
  return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
