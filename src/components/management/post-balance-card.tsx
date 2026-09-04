import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePostLedger, usePostUsage } from "@/hooks/use-post-ledger";
import {
  balanceLabel, balanceTone, labelMonth, openMonthSummary, ymOf,
  type PostLedgerRow,
} from "@/lib/post-ledger";
import { QuotaNumber } from "@/components/clients/quota-number";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { clientId: string; canEdit?: boolean };

/**
 * Post balance of the current month with a manual correction field, so the
 * internal team can fix the number whenever the automatic count is off.
 */
export function PostBalanceCard({ clientId, canEdit }: Props) {
  const qc = useQueryClient();
  const { year, month } = ymOf();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client-post-balance", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("monthly_post_quota,start_date")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: ledger = [] } = usePostLedger(clientId);
  const { data: usage = [] } = usePostUsage(clientId);

  const contracted = client?.monthly_post_quota ?? 0;
  const summary = openMonthSummary({
    clientId,
    contracted,
    ledger: ledger as PostLedgerRow[],
    posts: usage,
    since: client?.start_date ?? null,
  });

  const [adjustment, setAdjustment] = useState(String(summary.adjustment));
  const [note, setNote] = useState("");
  const stored = (ledger as PostLedgerRow[]).find(
    (r) => r.year === year && r.month === month,
  );

  useEffect(() => {
    setAdjustment(String(summary.adjustment));
    setNote(stored?.adjustment_note ?? "");
  }, [summary.adjustment, stored?.adjustment_note]);

  const save = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("client_post_ledger")
        .upsert(
          {
            client_id: clientId,
            year,
            month,
            contracted: summary.contracted,
            used: summary.used,
            previous_balance: summary.previous,
            balance: summary.contracted + summary.previous + value - summary.used,
            adjustment: value,
            adjustment_note: note.trim() || null,
          },
          { onConflict: "client_id,year,month" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saldo de publicações atualizado");
      qc.invalidateQueries({ queryKey: ["post-ledger"] });
      qc.invalidateQueries({ queryKey: ["client-month-posts", clientId] });
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Não foi possível salvar"),
  });

  if (isLoading) return <Skeleton className="h-56 w-full rounded-xl" />;
  if (contracted <= 0) return null;

  const parsed = Number.parseInt(adjustment, 10);
  const value = Number.isNaN(parsed) ? 0 : parsed;
  const preview = summary.contracted + summary.previous + value - summary.used;
  const pct =
    summary.available > 0 ? Math.min(100, Math.round((summary.used / summary.available) * 100)) : 0;

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-primary" /> Publicações do mês
          </CardTitle>
          <p className="mt-1 text-xs capitalize text-muted-foreground">
            {labelMonth(summary.year, summary.month)}
          </p>
        </div>
        {summary.closed && <Badge variant="secondary" className="text-[10px]">Mês fechado</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
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
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${summary.balance < 0 ? "bg-rose-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {canEdit && (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Correção manual</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() => setAdjustment(String(value - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    value={adjustment}
                    onChange={(e) => setAdjustment(e.target.value.replace(/[^-\d]/g, ""))}
                    className="w-20 text-center tabular-nums"
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() => setAdjustment(String(value + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="min-w-[180px] flex-1 space-y-1.5">
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex.: 2 posts entregues fora do sistema"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Remaining balance após a correção:{" "}
                <span className={`font-semibold ${balanceTone(preview)}`}>{balanceLabel(preview)}</span>
              </p>
              <div className="flex items-center gap-2">
                {value !== 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs"
                    onClick={() => {
                      setAdjustment("0");
                      setNote("");
                      save.mutate(0);
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Zerar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={save.isPending}
                  onClick={() => save.mutate(value)}
                >
                  {save.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Salvar correção
                </Button>
              </div>
            </div>
          </div>
        )}

        {!canEdit && stored?.adjustment_note && (
          <p className="text-xs text-muted-foreground">Correção: {stored.adjustment_note}</p>
        )}
      </CardContent>
    </Card>
  );
}
