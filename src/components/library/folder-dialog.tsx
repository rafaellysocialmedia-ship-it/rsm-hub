import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { FolderRow } from "@/lib/library";
import type { Client } from "@/lib/clients";

export function FolderDialog({
  open, onOpenChange, folders, clients, folder,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  folders: FolderRow[]; clients: Client[];
  folder?: FolderRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!folder;
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [clientId, setClientId] = useState<string>("none");

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? "");
      setParentId(folder?.parent_id ?? "none");
      setClientId(folder?.client_id ?? "none");
    }
  }, [open, folder]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome obrigatório");
      const payload = {
        name: name.trim(),
        parent_id: parentId === "none" ? null : parentId,
        client_id: clientId === "none" ? null : clientId,
      };
      if (isEdit && folder) {
        const { error } = await supabase.from("file_folders").update(payload).eq("id", folder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("file_folders").insert({
          ...payload,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Pasta atualizada" : "Pasta criada");
      qc.invalidateQueries({ queryKey: ["library-folders"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!folder) return;
      const { error } = await supabase.from("file_folders").delete().eq("id", folder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta removida");
      qc.invalidateQueries({ queryKey: ["library-folders"] });
      qc.invalidateQueries({ queryKey: ["library-files"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Prevent selecting the folder itself or its descendants as parent when editing
  const validParents = folders.filter((f) => (folder ? f.id !== folder.id : true));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          <DialogDescription>Organize seus arquivos em pastas e subpastas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Campanha de Verão" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pasta pai</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Raiz</SelectItem>
                {validParents.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente (opcional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm("Remover esta pasta? Os arquivos ficarão sem pasta atribuída.")) remove.mutate();
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar pasta"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
