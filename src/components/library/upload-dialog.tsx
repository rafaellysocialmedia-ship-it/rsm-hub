import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, X, FileIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  FILE_CATEGORIES, LIBRARY_BUCKET, formatBytes, inferCategory, type FileCategory, type FolderRow,
} from "@/lib/library";
import type { Client } from "@/lib/clients";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders: FolderRow[];
  clients: Client[];
  defaultFolderId?: string | null;
  defaultClientId?: string | null;
  defaultCategory?: FileCategory;
};

export function UploadDialog({
  open, onOpenChange, folders, clients,
  defaultFolderId = null, defaultClientId = null, defaultCategory,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<FileCategory | "auto">(defaultCategory ?? "auto");
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? "none");
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "none");
  const [tagsRaw, setTagsRaw] = useState("");
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setFiles([]); setTagsRaw(""); setProgress(0);
    setCategory(defaultCategory ?? "auto");
    setFolderId(defaultFolderId ?? "none");
    setClientId(defaultClientId ?? "none");
  };

  const onPick = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (files.length === 0) throw new Error("Selecione ao menos um arquivo");
      const tags = tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      let done = 0;
      for (const f of files) {
        const cat = category === "auto" ? inferCategory(f.type, f.name) : category;
        const safeName = f.name.replace(/[^\w.-]+/g, "_");
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, f, {
          contentType: f.type || undefined, upsert: false,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("files").insert({
          name: f.name,
          category: cat,
          tags,
          mime_type: f.type || null,
          size_bytes: f.size,
          storage_path: path,
          folder_id: folderId === "none" ? null : folderId,
          client_id: clientId === "none" ? null : clientId,
          uploaded_by: user.id,
        });
        if (insErr) throw insErr;
        done += 1;
        setProgress(Math.round((done / files.length) * 100));
      }
    },
    onSuccess: () => {
      toast.success(`${files.length} arquivo${files.length === 1 ? "" : "s"} enviado${files.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["library-files"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => { toast.error(e.message); setProgress(0); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar arquivos</DialogTitle>
          <DialogDescription>Adicione um ou vários arquivos à biblioteca.</DialogDescription>
        </DialogHeader>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files); }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-10 transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Arraste e solte ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground">Imagens, vídeos, PDFs, ZIPs — sem limite de quantidade</p>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        </div>

        {files.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/50">
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                  className="rounded p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {files.length} arquivo{files.length === 1 ? "" : "s"} · {formatBytes(files.reduce((s, f) => s + f.size, 0))}
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as FileCategory | "auto")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automática</SelectItem>
                {FILE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pasta</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Raiz</SelectItem>
                {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags (separadas por vírgula)</Label>
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="campanha, verão, hero" />
          </div>
        </div>

        {upload.isPending && <Progress value={progress} className="h-1.5" />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancelar</Button>
          <Button onClick={() => upload.mutate()} disabled={upload.isPending || files.length === 0}>
            {upload.isPending ? `Enviando ${progress}%` : `Enviar ${files.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
