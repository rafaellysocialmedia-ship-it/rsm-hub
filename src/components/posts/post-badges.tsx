import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { postBadges, type Post } from "@/lib/posts";

type BadgePost = Pick<Post, "status" | "scheduled_date" | "scheduled_time"> & {
  id?: string;
  in_recording?: boolean | null;
};

/**
 * Motivos de "Ajuste solicitado" (feedback do cliente) por post.
 * Uma consulta pequena compartilhada por todas as telas.
 */
export function useChangeReasons(enabled = true) {
  return useQuery({
    queryKey: ["change-reasons"],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_approvals")
        .select("post_id,feedback")
        .eq("decision", "changes_requested");
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((a) => {
        if (a.post_id && a.feedback) map.set(a.post_id, a.feedback);
      });
      return map;
    },
  });
}

export function PostBadges({
  post,
  reason,
  showReason = false,
  className,
  size = "sm",
}: {
  post: BadgePost;
  reason?: string | null;
  showReason?: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  const badges = postBadges(post, reason);
  if (!badges.length) return null;
  const ajuste = badges.find((b) => b.key === "ajuste");
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {badges.map((b) => (
          <span
            key={b.key}
            title={b.title}
            className={cn(
              "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-semibold",
              size === "xs" ? "px-1.5 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
              b.tone,
            )}
          >
            {b.label}
          </span>
        ))}
      </div>
      {showReason && ajuste && reason && (
        <p className="line-clamp-2 text-[11px] leading-snug text-red-700">“{reason}”</p>
      )}
    </div>
  );
}
