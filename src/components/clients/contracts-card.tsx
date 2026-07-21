import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Upload, Trash2, Download, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Contract = {
  id: string;
  client_id: string;
  title: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  status: "pending" | "signed" | "expired" | "cancelled";
  signed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

const sb = supabase as unknown as typeof supabase;
const BUCKET = "client-contracts";

const STATUS_META: Record<Contract["status"], { label: string; icon: typeof CheckCircle2; tone: string }> = {
  pending: { label: "Pendente", icon: Clock, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  signed: { label: "Assinado", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  expired: { label: "Expirado", icon: XCircle, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  cancelled: { label: "Cancelado", icon: XCircle, tone: "bg-muted text-muted-foreground border-border" },
};

export function ContractsCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("administrator") || hasRole("team");
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", clientId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("client_contracts" as never)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Contract[];
    },
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from("client_contracts" as never).insert({
        client_id: clientId,
        title: title.trim() || file.name,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        status: "pending",
        created_by: u.user?.id ?? null,
      } as never);
      if (error) throw error;
      setTitle("");
      toast.success("Contrato enviado");
      qc.invalidateQueries({ queryKey: ["client-contracts", clientId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Contract["status"] }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "signed") patch.signed_at = new Date().toISOString();
      const { error } = await sb.from("client_contracts" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts", clientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (c: Contract) => {
      if (c.storage_path) await supabase.storage.from(BUCKET).remove([c.storage_path]);
      const { error } = await sb.from("client_contracts" as never).delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato removido");
      qc.invalidateQueries({ queryKey: ["client-contracts", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(c: Contract) {
    if (!c.storage_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(c.storage_path, 60 * 5);
    if (error || !data?.signedUrl) { toast.error("Não foi possível gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4" />Contratos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título do contrato (opcional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Contrato mensal 2026" />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full gap-2" variant="outline" size="sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar contrato assinado
            </Button>
          </div>
        )}

        {contracts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Nenhum contrato registrado.</p>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => {
              const meta = STATUS_META[c.status];
              const Icon = meta.icon;
              return (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label}
                      {c.signed_at && ` · Assinado ${formatDistanceToNow(new Date(c.signed_at), { locale: ptBR, addSuffix: true })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.storage_path && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => download(c)} title="Baixar">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v as Contract["status"] })}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="signed">Assinado</SelectItem>
                            <SelectItem value="expired">Expirado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
