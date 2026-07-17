import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash2, ExternalLink, Calendar, HardDrive, Pencil, X, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  FILE_CATEGORIES, LIBRARY_BUCKET, categoryMeta, fileIconFor, formatBytes,
  isAudio, isImage, isPdf, isVideo, type FileCategory, type FileRow, type FolderRow,
} from "@/lib/library";

export function FilePreviewDialog({
  file, open, onOpenChange, canManage,
}: { file: FileRow | null; open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "documentos" as FileCategory,
    folder_id: "none",
    tags: "",
  });

  useEffect(() => {
    if (!file) { setUrl(null); return; }
    setEditing(false);
    setForm({
      name: file.name,
      description: file.description ?? "",
      category: file.category,
      folder_id: file.folder_id ?? "none",
      tags: (file.tags ?? []).join(", "),
    });
    let active = true;
    supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(file.storage_path, 60 * 60).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [file]);

  const { data: folders = [] } = useQuery({
    queryKey: ["library-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("file_folders").select("*").order("name");
      if (error) throw error;
      return data as FolderRow[];
    },
    enabled: open && canManage,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error } = await supabase.from("files").update({
        name: form.name.trim() || file.name,
        description: form.description.trim() || null,
        category: form.category,
        folder_id: form.folder_id === "none" ? null : form.folder_id,
        tags,
      }).eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo atualizado");
      qc.invalidateQueries({ queryKey: ["library-files"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!file) return;
      await supabase.storage.from(LIBRARY_BUCKET).remove([file.storage_path]);
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo removido");
      qc.invalidateQueries({ queryKey: ["library-files"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!file) return null;
  const meta = categoryMeta(file.category);
  const Icon = fileIconFor(file.mime_type, file.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Pré-visualização do arquivo</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
          {file.tags?.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
          {url && isImage(file.mime_type) && (
            <img src={url} alt={file.name} className="mx-auto max-h-[50vh] object-contain" />
          )}
          {url && isVideo(file.mime_type) && (
            <video src={url} controls className="mx-auto max-h-[50vh] w-full" />
          )}
          {url && isAudio(file.mime_type) && (
            <div className="p-8"><audio src={url} controls className="w-full" /></div>
          )}
          {url && isPdf(file.mime_type) && (
            <iframe src={url} title={file.name} className="h-[50vh] w-full" />
          )}
          {url && !isImage(file.mime_type) && !isVideo(file.mime_type) && !isAudio(file.mime_type) && !isPdf(file.mime_type) && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Icon className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pré-visualização indisponível para este formato</p>
            </div>
          )}
          {!url && <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Carregando…</div>}
        </div>

        {editing && canManage ? (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FileCategory })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Pasta</Label>
              <Select value={form.folder_id} onValueChange={(v) => setForm({ ...form, folder_id: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta</SelectItem>
                  {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Tags (separadas por vírgula)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="h-8" placeholder="branding, logo, hero" />
            </div>
          </div>
        ) : file.description ? (
          <p className="text-sm text-muted-foreground">{file.description}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" />{formatBytes(Number(file.size_bytes))}</div>
          <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(file.created_at), "dd MMM yyyy", { locale: ptBR })}</div>
          <div className="truncate">{file.mime_type ?? "—"}</div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {url && (
              <>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={url} download={file.name}><Download className="h-4 w-4" />Baixar</a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Abrir</a>
                </Button>
              </>
            )}
          </div>
          {canManage && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditing(false)} disabled={save.isPending}>
                    <X className="h-4 w-4" />Cancelar
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" />Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => remove.mutate()} disabled={remove.isPending}>
                    <Trash2 className="h-4 w-4" />Remover
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
