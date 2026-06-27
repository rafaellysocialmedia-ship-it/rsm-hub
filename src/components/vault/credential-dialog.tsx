import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createCredential, updateCredential, type VaultCredential } from "@/lib/vault";
import type { Client } from "@/lib/clients";

function generatePassword(len = 20) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
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
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (credential) {
      setPlatform(credential.platform);
      setUsername(credential.username);
      setPassword("");
      setUrl(credential.url ?? "");
      setNotes(credential.notes ?? "");
      setClientId(credential.client_id ?? "none");
    } else {
      setPlatform(""); setUsername(""); setPassword("");
      setUrl(""); setNotes(""); setClientId("none");
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
          url: url.trim() || null,
          notes: notes.trim() || null,
          client_id: clientId === "none" ? null : clientId,
        });
      } else {
        await createCredential({
          platform: platform.trim(),
          username: username.trim(),
          password,
          url: url.trim() || null,
          notes: notes.trim() || null,
          client_id: clientId === "none" ? null : clientId,
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Credencial atualizada" : "Credencial criada");
      qc.invalidateQueries({ queryKey: ["vault-credentials"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar credencial" : "Nova credencial"}</DialogTitle>
          <DialogDescription>
            Senhas são criptografadas no servidor e só podem ser reveladas sob demanda.
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
            <Label className="text-xs">URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="2FA, perguntas de segurança, contexto…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : editing ? "Salvar" : "Criar credencial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
