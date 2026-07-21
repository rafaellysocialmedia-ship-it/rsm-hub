import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, History, User as UserIcon, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  copyToClipboard, deleteCredential, platformInitials, platformTone, revealPassword,
  type VaultCredential,
} from "@/lib/vault";
import type { Client } from "@/lib/clients";

type Props = {
  credential: VaultCredential;
  clients: Client[];
  onEdit: (c: VaultCredential) => void;
  onHistory: (c: VaultCredential) => void;
};

export function CredentialRow({ credential, clients, onEdit, onHistory }: Props) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const client = clients.find((c) => c.id === credential.client_id) ?? null;

  const handleReveal = async () => {
    if (revealed) { setRevealed(null); return; }
    setLoading(true);
    try {
      const pwd = await revealPassword(credential.id);
      setRevealed(pwd);
      qc.invalidateQueries({ queryKey: ["vault-history", credential.id] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  const handleCopyPassword = async () => {
    try {
      const pwd = revealed ?? (await revealPassword(credential.id));
      await copyToClipboard(pwd);
      toast.success("Senha copiada");
      qc.invalidateQueries({ queryKey: ["vault-history", credential.id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleCopyUser = async () => {
    await copyToClipboard(credential.username);
    toast.success("Usuário copiado");
  };

  const remove = useMutation({
    mutationFn: () => deleteCredential(credential.id),
    onSuccess: () => {
      toast.success("Credencial removida");
      qc.invalidateQueries({ queryKey: ["vault-credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent/40">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${platformTone(credential.platform)}`}>
        {platformInitials(credential.platform)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{credential.platform}</span>
          {client && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {client.name}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserIcon className="h-3 w-3" />
          <span className="truncate">{credential.username}</span>
        </div>
      </div>

      <div className="hidden min-w-0 max-w-[200px] items-center gap-1.5 sm:flex">
        <span className="truncate rounded-md bg-muted/60 px-2 py-1 font-mono text-xs">
          {revealed ?? "••••••••••••"}
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleReveal} disabled={loading} title={revealed ? "Ocultar senha" : "Mostrar senha"}>
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopyUser} title="Copiar usuário">
          <UserIcon className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopyPassword} title="Copiar senha">
          <Copy className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(credential)}>
              <Pencil className="mr-2 h-4 w-4" />Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHistory(credential)}>
              <History className="mr-2 h-4 w-4" />Histórico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => remove.mutate()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
