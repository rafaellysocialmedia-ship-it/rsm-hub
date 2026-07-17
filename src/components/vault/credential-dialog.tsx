import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, RefreshCw, ImagePlus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createCredential, updateCredential,
  listAttachments, uploadAttachment, deleteAttachment, attachmentUrl,
  type VaultCredential, type VaultAttachment,
} from "@/lib/vault";
import type { Client } from "@/lib/clients";

function generatePassword(len = 20) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

function describeError(e: unknown): string {
  if (!e) return "Erro desconhecido";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const err = e as { message?: string; hint?: string; details?: string; code?: string };
  return err.message || err.hint || err.details || err.code || "Erro ao salvar credencial";
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: Client[];
  credential?: VaultCredential | null;
};

export function CredentialDialog({ open, onOpenChange, clients, credential }: Props) {
  const qc = useQueryClient();
  const editing = !!credential;
  const [platform, setPlatform] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [show, setShow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (credential) {
      setPlatform(credential.platform);
      setUsername(credential.username);
      setPassword("");
      setNotes(credential.notes ?? "");
      setClientId(credential.client_id ?? "none");
    } else {
      setPlatform(""); setUsername(""); setPassword("");
      setNotes(""); setClientId("none");
    }
    setShow(false);
  }, [credential, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!platform.trim()) throw new Error("Plataforma obrigatória");
      if (!username.trim()) throw new Error("Usuário obrigatório");
      if (!editing && !password) throw new Error("Senha obrigatória");
      if (editing) {
        await updateCredential({
          id: credential!.id,
          platform: platform.trim(),
          username: username.trim(),
          password: password || null,
          url: null,
          notes: notes.trim() || null,
          client_id: clientId === "none" ? null : clientId,
        });
        return credential!.id;
      }
      const id = await createCredential({
        platform: platform.trim(),
        username: username.trim(),
        password,
        url: null,
        notes: notes.trim() || null,
        client_id: clientId === "none" ? null : clientId,
      });
      return id as string;
    },
    onSuccess: () => {
      toast.success(editing ? "Credencial atualizada" : "Credencial criada");
      qc.invalidateQueries({ queryKey: ["vault-credentials"] });
      if (editing) onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(describeError(e)),
  });

  // Attachments (only in edit mode)
  const { data: attachments = [] } = useQuery({
    queryKey: ["vault-attachments", credential?.id],
    enabled: !!credential?.id && open,
    queryFn: () => listAttachments(credential!.id),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!credential?.id) throw new Error("Salve a credencial antes de anexar imagens");
      for (const f of files) await uploadAttachment(credential.id, f);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-attachments", credential?.id] });
      toast.success("Anexos enviados");
    },
    onError: (e: unknown) => toast.error(describeError(e)),
  });

  const remove = useMutation({
    mutationFn: (att: VaultAttachment) => deleteAttachment(att),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-attachments", credential?.id] }),
    onError: (e: unknown) => toast.error(describeError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar credencial" : "Nova credencial"}</DialogTitle>
          <DialogDescription>
            Senhas são criptografadas no servidor. Anexe prints dos códigos de recuperação/2FA quando necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Plataforma</Label>
            <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Ex.: Instagram Business" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Usuário</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="login@exemplo.com" />
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
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Senha {editing && <span className="text-muted-foreground">(deixe em branco para manter a atual)</span>}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editing ? "••••••••" : "Digite uma senha forte"}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => { setPassword(generatePassword()); setShow(true); }} title="Gerar senha forte">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Códigos de recuperação, perguntas de segurança, contexto…" />
          </div>

          {editing && (
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Prints e anexos (códigos 2FA, etc.)</Label>
                <Button
                  type="button" variant="outline" size="sm" className="h-7 gap-1.5"
                  onClick={() => fileRef.current?.click()} disabled={upload.isPending}
                >
                  {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
                <input
                  ref={fileRef} type="file" accept="image/*" multiple hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) upload.mutate(files);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
              </div>
              {attachments.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nenhum anexo. Envie prints dos códigos 2FA aqui.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map((a) => <AttachmentTile key={a.id} att={a} onRemove={() => remove.mutate(a)} />)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {editing ? "Fechar" : "Cancelar"}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : editing ? "Salvar" : "Criar credencial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentTile({ att, onRemove }: { att: VaultAttachment; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    attachmentUrl(att.storage_path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [att.storage_path]);
  const isImg = (att.mime_type ?? "").startsWith("image/");
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-muted">
      {url && isImg ? (
        <img src={url} alt={att.file_name} className="aspect-square w-full object-cover" />
      ) : (
        <div className="flex aspect-square items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
          {att.file_name}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="rounded bg-white/90 p-1.5 text-slate-900 hover:bg-white">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button type="button" onClick={onRemove} className="rounded bg-rose-500/90 p-1.5 text-white hover:bg-rose-500">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
