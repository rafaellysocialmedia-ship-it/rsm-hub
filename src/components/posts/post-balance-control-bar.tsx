import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePostLedger, usePostUsage } from "@/hooks/use-post-ledger";
import {
  balanceLabel,
  labelMonth,
  noteOf,
  openMonthSummary,
  ymOf,
  type PostLedgerRow,
} from "@/lib/post-ledger";
import { useAuth } from "@/hooks/use-auth";
import { BalanceAdjustDialog } from "@/components/clients/balance-adjust-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  ref?: Date;
};

/**
 * Compact monthly balance card used above the editorial calendar.
 * The main visual answers two questions immediately: how much was used and
 * how much remains. Carry-over and manual adjustments stay visible as
 * secondary information without competing with the monthly quota.
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

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!client || summary.contracted <= 0) return null;

  const contracted = Math.max(0, Number(summary.contracted) || 0);
  const used = Math.max(0, Number(summary.used) || 0);
  const balance = Number(summary.balance) || 0;
  const remaining = Math.max(0, balance);
  const extras = Math.max(0, -balance);
  const progress = contracted > 0 ? Math.min(100, Math.round((used / contracted) * 100)) : 0;
  const oneLeft = remaining === 1 && extras === 0;
  const planUsed = remaining === 0 && extras === 0;
  const overPlan = extras > 0;

  const statusLabel = overPlan
    ? `+${extras} extra${extras === 1 ? "" : "s"}`
    : planUsed
      ? "Plano utilizado"
      : oneLeft
        ? "Última publicação disponível"
        : `${progress}% do plano utilizado`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/10">
            <Gauge className="h-5 w-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{client.name}</p>
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

        {isStaff && !summary.closed && (
          <div className="shrink-0">
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
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              <span className="text-base">{used}</span> de {contracted} publicações utilizadas
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs font-medium",
                overPlan
                  ? "text-violet-700 dark:text-violet-300"
                  : oneLeft
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {statusLabel}
            </p>
          </div>

          <div className="text-right">
            {overPlan ? (
              <>
                <p className="text-lg font-semibold text-violet-700 dark:text-violet-300">+{extras}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">extras</p>
              </>
            ) : (
              <>
                <p className={cn("text-lg font-semibold", oneLeft && "text-amber-600 dark:text-amber-400")}>{remaining}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">disponíveis</p>
              </>
            )}
          </div>
        </div>

        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/50"
          role="progressbar"
          aria-label="Uso do plano mensal de publicações"
          aria-valuemin={0}
          aria-valuemax={contracted}
          aria-valuenow={Math.min(used, contracted)}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-500 ease-out",
              overPlan
                ? "bg-violet-700"
                : oneLeft
                  ? "bg-amber-500"
                  : "bg-violet-600",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><span className="text-muted-foreground">Contratadas:</span> <strong>{contracted}</strong></span>
            <span><span className="text-muted-foreground">Utilizadas:</span> <strong>{used}</strong></span>
            <span>
              <span className="text-muted-foreground">Disponíveis:</span>{" "}
              <strong className={cn(overPlan && "text-violet-700 dark:text-violet-300", oneLeft && "text-amber-600 dark:text-amber-400")}>{remaining}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>Mês anterior: {balanceLabel(summary.previous)}</span>
            <span>Ajustes: {balanceLabel(summary.adjustment)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
