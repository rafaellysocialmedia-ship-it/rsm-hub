import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { dateBR, money, todayISO, type FinanceCharge } from "@/lib/finance-core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FINANCE_KEYS = [
  "finance-charges",
  "finance-history",
  "finance-transactions",
  "header-facts",
  "retention",
  "operational-dashboard",
];

function useRefreshFinance() {
  const qc = useQueryClient();
  return () => FINANCE_KEYS.forEach((key) => void qc.invalidateQueries({ queryKey: [key] }));
}

const appendNote = (current: string | null, line: string) =>
  `${current ? current + "\n" : ""}${line}`;

/** Adds whole months to an ISO date, keeping the day when the month allows it. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Splits a total in N installments; the last one absorbs the rounding cents. */
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, i) =>
    (i === count - 1 ? cents - base * (count - 1) : base) / 100,
  );
}

/**
 * Confirmation to undo a registered payment: the charge goes back to open
 * (pendente ou vencida, conforme o vencimento) and the received amount is cleared.
 */
export function UndoPaymentDialog({
  charge,
  onClose,
}: {
  charge: FinanceCharge | null;
  onClose: () => void;
}) {
  const refresh = useRefreshFinance();
  const undo = useMutation({
    mutationFn: async () => {
      if (!charge) return;
      const { data, error } = await supabase
        .from("finance_charges")
        .update({
          status: "pending",
          paid_date: null,
          amount_received: null,
          notes: appendNote(
            charge.notes,
            `Pagamento desfeito em ${dateBR(todayISO())} (estava registrado em ${dateBR(charge.paid_date)}, ${money(charge.amount_received ?? charge.amount)}).`,
          ),
        })
        .eq("id", charge.id)
        .eq("status", "paid")
        .select("id");
      if (error) throw error;
      if (!data?.length)
        throw new Error("Esta cobrança não está mais como paga. Atualize a página e confira.");
    },
    onSuccess: () => {
      refresh();
      toast.success("Pagamento desfeito. A cobrança voltou a ficar em aberto.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={!!charge} onOpenChange={(open) => !open && !undo.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {charge && (
              <>
                {charge.description} · {money(charge.amount_received ?? charge.amount)}, pago em{" "}
                {dateBR(charge.paid_date)}. A cobrança volta a ficar em aberto com vencimento em{" "}
                {dateBR(charge.due_date)} e o valor sai do total recebido. O histórico registra a
                alteração.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={undo.isPending}>Manter como pago</AlertDialogCancel>
          <AlertDialogAction
            disabled={undo.isPending}
            onClick={(event) => {
              event.preventDefault();
              undo.mutate();
            }}
          >
            {undo.isPending ? "Desfazendo…" : "Desfazer pagamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Renegotiation of an open charge: new total, new due date and optional
 * installments. The original charge is cancelled (kept in the history) and the
 * agreement becomes new charges, so the monthly automatic billing of the
 * service is not affected.
 */
export function RenegotiateDialog({
  charge,
  onClose,
}: {
  charge: FinanceCharge | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const refresh = useRefreshFinance();
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("1");
  const [firstDue, setFirstDue] = useState(todayISO());
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!charge) return;
    setTotal(String(charge.amount ?? ""));
    setCount("1");
    setFirstDue(charge.due_date > todayISO() ? charge.due_date : todayISO());
    setReason("");
  }, [charge]);

  const value = Number(total.replace(",", "."));
  const installments = Number(count);
  const plan = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0 || !firstDue) return [];
    return splitInstallments(value, installments).map((amount, index) => ({
      amount,
      due: addMonthsISO(firstDue, index),
    }));
  }, [value, installments, firstDue]);

  const save = useMutation({
    mutationFn: async () => {
      if (!charge) return;
      if (!plan.length) throw new Error("Informe o novo valor e o vencimento.");
      if (firstDue < todayISO()) throw new Error("O novo vencimento não pode ser no passado.");
      const stamp = dateBR(todayISO());
      const summary =
        `Renegociada em ${stamp}: de ${money(charge.amount)} (venc. ${dateBR(charge.due_date)}) para ` +
        `${money(value)} em ${installments}x, 1º vencimento ${dateBR(firstDue)}.` +
        (reason.trim() ? ` Motivo: ${reason.trim()}` : "");

      const rows = plan.map((item, index) => ({
        client_id: charge.client_id,
        // Sem service_key/contract_id de propósito: a cobrança do acordo não
        // conta como a mensalidade do mês na geração automática.
        service_key: null,
        contract_id: null,
        service_label: charge.service_label,
        description:
          `${charge.description} · renegociada` +
          (installments > 1 ? ` (${index + 1}/${installments})` : ""),
        amount: item.amount,
        due_date: item.due,
        competence: charge.competence,
        payment_method_id: charge.payment_method_id,
        payment_url: null,
        notes: summary,
        status: "pending" as const,
        responsible_id: charge.responsible_id ?? user?.id ?? null,
        created_by: user?.id ?? null,
      }));
      const created = await supabase.from("finance_charges").insert(rows).select("id");
      if (created.error) throw created.error;

      const cancelled = await supabase
        .from("finance_charges")
        .update({ status: "cancelled", notes: appendNote(charge.notes, summary) })
        .eq("id", charge.id)
        .in("status", ["pending", "overdue"])
        .select("id");
      if (cancelled.error || !cancelled.data?.length) {
        // Desfaz as cobranças novas para não deixar o valor em duplicidade.
        await supabase
          .from("finance_charges")
          .delete()
          .in("id", (created.data ?? []).map((row) => row.id));
        throw (
          cancelled.error ??
          new Error("A cobrança original mudou de situação. Atualize a página e tente de novo.")
        );
      }
    },
    onSuccess: () => {
      refresh();
      toast.success(
        installments > 1
          ? `Renegociação registrada em ${installments} parcelas.`
          : "Renegociação registrada.",
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!charge} onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renegociar cobrança</DialogTitle>
          <DialogDescription>
            {charge
              ? `${charge.description} · ${money(charge.amount)} · venceu em ${dateBR(charge.due_date)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="renegotiate-total">Novo valor total (R$)</Label>
              <Input
                id="renegotiate-total"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                    <SelectItem key={n} value={n}>
                      {n === "1" ? "À vista (1x)" : `${n}x mensais`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renegotiate-due">
              {installments > 1 ? "Vencimento da 1ª parcela" : "Novo vencimento"}
            </Label>
            <Input
              id="renegotiate-due"
              type="date"
              min={todayISO()}
              value={firstDue}
              onChange={(e) => setFirstDue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renegotiate-reason">Motivo ou combinado com o cliente</Label>
            <Textarea
              id="renegotiate-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {plan.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="mb-1.5 font-medium">Como fica</p>
              <ul className="space-y-1 tabular-nums">
                {plan.map((item, index) => (
                  <li key={item.due + index} className="flex justify-between gap-3">
                    <span>
                      {installments > 1 ? `Parcela ${index + 1}/${installments}` : "Nova cobrança"} ·{" "}
                      {dateBR(item.due)}
                    </span>
                    <span className="font-medium">{money(item.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">
                A cobrança original fica como cancelada no histórico. As mensalidades dos próximos
                meses continuam sendo geradas normalmente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !plan.length}>
            {save.isPending ? "Salvando…" : "Confirmar renegociação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
