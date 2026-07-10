import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

type Metric = Database["public"]["Tables"]["post_metrics"]["Row"];
type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: string;
  metric: Metric | null;
};

const FIELDS: { key: keyof Metric; label: string }[] = [
  { key: "reach", label: "Alcance" },
  { key: "impressions", label: "Impressões" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "saves", label: "Salvamentos" },
  { key: "clicks", label: "Cliques no link" },
  { key: "video_views", label: "Visualizações de vídeo" },
  { key: "followers_gained", label: "Seguidores ganhos" },
  { key: "profile_visits", label: "Visitas ao perfil" },
];

export function MetricsDialog({ open, onOpenChange, postId, metric }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [collectedAt, setCollectedAt] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      const initial: Record<string, number> = {};
      FIELDS.forEach((f) => { initial[f.key as string] = (metric?.[f.key] as number) ?? 0; });
      setForm(initial);
      setNotes(metric?.notes ?? "");
      setCollectedAt(metric?.collected_at ?? new Date().toISOString().slice(0, 10));
    }
  }, [open, metric]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, notes: notes || null, collected_at: collectedAt, post_id: postId, created_by: user?.id ?? null };
      if (metric) {
        const { error } = await supabase.from("post_metrics").update(payload).eq("id", metric.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_metrics").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Métricas salvas");
      qc.invalidateQueries({ queryKey: ["post-metrics"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!metric) return;
      const { error } = await supabase.from("post_metrics").delete().eq("id", metric.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Métricas removidas");
      qc.invalidateQueries({ queryKey: ["post-metrics"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{metric ? "Editar métricas" : "Registrar métricas"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Data de coleta</Label>
            <Input type="date" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} className="w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key as string} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form[f.key as string] ?? 0}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key as string]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: pico às 20h, promoção paga R$ 50" />
          </div>
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          {metric ? (
            <Button variant="ghost" className="text-destructive" onClick={() => del.mutate()}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
