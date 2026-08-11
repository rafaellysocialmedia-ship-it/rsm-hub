import { useQuery } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: ["post-usage", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("posts").select("client_id,status,scheduled_date");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UsagePost[];
    },
  });
}
