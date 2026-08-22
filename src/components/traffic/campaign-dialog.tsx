import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { useTrafficClients } from "@/hooks/use-traffic";
import {
  CAMPAIGN_STATUS,
  OBJECTIVES,
  PLATFORMS,
  type TrafficCampaign,
  type TrafficCampaignStatus,
  type TrafficObjective,
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
  campaign?: TrafficCampaign | null;
  defaultClientId?: string | null;
};

export function CampaignDialog({ open, onOpenChange, campaign, defaultClientId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useTrafficClients();
  const { data: staff = [] } = useStaffMembers();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState<TrafficPlatform>("meta_ads");
  const [objective, setObjective] = useState<TrafficObjective>("leads");
  const [status, setStatus] = useState<TrafficCampaignStatus>("setup");
  const [daily, setDaily] = useState("");
  const [total, setTotal] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [owner, setOwner] = useState("none");
  const [notes, setNotes] = useState("");
  const [landingPageId, setLandingPageId] = useState("none");

  useEffect(() => {
    if (!open) return;
    setName(campaign?.name ?? "");
    setClientId(campaign?.client_id ?? defaultClientId ?? "");
    setPlatform(campaign?.platform ?? "meta_ads");
    setObjective(campaign?.objective ?? "leads");
    setStatus(campaign?.status ?? "setup");
    setDaily(campaign?.daily_budget != null ? String(campaign.daily_budget) : "");
    setTotal(campaign?.total_budget != null ? String(campaign.total_budget) : "");
    setStart(campaign?.start_date ?? "");
    setEnd(campaign?.end_date ?? "");
    setOwner(campaign?.owner_id ?? "none");
    setNotes(campaign?.notes ?? "");
    setLandingPageId(
      (campaign as { landing_page_id?: string | null } | null | undefined)?.landing_page_id ?? "none",
    );
  }, [open, campaign, defaultClientId]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        name: name.trim(),
        platform,
        objective,
        status,
        daily_budget: daily ? Number(daily) : null,
        total_budget: total ? Number(total) : null,
        start_date: start || null,
        end_date: end || null,
        owner_id: owner === "none" ? null : owner,
        notes: notes.trim() || null,
        landing_page_id: landingPageId === "none" ? null : landingPageId,
      };
      if (campaign) {
        const { error } = await supabase
          .from("traffic_campaigns")
          .update(payload)
          .eq("id", campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("traffic_campaigns")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["traffic-campaigns"] });
      toast.success(campaign ? "Campanha atualizada" : "Campanha criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = !name.trim() || !clientId || save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leads — Setembro" />
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as TrafficPlatform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Objetivo</Label>
              <Select value={objective} onValueChange={(v) => setObjective(v as TrafficObjective)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TrafficCampaignStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
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
            <div>
              <Label>Investimento diário (R$)</Label>
              <Input type="number" step="0.01" value={daily} onChange={(e) => setDaily(e.target.value)} />
            </div>
            <div>
              <Label>Investimento total (R$)</Label>
              <Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Encerramento</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={disabled} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
