import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePostLedger, usePostUsage } from "@/hooks/use-post-ledger";
import {
  balanceLabel,
  balanceTone,
  labelMonth,
  noteOf,
  openMonthSummary,
  ymOf,
  type PostLedgerRow,
} from "@/lib/post-ledger";
import { useAuth } from "@/hooks/use-auth";
import { QuotaNumber } from "@/components/clients/quota-number";
import { BalanceAdjustDialog } from "@/components/clients/balance-adjust-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  clientId: string;
  ref?: Date;
};

/**
 * Compact horizontal control bar that shows the selected client's monthly
 * post balance right inside the calendar. Follows the same counting rules as
 * the rest of the app so the numbers never drift from the ledger.
 */
export function PostBalanceControlBar({ clientId, ref }: Props) {
  const { hasRole } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");
  const { year, month } = ymOf(ref ?? new Date());

  const { data: client, isLoading } = useQuery({
    queryKey: ["client-post-balance", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("monthly_post_quota,start_date,name")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ledger = [] } = usePostLedger(clientId);
  const { data: usage = [] } = usePostUsage(clientId);

  const summary = openMonthSummary({
    clientId,
    contracted: client?.monthly_post_quota ?? 0,
    ledger: ledger as PostLedgerRow[],
    posts: usage,
    ref,
    since: client?.start_date ?? null,
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!client || summary.contracted <= 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Gauge className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{client.name}</p>
            <Badge variant="outline" className="text-[10px] font-normal capitalize">
              {labelMonth(year, month)}
            </Badge>
            {summary.closed && (
              <Badge variant="secondary" className="text-[10px]">Mês fechado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Saldo de publicações do mês</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <QuotaNumber label="Contratados" value={summary.contracted} />
        <QuotaNumber
          label="Mês anterior"
          value={balanceLabel(summary.previous)}
          tone={balanceTone(summary.previous)}
        />
        <QuotaNumber
          label="Ajuste"
          value={balanceLabel(summary.adjustment)}
          tone={balanceTone(summary.adjustment)}
        />
        <QuotaNumber label="Utilizados" value={summary.used} />
        <QuotaNumber
          label="Remaining balance"
          value={balanceLabel(summary.balance)}
          tone={balanceTone(summary.balance)}
        />
        {isStaff && !summary.closed && (
          <BalanceAdjustDialog
            clientId={clientId}
            year={year}
            month={month}
            contracted={summary.contracted}
            previous={summary.previous}
            used={summary.used}
            adjustment={summary.adjustment}
            note={noteOf(ledger as PostLedgerRow[], clientId, year, month)}
          />
        )}
      </div>
    </div>
  );
}
