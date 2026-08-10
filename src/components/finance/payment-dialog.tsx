import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethods } from "@/hooks/use-finance";
import { money, todayISO, type FinanceCharge } from "@/lib/finance-core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function PaymentDialog({
  open,
  onOpenChange,
  charge,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  charge: FinanceCharge | null;
}) {
  const qc = useQueryClient();
  const { data: methods = [] } = usePaymentMethods(true);

  const [paidDate, setPaidDate] = useState(todayISO());
  const [received, setReceived] = useState("");
  const [methodId, setMethodId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !charge) return;
    setPaidDate(todayISO());
    setReceived(String(charge.amount ?? ""));
    setMethodId(charge.payment_method_id ?? methods.find((m) => m.is_default)?.id ?? "none");
    setNotes("");
  }, [open, charge, methods]);

  const save = useMutation({
    mutationFn: async () => {
      if (!charge) return;
      const value = Number(received.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe o valor recebido");

      const { error } = await supabase
        .from("finance_charges")
        .update({
          status: "paid",
          paid_date: paidDate,
          amount_received: value,
          payment_method_id: methodId === "none" ? null : methodId,
          notes: notes.trim()
            ? `${charge.notes ? charge.notes + "\n" : ""}${notes.trim()}`
            : charge.notes,
        })
        .eq("id", charge.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-charges"] });
      qc.invalidateQueries({ queryKey: ["finance-history"] });
      toast.success("Pagamento registrado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {charge ? `${charge.description} · ${money(charge.amount)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor recebido (R$)</Label>
            <Input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não definida</SelectItem>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
