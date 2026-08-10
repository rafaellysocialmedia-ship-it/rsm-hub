import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useClientServices, useFinanceClients } from "@/hooks/use-finance";
import { SERVICE_CATALOG } from "@/lib/client-master";
import {
  CONTRACT_STATUS_META,
  PERIODICITY_OPTIONS,
  todayISO,
  type ContractStatus,
  type FinanceContract,
  type Periodicity,
} from "@/lib/finance-core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export function ContractDialog({
  open,
  onOpenChange,
  contract,
  fixedClientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract?: FinanceContract | null;
  fixedClientId?: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useFinanceClients();

  const [clientId, setClientId] = useState(fixedClientId ?? "");
  const [number, setNumber] = useState("");
  const [serviceKey, setServiceKey] = useState("none");
  const [amount, setAmount] = useState("");
  const [periodicity, setPeriodicity] = useState<Periodicity>("monthly");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [status, setStatus] = useState<ContractStatus>("active");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: services = [] } = useClientServices(clientId || null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (contract) {
      setClientId(contract.client_id);
      setNumber(contract.contract_number ?? "");
      setServiceKey(contract.service_key ?? "none");
      setAmount(String(contract.amount ?? ""));
      setPeriodicity(contract.periodicity);
      setStartDate(contract.start_date ?? todayISO());
      setEndDate(contract.end_date ?? "");
      setDueDay(String(contract.due_day ?? 10));
      setStatus(contract.status);
      setNotes(contract.notes ?? "");
    } else {
      setClientId(fixedClientId ?? "");
      setNumber("");
      setServiceKey("none");
      setAmount("");
      setPeriodicity("monthly");
      setStartDate(todayISO());
      setEndDate("");
      setDueDay("10");
      setStatus("active");
      setNotes("");
    }
  }, [open, contract, fixedClientId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione o cliente");
      const value = Number(amount.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) throw new Error("Informe um valor válido");

      let storagePath = contract?.storage_path ?? null;
      let fileName = contract?.file_name ?? null;
      if (file) {
        const path = `${clientId}/contracts/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("client-contracts")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        storagePath = path;
        fileName = file.name;
      }

      const payload = {
        client_id: clientId,
        contract_number: number.trim() || null,
        service_key: serviceKey === "none" ? null : serviceKey,
        service_label:
          serviceKey === "none"
            ? null
            : SERVICE_CATALOG.find((s) => s.key === serviceKey)?.label ?? serviceKey,
        amount: value,
        periodicity,
        start_date: startDate || null,
        end_date: endDate || null,
        due_day: Number(dueDay) || null,
        status,
        notes: notes.trim() || null,
        storage_path: storagePath,
        file_name: fileName,
      };

      if (contract) {
        const { error } = await supabase
          .from("finance_contracts")
          .update(payload)
          .eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("finance_contracts")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-contracts"] });
      qc.invalidateQueries({ queryKey: ["finance-history"] });
      toast.success(contract ? "Contrato atualizado" : "Contrato criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{contract ? "Editar contrato" : "Novo contrato"}</DialogTitle>
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
            <Label>Número do contrato</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="CT-2026-001" />
          </div>

          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select value={serviceKey} onValueChange={setServiceKey}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem serviço vinculado</SelectItem>
                {(services.length
                  ? services.map((s) => ({ key: s.service_key, label: s.label ?? s.service_key }))
                  : SERVICE_CATALOG
                ).map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {SERVICE_CATALOG.find((c) => c.key === s.key)?.label ?? s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          <div className="space-y-1.5">
            <Label>Periodicidade</Label>
            <Select value={periodicity} onValueChange={(v) => setPeriodicity(v as Periodicity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODICITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dia de vencimento</Label>
            <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Término</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTRACT_STATUS_META) as ContractStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{CONTRACT_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo do contrato</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {contract?.file_name && !file && (
              <p className="text-[11px] text-muted-foreground">Atual: {contract.file_name}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
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
