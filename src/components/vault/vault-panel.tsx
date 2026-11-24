import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Search, ShieldCheck, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listCredentials, type VaultCredential } from "@/lib/vault";
import type { Client } from "@/lib/clients";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { CredentialDialog } from "@/components/vault/credential-dialog";
import { CredentialRow } from "@/components/vault/credential-row";
import { HistorySheet } from "@/components/vault/history-sheet";

/** Cofre de acessos. scope "agency" = só acessos sem cliente (Configurações);
 *  scope { clientId } = acessos de um cliente (aba Acessos da página do cliente). */
export function VaultPanel({ scope }: { scope: "agency" | { clientId: string } }) {
  const fixedClient = scope === "agency" ? "none" : scope.clientId;
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canAccess = hasRole("administrator") || hasRole("team");

  const [search, setSearch] = useState("");
  const clientFilter = fixedClient;
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
          O cofre de acessos é acessível apenas para administradores e equipe.
        </p>
      </div>
    );
  }

  return (
    <div className={scope === "agency" ? "space-y-6 p-4 md:p-6 lg:p-8" : "space-y-6"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand">
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{scope === "agency" ? "Acessos da agência" : "Acessos"}</h1>
            <p className="text-sm text-muted-foreground">{scope === "agency" ? "Credenciais da agência, sem cliente vinculado" : "Credenciais criptografadas deste cliente"}</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />Adicionar acesso
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
      </div>

      <div className="space-y-1.5">
        {isLoading && <ListSkeleton rows={4} />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={KeyRound}
            title={search ? "Nenhum acesso encontrado" : "Nenhum acesso guardado"}
            description={
              search
                ? "Nenhum login bate com a busca. Tente outro termo."
                : scope === "agency"
                  ? "Guarde aqui logins e senhas das contas da agência."
                  : "Guarde aqui logins e senhas das contas do cliente."
            }
            actions={
              search
                ? [{ label: "Limpar busca", onClick: () => setSearch("") }]
                : [{ label: "Adicionar primeiro acesso", onClick: () => { setEditing(null); setDialogOpen(true); } }]
            }
          />
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
        defaultClientId={scope === "agency" ? undefined : scope.clientId}
      />
      <HistorySheet
        credential={historyTarget}
        open={!!historyTarget}
        onOpenChange={(o) => { if (!o) setHistoryTarget(null); }}
      />
    </div>
  );
}
