import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Search, ShieldCheck, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listCredentials, type VaultCredential } from "@/lib/vault";
import type { Client } from "@/lib/clients";
import { CredentialDialog } from "@/components/vault/credential-dialog";
import { CredentialRow } from "@/components/vault/credential-row";
import { HistorySheet } from "@/components/vault/history-sheet";

export const Route = createFileRoute("/_authenticated/vault/")({
  component: VaultPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
});

function VaultPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canAccess = hasRole("administrator") || hasRole("team");

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VaultCredential | null>(null);
  const [historyTarget, setHistoryTarget] = useState<VaultCredential | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["vault-credentials"],
    queryFn: listCredentials,
    enabled: canAccess,
  });

  useEffect(() => {
    if (!canAccess) return;
    const ch = supabase
      .channel("vault-credentials")
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_credentials" }, () => {
        qc.invalidateQueries({ queryKey: ["vault-credentials"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canAccess, qc]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return credentials.filter((c) => {
      if (clientFilter === "none" && c.client_id) return false;
      if (clientFilter !== "all" && clientFilter !== "none" && c.client_id !== clientFilter) return false;
      if (!q) return true;
      return (
        c.platform.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        (c.url ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [credentials, search, clientFilter]);

  if (!canAccess) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          O Password Vault é acessível apenas para administradores e equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand">
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Password Vault</h1>
            <p className="text-sm text-muted-foreground">Credenciais criptografadas por cliente</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />Nova credencial
        </Button>
      </div>

      <Card className="flex items-center gap-3 border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>Todas as senhas são armazenadas criptografadas no banco e só podem ser reveladas sob demanda. Cada visualização fica registrada no histórico.</span>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por plataforma, usuário, URL…"
            className="pl-9"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            <SelectItem value="none">Sem cliente</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        {isLoading && <p className="px-1 text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && filtered.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhuma credencial encontrada</p>
            <p className="max-w-xs text-xs text-muted-foreground">Adicione a primeira credencial e ela ficará criptografada no banco.</p>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} variant="outline" size="sm" className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" />Nova credencial
            </Button>
          </Card>
        )}
        {filtered.map((c) => (
          <CredentialRow
            key={c.id}
            credential={c}
            clients={clients}
            onEdit={(cred) => { setEditing(cred); setDialogOpen(true); }}
            onHistory={(cred) => setHistoryTarget(cred)}
          />
        ))}
      </div>

      <CredentialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clients={clients}
        credential={editing}
      />
      <HistorySheet
        credential={historyTarget}
        open={!!historyTarget}
        onOpenChange={(o) => { if (!o) setHistoryTarget(null); }}
      />
    </div>
  );
}
