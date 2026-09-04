import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { balanceLabel, labelMonth } from "@/lib/post-ledger";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  clientId: string;
  year: number;
  month: number;
  contracted: number;
  previous: number;
  used: number;
  adjustment: number;
  note?: string | null;
  disabled?: boolean;
};

/**
 * Manual correction of the monthly post balance. Team-only: writes the
 * adjustment into client_post_ledger for the given month.
 */
export function BalanceAdjustDialog({
  clientId, year, month, contracted, previous, used, adjustment, note, disabled,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(adjustment));
  const [reason, setReason] = useState(note ?? "");

  useEffect(() => {
    if (!open) return;
    setValue(String(adjustment));
    setReason(note ?? "");
  }, [open, adjustment, note]);

  const parsed = Number.parseInt(value, 10);
  const delta = Number.isNaN(parsed) ? 0 : parsed;
  const preview = contracted + previous + delta - used;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_post_ledger").upsert(
        {
          client_id: clientId,
          year,
          month,
          contracted,
          used,
          previous_balance: previous,
          balance: preview,
          adjustment: delta,
          adjustment_note: reason.trim() || null,
        },
        { onConflict: "client_id,year,month" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saldo atualizado");
      qc.invalidateQueries({ queryKey: ["post-ledger"] });
      setOpen(false);
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Não foi possível salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8" disabled={disabled}>
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
          Ajustar saldo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar saldo de publicações</DialogTitle>
          <DialogDescription className="capitalize">{labelMonth(year, month)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">Contratados</p>
              <p className="text-base font-semibold tabular-nums">{contracted}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Mês anterior</p>
              <p className="text-base font-semibold tabular-nums">{balanceLabel(previous)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Utilizados</p>
              <p className="text-base font-semibold tabular-nums">{used}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Correção manual</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={() => setValue(String(delta - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^-\d]/g, ""))}
                className="w-24 text-center tabular-nums"
                inputMode="numeric"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={() => setValue(String(delta + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="ml-2 text-xs text-muted-foreground">
                Saldo final: <strong className="tabular-nums">{balanceLabel(preview)}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Ex.: 3 posts extras negociados em setembro"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
