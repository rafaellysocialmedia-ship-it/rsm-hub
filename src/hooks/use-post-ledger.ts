import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { PostLedgerRow, UsagePost } from "@/lib/post-ledger";

/** Monthly ledger rows. RLS already scopes clients to their own history. */
export function usePostLedger(clientId?: string | null) {
  return useQuery({
    queryKey: ["post-ledger", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("client_post_ledger")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PostLedgerRow[];
    },
  });
}

/** Minimal post rows used for quota counting. */
export function usePostUsage(clientId?: string | null) {
  const qc = useQueryClient();
  const usageKey = ["post-usage", clientId ?? "all"] as const;

  // Keep the quota/count query synchronized with the posts table. The calendar
  // uses a different React Query key ("posts"), so invalidating only that key
  // leaves the balance counter stale after creating, deleting or moving posts.
  useEffect(() => {
    const channel = supabase
      .channel(`post-usage-rt-${clientId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}),
        },
        () => {
          qc.invalidateQueries({ queryKey: usageKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, qc]);

  return useQuery({
    queryKey: usageKey,
    queryFn: async () => {
      let q = supabase.from("posts").select("client_id,status,scheduled_date");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UsagePost[];
    },
  });
}
