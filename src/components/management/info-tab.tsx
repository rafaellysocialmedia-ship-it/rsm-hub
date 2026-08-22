import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/clients";
import { formatCNPJ } from "@/lib/clients";
import { BR_STATES, COMPANY_SIZES } from "@/lib/client-master";
import { useStaffMembers } from "@/hooks/use-staff";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "./master-shared";

type Extra = {
  trade_name: string;
  state_registration: string;
  company_size: string;
  responsible_role: string;
  zip_code: string;
  city: string;
  state: string;
  address: string;
  account_manager_id: string;
  social_manager_id: string;
  traffic_manager_id: string;
};

type FormState = Extra & {
  legal_name: string;
  cnpj: string;
  segment: string;
  responsible: string;
  phone: string;
  whatsapp: string;
  email: string;
  notes: string;
};

function toForm(client: Client): FormState {
  const c = client as Client & Partial<Record<keyof Extra, string | null>>;
  return {
    legal_name: client.legal_name ?? "",
    trade_name: c.trade_name ?? "",
    cnpj: client.cnpj ?? "",
    state_registration: c.state_registration ?? "",
    segment: client.segment ?? "",
    company_size: c.company_size ?? "",
    responsible: client.responsible ?? "",
    responsible_role: c.responsible_role ?? "",
    phone: client.phone ?? "",
    whatsapp: client.whatsapp ?? "",
    email: client.email ?? "",
    zip_code: c.zip_code ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    address: c.address ?? "",
    notes: client.notes ?? "",
    account_manager_id: c.account_manager_id ?? "",
    social_manager_id: c.social_manager_id ?? "",
    traffic_manager_id: c.traffic_manager_id ?? "",
  };
}

export function InfoTab({ client, canEdit }: { client: Client; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: staff = [] } = useStaffMembers();
  const [form, setForm] = useState<FormState>(() => toForm(client));

  useEffect(() => setForm(toForm(client)), [client]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]),
      );
      const { error } = await supabase
        .from("clients")
        .update(payload as never)
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client-timeline", client.id] });
      toast.success("Informações atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const staffOptions = (
    <>
      <SelectItem value="none">— Nenhum —</SelectItem>
      {staff.map((s) => (
        <SelectItem key={s.id} value={s.id}>
          {s.name || s.email || s.id.slice(0, 8)}
        </SelectItem>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Dados da empresa" collapsible>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <F label="Razão Social">
            <Input
              disabled={!canEdit}
              value={form.legal_name}
              onChange={(e) => set("legal_name")(e.target.value)}
            />
          </F>
          <F label="Nome Fantasia">
            <Input
              disabled={!canEdit}
              value={form.trade_name}
              onChange={(e) => set("trade_name")(e.target.value)}
            />
          </F>
          <F label="CNPJ">
            <Input
              disabled={!canEdit}
              value={form.cnpj}
              onChange={(e) => set("cnpj")(formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </F>
          <F label="Inscrição Estadual">
            <Input
              disabled={!canEdit}
              value={form.state_registration}
              onChange={(e) => set("state_registration")(e.target.value)}
            />
          </F>
          <F label="Segmento">
            <Input
              disabled={!canEdit}
              value={form.segment}
              onChange={(e) => set("segment")(e.target.value)}
            />
          </F>
          <F label="Porte">
            <Select
              disabled={!canEdit}
              value={form.company_size || "none"}
              onValueChange={(v) => set("company_size")(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Não definido —</SelectItem>
                {COMPANY_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
        </div>
      </SectionCard>

      <SectionCard title="Contato" collapsible>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <F label="Responsável">
            <Input
              disabled={!canEdit}
              value={form.responsible}
              onChange={(e) => set("responsible")(e.target.value)}
            />
          </F>
          <F label="Cargo">
            <Input
              disabled={!canEdit}
              value={form.responsible_role}
              onChange={(e) => set("responsible_role")(e.target.value)}
            />
          </F>
          <F label="Telefone">
            <Input
              disabled={!canEdit}
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
            />
          </F>
          <F label="WhatsApp">
            <Input
              disabled={!canEdit}
              value={form.whatsapp}
              onChange={(e) => set("whatsapp")(e.target.value)}
            />
          </F>
          <F label="E-mail">
            <Input
              disabled={!canEdit}
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
            />
          </F>
        </div>
      </SectionCard>

      <SectionCard title="Endereço" collapsible>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <F label="CEP">
            <Input
              disabled={!canEdit}
              value={form.zip_code}
              onChange={(e) => set("zip_code")(e.target.value)}
              placeholder="00000-000"
            />
          </F>
          <F label="Cidade">
            <Input
              disabled={!canEdit}
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
            />
          </F>
          <F label="Estado">
            <Select
              disabled={!canEdit}
              value={form.state || "none"}
              onValueChange={(v) => set("state")(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Não definido —</SelectItem>
                {BR_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Endereço completo">
            <Input
              disabled={!canEdit}
              value={form.address}
              onChange={(e) => set("address")(e.target.value)}
            />
          </F>
        </div>
      </SectionCard>

      <SectionCard title="Responsáveis internos" description="Time principal da conta" collapsible>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <F label="Atendimento">
            <Select
              disabled={!canEdit}
              value={form.account_manager_id || "none"}
              onValueChange={(v) => set("account_manager_id")(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>{staffOptions}</SelectContent>
            </Select>
          </F>
          <F label="Social Media">
            <Select
              disabled={!canEdit}
              value={form.social_manager_id || "none"}
              onValueChange={(v) => set("social_manager_id")(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>{staffOptions}</SelectContent>
            </Select>
          </F>
          <F label="Tráfego">
            <Select
              disabled={!canEdit}
              value={form.traffic_manager_id || "none"}
              onValueChange={(v) => set("traffic_manager_id")(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>{staffOptions}</SelectContent>
            </Select>
          </F>
        </div>
      </SectionCard>

      <SectionCard title="Observações" description="Anotações internas da equipe" collapsible>
        <Textarea
          disabled={!canEdit}
          rows={5}
          value={form.notes}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="Contexto, histórico e alinhamentos importantes…"
        />
      </SectionCard>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar informações
          </Button>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
