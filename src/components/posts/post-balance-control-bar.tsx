import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePostLedger, usePostUsage } from "@/hooks/use-post-ledger";
import {
  balanceLabel,
  labelMonth,
  openMonthSummary,
  ymOf,
  type PostLedgerRow,
} from "@/lib/post-ledger";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  ref?: Date;
};

/**
 * Compact monthly balance card used above the editorial calendar.
 *
 * The primary number is always the real amount of publications registered in
 * the displayed month. Previous balance is shown separately so it is clear
 * whether the team still owes posts from earlier months or already delivered
 * more than planned.
 */
export function PostBalanceControlBar({ clientId, ref }: Props) {
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
  const currentCount = Math.max(0, Number(summary.used) || 0);
  const previousBalance = Number(summary.previous) || 0;
  const adjustment = Number(summary.adjustment) || 0;

  // Positive previous balance means publications are still pending from prior
  // months. Negative previous balance means there was over-delivery before.
  const pendingPrevious = Math.max(0, previousBalance);
  const previousExcess = Math.max(0, -previousBalance);
  const totalToDeliver = Math.max(0, Number(summary.available) || 0);
  const remaining = Math.max(0, totalToDeliver - currentCount);
  const extras = Math.max(0, currentCount - totalToDeliver);

  const progress = totalToDeliver > 0
    ? Math.min(100, Math.round((currentCount / totalToDeliver) * 100))
    : currentCount > 0
      ? 100
      : 0;

  const oneLeft = remaining === 1 && extras === 0;
  const overPlan = extras > 0;
  const complete = remaining === 0 && extras === 0;

  const statusLabel = overPlan
    ? `${extras} publicaç${extras === 1 ? "ão" : "ões"} acima do total a entregar`
    : complete
      ? "Total previsto cadastrado"
      : `${remaining} publicaç${remaining === 1 ? "ão" : "ões"} ainda ${remaining === 1 ? "pendente" : "pendentes"}`;

  const inMonth = usage.filter((post) => {
    if (post.client_id !== clientId || !post.scheduled_date) return false;
    const [postYear, postMonth] = post.scheduled_date.split("-").map(Number);
    return postYear === year && postMonth === month && !["archived", "rejected"].includes(post.status ?? "");
  });
  const published = inMonth.filter((post) => post.status === "published").length;
  const waitingApproval = inMonth.filter((post) => post.status === "review" || post.status === "changes_requested").length;
  const metric = (title: string, value: number, explanation: string, attention = false) => (
    <div key={title} title={explanation} className="min-w-[95px] flex-1 px-2 py-1.5 sm:min-w-[116px]">
      <p className="truncate text-[10px] text-muted-foreground">{title}</p>
      <p className={cn("text-lg font-semibold leading-snug tabular-nums", attention && "text-amber-600 dark:text-amber-400")}>{value}</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Gauge className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate font-semibold">{client.name}</span>
          <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{labelMonth(year, month)}</span>
          {summary.closed && <Badge variant="secondary" className="h-5 text-[10px]">Mês fechado</Badge>}
        </div>
        <span className={cn("text-[11px] font-medium", oneLeft ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap divide-x divide-border/60 rounded-lg border border-border/50 bg-muted/10">
        {metric("Cadastradas", currentCount, "Conteúdos registrados e elegíveis à cota deste mês. Não equivale a publicados.")}
        {metric("Meta contratada", contracted, "Quantidade contratada para o mês, sem saldo anterior.")}
        {metric("Total a entregar", totalToDeliver, "Meta contratada mais saldo anterior e ajustes.")}
        {metric("Publicadas¹", published, "Posts com status Publicado no calendário. Postagem externa requer confirmação da rede social.")}
        {metric("Em aprovação", waitingApproval, "Conteúdos em revisão pelo cliente ou com ajustes solicitados.")}
        {metric("Faltam cadastrar", remaining, "Total a entregar menos conteúdos já cadastrados, não significa falta de publicação.", remaining > 0)}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Progresso de conteúdos cadastrados sobre o total a entregar"
        aria-valuemin={0}
        aria-valuemax={Math.max(totalToDeliver, 1)}
        aria-valuenow={Math.min(currentCount, Math.max(totalToDeliver, 1))}
      >
        <div className="h-full rounded-full bg-[#69139b] transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <details className="group mt-1.5 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Entenda os números e ajustes ▾</summary>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/30 p-2">
          <span>Plano: {contracted}</span>
          <span>Cadastradas: {currentCount}</span>
          <span>Meta com saldo e ajustes: {totalToDeliver}</span>
          <span>Saldo anterior: {pendingPrevious > 0 ? `${pendingPrevious} pendentes` : previousExcess > 0 ? `${previousExcess} excedentes` : "0"}</span>
          {adjustment !== 0 && <span>Ajustes: {balanceLabel(adjustment)}</span>}
          {extras > 0 && <span>Excedente atual: +{extras}</span>}
          <span>¹ "Publicado" reflete o status no RSM; a publicação externa depende de confirmação da plataforma.</span>
        </div>
      </details>
    </div>
  );
}
