import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePaymentMethods, useClientServices, useFinanceClients } from "@/hooks/use-finance";
import { SERVICE_CATALOG } from "@/lib/client-master";
import { todayISO, type FinanceCharge } from "@/lib/finance-core";

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

function serviceLabelFor(key: string, fallback?: string | null) {
  return SERVICE_CATALOG.find((s) => s.key === key)?.label ?? fallback ?? key;
}

export function ChargeDialog({
  open,
  onOpenChange,
  charge,
  fixedClientId,
  contractId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  charge?: FinanceCharge | null;
  fixedClientId?: string;
  contractId?: string | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useFinanceClients();
  const { data: methods = [] } = usePaymentMethods(true);

  const [clientId, setClientId] = useState(fixedClientId ?? "");
  const [serviceKey, setServiceKey] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [methodId, setMethodId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  const { data: services = [] } = useClientServices(clientId || null);

  useEffect(() => {
    if (!open) return;
    if (charge) {
      setClientId(charge.client_id);
      setServiceKey(charge.service_key ?? "none");
      setDescription(charge.description);
      setAmount(String(charge.amount ?? ""));
      setDueDate(charge.due_date);
      setMethodId(charge.payment_method_id ?? "none");
      setNotes(charge.notes ?? "");
    } else {
      setClientId(fixedClientId ?? "");
      setServiceKey("none");
      setDescription("");
      setAmount("");
      setDueDate(todayISO());
      setMethodId(methods.find((m) => m.is_default)?.id ?? "none");
      setNotes("");
    }
  }, [open, charge, fixedClientId, methods]);

  const save = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione o cliente");
      if (description.trim().length < 2) throw new Error("Informe a descrição");
      const value = Number(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor válido");

      const payload = {
        client_id: clientId,
        contract_id: contractId ?? charge?.contract_id ?? null,
        service_key: serviceKey === "none" ? null : serviceKey,
        service_label: serviceKey === "none" ? null : serviceLabelFor(serviceKey),
        description: description.trim(),
        amount: value,
        due_date: dueDate,
        payment_method_id: methodId === "none" ? null : methodId,
        notes: notes.trim() || null,
      };

      if (charge) {
        const { error } = await supabase.from("finance_charges").update(payload).eq("id", charge.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_charges").insert({
          ...payload,
          responsible_id: user?.id ?? null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-charges"] });
      qc.invalidateQueries({ queryKey: ["finance-history"] });
      toast.success(charge ? "Cobrança atualizada" : "Cobrança criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{charge ? "Editar cobrança" : "Nova cobrança"}</DialogTitle>
          <DialogDescription>
            Os serviços disponíveis vêm do cadastro do cliente na Central de Clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={!!fixedClientId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select value={serviceKey} onValueChange={setServiceKey}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem serviço vinculado</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.service_key}>
                    {serviceLabelFor(s.service_key, s.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientId && services.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Este cliente ainda não possui serviços cadastrados.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Social Media — Agosto/2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          <div className="space-y-1.5">
            <Label>Vencimento</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observação</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
