import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

export type Baseline = Database["public"]["Tables"]["client_baselines"]["Row"];

const networks = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
];

export function BaselineDialog({
  open,
  onOpenChange,
  clientId,
  baseline,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  baseline: Baseline | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    network: baseline?.network ?? "instagram",
    captured_at: baseline?.captured_at ?? new Date().toISOString().slice(0, 10),
    followers: baseline?.followers ?? 0,
    avg_reach: baseline?.avg_reach ?? 0,
    avg_impressions: baseline?.avg_impressions ?? 0,
    avg_likes: baseline?.avg_likes ?? 0,
    avg_comments: baseline?.avg_comments ?? 0,
    avg_shares: baseline?.avg_shares ?? 0,
    avg_saves: baseline?.avg_saves ?? 0,
    engagement_rate: baseline?.engagement_rate ?? 0,
    notes: baseline?.notes ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        network: baseline?.network ?? "instagram",
        captured_at: baseline?.captured_at ?? new Date().toISOString().slice(0, 10),
        followers: baseline?.followers ?? 0,
        avg_reach: baseline?.avg_reach ?? 0,
        avg_impressions: baseline?.avg_impressions ?? 0,
        avg_likes: baseline?.avg_likes ?? 0,
        avg_comments: baseline?.avg_comments ?? 0,
        avg_shares: baseline?.avg_shares ?? 0,
        avg_saves: baseline?.avg_saves ?? 0,
        engagement_rate: Number(baseline?.engagement_rate ?? 0),
        notes: baseline?.notes ?? "",
      });
    }
  }, [open, baseline]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, client_id: clientId };
      if (baseline) {
        const { error } = await supabase.from("client_baselines").update(payload).eq("id", baseline.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_baselines").upsert(payload, { onConflict: "client_id,network" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Baseline salvo");
      queryClient.invalidateQueries({ queryKey: ["client-baselines"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const num = (k: keyof typeof form) => (
    <Input
      type="number"
      value={form[k] as number}
      onChange={(e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) }))}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{baseline ? "Editar métricas iniciais" : "Registrar métricas iniciais"}</DialogTitle>
          <DialogDescription>Snapshot do perfil no primeiro acesso para comparar com o desempenho atual.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <Label>Rede</Label>
            <Select value={form.network} onValueChange={(v) => setForm((f) => ({ ...f, network: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {networks.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label>Data</Label>
            <Input type="date" value={form.captured_at} onChange={(e) => setForm((f) => ({ ...f, captured_at: e.target.value }))} />
          </div>
          <div><Label>Seguidores</Label>{num("followers")}</div>
          <div><Label>Alcance médio</Label>{num("avg_reach")}</div>
          <div><Label>Impressões médias</Label>{num("avg_impressions")}</div>
          <div><Label>Curtidas médias</Label>{num("avg_likes")}</div>
          <div><Label>Comentários médios</Label>{num("avg_comments")}</div>
          <div><Label>Compart. médios</Label>{num("avg_shares")}</div>
          <div><Label>Salvamentos médios</Label>{num("avg_saves")}</div>
          <div><Label>Taxa engajamento (%)</Label>
            <Input type="number" step="0.01" value={form.engagement_rate}
              onChange={(e) => setForm((f) => ({ ...f, engagement_rate: Number(e.target.value) }))} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
