import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { useTrafficClients } from "@/hooks/use-traffic";
import {
  LEAD_STAGES,
  PLATFORMS,
  type TrafficLead,
  type TrafficLeadStage,
  type TrafficPlatform,
} from "@/lib/traffic";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: TrafficLead | null;
  defaultStage?: TrafficLeadStage;
  defaultClientId?: string | null;
};

export function LeadDialog({ open, onOpenChange, lead, defaultStage, defaultClientId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useTrafficClients();
  const { data: staff = [] } = useStaffMembers();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [campaignId, setCampaignId] = useState("none");
  const [platform, setPlatform] = useState<TrafficPlatform | "none">("none");
  const [stage, setStage] = useState<TrafficLeadStage>("new");
  const [owner, setOwner] = useState("none");
  const [notes, setNotes] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["traffic-campaigns", "for-lead", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? "");
    setClientId(lead?.client_id ?? defaultClientId ?? "");
    setPhone(lead?.phone ?? "");
    setEmail(lead?.email ?? "");
    setSource(lead?.source ?? "");
    setCampaignId(lead?.campaign_id ?? "none");
    setPlatform(lead?.platform ?? "none");
    setStage(lead?.stage ?? defaultStage ?? "new");
    setOwner(lead?.owner_id ?? "none");
    setNotes(lead?.notes ?? "");
  }, [open, lead, defaultStage, defaultClientId]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source: source.trim() || null,
        campaign_id: campaignId === "none" ? null : campaignId,
        platform: platform === "none" ? null : platform,
        stage,
        owner_id: owner === "none" ? null : owner,
        notes: notes.trim() || null,
      };
      if (lead) {
        const { error } = await supabase.from("traffic_leads").update(payload).eq("id", lead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("traffic_leads")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["traffic-leads"] });
      toast.success(lead ? "Lead atualizado" : "Lead criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("traffic_leads").delete().eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["traffic-leads"] });
      toast.success("Lead removido");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etapa</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as TrafficLeadStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Origem</Label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Ex.: Formulário Meta"
              />
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as TrafficPlatform | "none")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informada</SelectItem>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campanha</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem campanha</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {lead ? (
            <Button variant="ghost" className="text-destructive" onClick={() => remove.mutate()}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!name.trim() || !clientId || save.isPending}
              onClick={() => save.mutate()}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
