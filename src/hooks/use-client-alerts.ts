import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRetention } from "@/hooks/use-retention";
import { buildClientAlerts, type ClientAlert } from "@/lib/client-alerts";
import { monthOverflow, type OrderedUsagePost, type PostLedgerRow } from "@/lib/post-ledger";
import type { RetentionAccount } from "@/lib/retention";

/**
 * Publications above the monthly plan, per client, for the current month.
 * Pass a clientId to load only that account.
 */
export function useQuotaExtras(clientId?: string) {
  const { hasRole } = useAuth();
  const enabled = hasRole("administrator") || hasRole("team");
  return useQuery({
    queryKey: ["client-alerts-quota", clientId ?? "all"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      let clients = supabase.from("clients").select("id,monthly_post_quota,start_date");
      let posts = supabase.from("posts").select("id,client_id,status,scheduled_date,scheduled_time");
      let ledger = supabase.from("client_post_ledger").select("*");
      if (clientId) {
        clients = clients.eq("id", clientId);
        posts = posts.eq("client_id", clientId);
        ledger = ledger.eq("client_id", clientId);
      } else {
        clients = clients.gt("monthly_post_quota", 0);
      }
      const [c, p, l] = await Promise.all([clients, posts, ledger]);
      if (c.error) throw c.error;
      if (p.error) throw p.error;
      if (l.error) throw l.error;
      const map = new Map<string, number>();
      for (const client of c.data ?? []) {
        const contracted = client.monthly_post_quota ?? 0;
        if (contracted <= 0) continue;
        const { extras } = monthOverflow({
          clientId: client.id,
          contracted,
          ledger: (l.data ?? []) as PostLedgerRow[],
          posts: (p.data ?? []) as OrderedUsagePost[],
          since: client.start_date,
        });
        if (extras > 0) map.set(client.id, extras);
      }
      return map;
    },
  });
}

/** Alerts of every active client (keyed by client id) plus the retention row. */
export function useClientAlerts(clientId?: string) {
  const retention = useRetention();
  const quota = useQuotaExtras(clientId);
  const byClient = useMemo(() => {
    const accounts = (retention.data ?? []) as unknown as RetentionAccount[];
    const map = new Map<string, { account?: RetentionAccount; alerts: ClientAlert[] }>();
    for (const account of accounts) {
      if (clientId && account.client_id !== clientId) continue;
      map.set(account.client_id, {
        account,
        alerts: buildClientAlerts(account, { quotaExtras: quota.data?.get(account.client_id) }),
      });
    }
    for (const [id, extras] of quota.data ?? []) {
      if (!map.has(id) && (!clientId || id === clientId))
        map.set(id, { alerts: buildClientAlerts(undefined, { quotaExtras: extras }) });
    }
    return map;
  }, [retention.data, quota.data, clientId]);
  return {
    byClient,
    isLoading: retention.isLoading,
    error: retention.error ?? quota.error,
  };
}
