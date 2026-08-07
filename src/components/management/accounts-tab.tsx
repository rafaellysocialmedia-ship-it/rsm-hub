import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ACCOUNT_CATALOG, type ClientAccount } from "@/lib/client-master";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, SectionCard } from "./master-shared";

export function AccountsTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(ACCOUNT_CATALOG[0].category);
  const [platform, setPlatform] = useState(ACCOUNT_CATALOG[0].platforms[0]);
  const [identifier, setIdentifier] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const platforms =
    ACCOUNT_CATALOG.find((c) => c.category === category)?.platforms ?? [];

  const { data: accounts = [] } = useQuery({
    queryKey: ["client-accounts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("category", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientAccount[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_accounts").insert({
        client_id: clientId,
        category,
        platform,
        identifier: identifier || null,
        url: url || null,
        notes: notes || null,
        created_by: user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-accounts", clientId] });
      toast.success("Acesso registrado");
      setOpen(false);
      setIdentifier("");
      setUrl("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-accounts", clientId] });
      toast.success("Acesso removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = ACCOUNT_CATALOG.map((c) => ({
    category: c.category,
    items: accounts.filter((a) => a.category === c.category),
  })).filter((g) => g.items.length > 0);

  return (
    <SectionCard
      title="Acessos e contas"
      description="Apenas identificadores e links. Senhas continuam protegidas no cofre de Acessos."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/vault">
              <KeyRound className="mr-2 h-4 w-4" />
              Cofre
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>
      }
    >
      {grouped.length === 0 ? (
        <EmptyState>Nenhuma conta registrada para este cliente.</EmptyState>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.category}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {g.items.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.platform}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.identifier || "—"}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </p>
                    </div>
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Abrir
                      </a>
                    )}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove.mutate(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v);
                    const first = ACCOUNT_CATALOG.find((c) => c.category === v)?.platforms[0];
                    if (first) setPlatform(first);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_CATALOG.map((c) => (
                      <SelectItem key={c.category} value={c.category}>
                        {c.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Plataforma</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Identificador / usuário</Label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="@perfil, ID da conta, e-mail…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Link</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Nunca registre senhas aqui — use o cofre de Acessos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
