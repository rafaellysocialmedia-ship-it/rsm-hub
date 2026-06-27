import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, ExternalLink, Calendar, HardDrive } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  LIBRARY_BUCKET, categoryMeta, fileIconFor, formatBytes,
  isAudio, isImage, isPdf, isVideo, type FileRow,
} from "@/lib/library";

export function FilePreviewDialog({
  file, open, onOpenChange, canManage,
}: { file: FileRow | null; open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setUrl(null); return; }
    let active = true;
    supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(file.storage_path, 60 * 60).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [file]);

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
            <img src={url} alt={file.name} className="mx-auto max-h-[60vh] object-contain" />
          )}
          {url && isVideo(file.mime_type) && (
            <video src={url} controls className="mx-auto max-h-[60vh] w-full" />
          )}
          {url && isAudio(file.mime_type) && (
            <div className="p-8"><audio src={url} controls className="w-full" /></div>
          )}
          {url && isPdf(file.mime_type) && (
            <iframe src={url} title={file.name} className="h-[60vh] w-full" />
          )}
          {url && !isImage(file.mime_type) && !isVideo(file.mime_type) && !isAudio(file.mime_type) && !isPdf(file.mime_type) && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Icon className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pré-visualização indisponível para este formato</p>
            </div>
          )}
          {!url && <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Carregando…</div>}
        </div>

        {file.description && (
          <p className="text-sm text-muted-foreground">{file.description}</p>
        )}

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
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" />Remover
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
