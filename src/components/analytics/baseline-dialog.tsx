import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

export type Baseline = Database["public"]["Tables"]["client_baselines"]["Row"] & {
  screenshot_path?: string | null;
};

const networks = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
];

const BUCKET = "analytics-screenshots";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    screenshot_path: baseline?.screenshot_path ?? null as string | null,
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
        screenshot_path: baseline?.screenshot_path ?? null,
      });
    }
  }, [open, baseline]);

  // Load signed URL for existing screenshot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.screenshot_path) { setPreviewUrl(null); return; }
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(form.screenshot_path, 300);
      if (!cancelled) setPreviewUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [form.screenshot_path]);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      setForm((f) => ({ ...f, screenshot_path: path }));
      toast.success("Print anexado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!form.screenshot_path) return;
    try {
      await supabase.storage.from(BUCKET).remove([form.screenshot_path]);
      setForm((f) => ({ ...f, screenshot_path: null }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
          <div className="col-span-2 space-y-1.5">
            <Label>Print do perfil</Label>
            {form.screenshot_path ? (
              <div className="relative rounded-lg border border-border p-2">
                {previewUrl ? (
                  <img src={previewUrl} alt="Print do perfil" className="max-h-56 w-full rounded object-contain" />
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Carregando…</div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={handleRemove}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Anexar print do perfil
                </Button>
                <p className="text-xs text-muted-foreground">Screenshot do perfil para registrar o ponto de partida.</p>
              </>
            )}
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
