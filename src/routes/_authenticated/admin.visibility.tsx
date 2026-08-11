import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Layers, Loader2, ShieldAlert, UserCog, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/visibility")({
  head: () => ({
    meta: [
      { title: "Gerenciar Visualizações · Social Media Hub" },
      { name: "description", content: "Defina quais módulos cada papel, membro da equipe ou cliente pode visualizar." },
      { property: "og:title", content: "Gerenciar Visualizações" },
      { property: "og:description", content: "Controle de visualização por perfil no Social Media Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisibilityPage,
});

type ModuleRow = {
  key: string;
  label: string;
  parent_key: string | null;
  sector_key: string | null;
  route: string | null;
  sort_order: number;
  is_active: boolean;
};

type VisibilityRow = { scope: string; scope_id: string; module_key: string; visible: boolean };

type Scope = "role" | "user" | "client";

const ROLE_LABEL: Record<AppRole, string> = {
  administrator: "Administrador",
  team: "Equipe",
  client: "Cliente",
};

function VisibilityPage() {
  const { hasRole, loading } = useAuth();
  const isAdmin = hasRole("administrator");

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Authorization is enforced in the database too (admin-only policies on
  // module_visibility) — this is only the interface layer.
  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva do Administrador. Se você precisa de acesso, fale com o administrador do workspace.
        </p>
      </div>
    );
  }

  return <VisibilityManager />;
}

function VisibilityManager() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Scope>("role");
  const [role, setRole] = useState<AppRole>("team");
  const [memberId, setMemberId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");

  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ["app-modules-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_modules")
        .select("key,label,parent_key,sector_key,route,sort_order,is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ModuleRow[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["module-visibility-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_visibility")
        .select("scope,scope_id,module_key,visible");
      if (error) throw error;
      return (data ?? []) as VisibilityRow[];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["visibility-staff"],
    queryFn: async () => {
      const [roles, profiles] = await Promise.all([
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("profiles").select("id,name,email"),
      ]);
      if (roles.error) throw roles.error;
      if (profiles.error) throw profiles.error;
      const teamIds = new Set(
        (roles.data ?? []).filter((r) => r.role === "team" || r.role === "administrator").map((r) => r.user_id),
      );
      return (profiles.data ?? [])
        .filter((p) => teamIds.has(p.id))
        .map((p) => ({ id: p.id, label: p.name || p.email || p.id }));
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["visibility-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setVisibility = useMutation({
    mutationFn: async (args: { scope: Scope; scopeId: string; moduleKey: string; visible: boolean }) => {
      const { error } = await supabase
        .from("module_visibility")
        .upsert(
          {
            scope: args.scope,
            scope_id: args.scopeId,
            module_key: args.moduleKey,
            visible: args.visible,
          } as never,
          { onConflict: "scope,scope_id,module_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module-visibility-all"] });
      qc.invalidateQueries({ queryKey: ["module-visibility-mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const parents = modules.filter((m) => !m.parent_key);
    return parents.map((p) => ({
      parent: p,
      children: modules.filter((c) => c.parent_key === p.key),
    }));
  }, [modules]);

  const ruleFor = (scope: Scope, scopeId: string, moduleKey: string) =>
    rules.find((r) => r.scope === scope && r.scope_id === scopeId && r.module_key === moduleKey);

  const scopeId = tab === "role" ? role : tab === "user" ? memberId : clientId;

  const bulk = useMutation({
    mutationFn: async (visible: boolean) => {
      if (!scopeId) throw new Error("Selecione um destino");
      const rows = modules.map((m) => ({
        scope: tab,
        scope_id: scopeId,
        module_key: m.key,
        visible,
      }));
      const { error } = await supabase
        .from("module_visibility")
        .upsert(rows as never, { onConflict: "scope,scope_id,module_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module-visibility-all"] });
      qc.invalidateQueries({ queryKey: ["module-visibility-mine"] });
      toast.success("Visualizações atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matrix = () => {
    if (!scopeId) {
      return (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Selecione {tab === "user" ? "um membro da equipe" : "um cliente"} para configurar as visualizações.
        </p>
      );
    }
    if (tab === "role" && role === "administrator") {
      return (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-sm">
          <p className="font-medium">O Administrador possui acesso total.</p>
          <p className="mt-1 text-muted-foreground">
            Todos os módulos ficam sempre visíveis para o Administrador e essa regra não pode ser alterada.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulk.mutate(true)} disabled={bulk.isPending}>
            {bulk.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Liberar tudo
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulk.mutate(false)} disabled={bulk.isPending}>
            <EyeOff className="h-3.5 w-3.5" /> Bloquear tudo
          </Button>
          <span className="text-xs text-muted-foreground">
            Sem regra definida, o módulo segue as permissões atuais do usuário.
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(({ parent, children }) => (
            <Card key={parent.key} className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  {parent.label}
                </CardTitle>
                <VisibilityToggle
                  checked={ruleFor(tab, scopeId, parent.key)?.visible ?? true}
                  defined={!!ruleFor(tab, scopeId, parent.key)}
                  onChange={(v) => setVisibility.mutate({ scope: tab, scopeId, moduleKey: parent.key, visible: v })}
                />
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {children.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem submódulos.</p>
                )}
                {children.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.label}</p>
                      {c.route && <p className="truncate text-[10px] text-muted-foreground">{c.route}</p>}
                    </div>
                    <VisibilityToggle
                      checked={ruleFor(tab, scopeId, c.key)?.visible ?? true}
                      defined={!!ruleFor(tab, scopeId, c.key)}
                      onChange={(v) => setVisibility.mutate({ scope: tab, scopeId, moduleKey: c.key, visible: v })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Gerenciar Visualizações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina quais módulos e áreas cada papel, membro da equipe ou cliente pode visualizar.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">Somente Administrador</Badge>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Scope)}>
        <TabsList>
          <TabsTrigger value="role" className="gap-1.5 text-xs"><UserCog className="h-3.5 w-3.5" />Por papel</TabsTrigger>
          <TabsTrigger value="user" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Equipe</TabsTrigger>
          <TabsTrigger value="client" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="role" className="mt-4 space-y-4">
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["administrator", "team", "client"] as AppRole[]).map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loadingModules ? <Skeleton className="h-64 w-full" /> : matrix()}
        </TabsContent>

        <TabsContent value="user" className="mt-4 space-y-4">
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
            <SelectContent>
              {staff.map((s) => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
          {matrix()}
        </TabsContent>

        <TabsContent value="client" className="mt-4 space-y-4">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {matrix()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisibilityToggle({
  checked, defined, onChange,
}: { checked: boolean; defined: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {!defined && <span className="text-[10px] text-muted-foreground">padrão</span>}
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
