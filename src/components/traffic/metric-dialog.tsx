import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { TrafficMetric } from "@/lib/traffic";

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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  metric?: TrafficMetric | null;
};

export function MetricDialog({ open, onOpenChange, campaignId, metric }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [date, setDate] = useState("");
  const [impressions, setImpressions] = useState("0");
  const [reach, setReach] = useState("0");
  const [clicks, setClicks] = useState("0");
  const [conversions, setConversions] = useState("0");
  const [leads, setLeads] = useState("0");
  const [spend, setSpend] = useState("0");
  const [revenue, setRevenue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(metric?.collected_at ?? new Date().toISOString().slice(0, 10));
    setImpressions(String(metric?.impressions ?? 0));
    setReach(String(metric?.reach ?? 0));
    setClicks(String(metric?.clicks ?? 0));
    setConversions(String(metric?.conversions ?? 0));
    setLeads(String(metric?.leads ?? 0));
    setSpend(String(metric?.spend ?? 0));
    setRevenue(metric?.revenue != null ? String(metric.revenue) : "");
    setNotes(metric?.notes ?? "");
  }, [open, metric]);

  const save = useMutation({
    mutationFn: async () => {
      const spendN = Number(spend || 0);
      const revenueN = revenue ? Number(revenue) : null;
      const payload = {
        campaign_id: campaignId,
        collected_at: date,
        impressions: Number(impressions || 0),
        reach: Number(reach || 0),
        clicks: Number(clicks || 0),
        conversions: Number(conversions || 0),
        leads: Number(leads || 0),
        spend: spendN,
        revenue: revenueN,
        roas: revenueN != null && spendN > 0 ? Number((revenueN / spendN).toFixed(2)) : null,
        notes: notes.trim() || null,
      };
      if (metric) {
        const { error } = await supabase.from("traffic_metrics").update(payload).eq("id", metric.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("traffic_metrics")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["traffic-metrics"] });
      toast.success("Métricas salvas");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (label: string, value: string, set: (v: string) => void, step = "1") => (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{metric ? "Editar métricas" : "Registrar métricas"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Data de referência</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Impressões", impressions, setImpressions)}
            {field("Alcance", reach, setReach)}
            {field("Cliques", clicks, setClicks)}
            {field("Conversões", conversions, setConversions)}
            {field("Leads", leads, setLeads)}
            {field("Investimento (R$)", spend, setSpend, "0.01")}
            {field("Receita (R$) — opcional", revenue, setRevenue, "0.01")}
          </div>
          <p className="text-xs text-muted-foreground">
            CPC, CPM, CTR, CPA e ROAS são calculados automaticamente a partir destes valores.
          </p>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={save.isPending || !date} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
