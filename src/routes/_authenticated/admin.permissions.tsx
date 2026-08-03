import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Search, ShieldCheck, Users, UserCog, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  component: PermissionsPage,
});

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  cargo: string | null;
  company: string | null;
};

type RoleRow = { user_id: string; role: AppRole };

const ROLE_META: Record<AppRole, { label: string; desc: string; className: string }> = {
  administrator: {
    label: "Administrador",
    desc: "Acesso total ao workspace, gestão de permissões e configurações.",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  team: {
    label: "Equipe",
    desc: "Gerencia clientes, publicações, tarefas e biblioteca.",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  client: {
    label: "Cliente",
    desc: "Acesso restrito ao portal do cliente e aprovações.",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
};

const ROLES: AppRole[] = ["administrator", "team", "client"];

function initials(name: string | null, email: string | null) {
  const base = (name || email || "?").trim();
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

type AppRoleRow = {
  key: string;
  label: string;
  description: string | null;
  sector_key: string | null;
  sort_order: number;
};

function RolesCatalogCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["app-roles-catalog"],
    queryFn: async () => {
      const [roles, assignments, rolePerms] = await Promise.all([
        supabase
          .from("app_roles")
          .select("key,label,description,sector_key,sort_order")
          .order("sort_order", { ascending: true }),
        supabase.from("user_app_roles").select("role_key"),
        supabase.from("app_role_permissions").select("role_key"),
      ]);
      if (roles.error) throw roles.error;
      if (assignments.error) throw assignments.error;
      if (rolePerms.error) throw rolePerms.error;

      const users = new Map<string, number>();
      (assignments.data ?? []).forEach((r) =>
        users.set(r.role_key, (users.get(r.role_key) ?? 0) + 1),
      );
      const perms = new Map<string, number>();
      (rolePerms.data ?? []).forEach((r) =>
        perms.set(r.role_key, (perms.get(r.role_key) ?? 0) + 1),
      );

      return (roles.data ?? []).map((r) => ({
        ...(r as AppRoleRow),
        users: users.get(r.key) ?? 0,
        permissions: perms.get(r.key) ?? 0,
      }));
    },
  });

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="text-base">Papéis e permissões</CardTitle>
        <p className="text-xs text-muted-foreground">
          Perfis de acesso cadastrados no sistema. A edição das permissões por módulo será
          liberada em breve.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Papel</TableHead>
                <TableHead className="hidden md:table-cell">Descrição</TableHead>
                <TableHead className="text-center">Usuários</TableHead>
                <TableHead className="text-center">Permissões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading &&
                (data ?? []).map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{r.label}</span>
                        <span className="text-[11px] text-muted-foreground">{r.key}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[420px] md:table-cell">
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {r.users}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.permissions}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionsPage() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const isAdmin = hasRole("administrator");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email,avatar_url,cargo,company")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
    enabled: isAdmin,
  });

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
    enabled: isAdmin,
  });

  const rolesByUser = useMemo(() => {
    const map = new Map<string, Set<AppRole>>();
    (roles ?? []).forEach((r) => {
      if (!map.has(r.user_id)) map.set(r.user_id, new Set());
      map.get(r.user_id)!.add(r.role);
    });
    return map;
  }, [roles]);

  const toggleRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      enable,
    }: {
      userId: string;
      role: AppRole;
      enable: boolean;
    }) => {
      if (enable) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("Permissões atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = profiles ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      const set = rolesByUser.get(p.id) ?? new Set<AppRole>();
      if (roleFilter !== "all" && !set.has(roleFilter)) return false;
      if (!q) return true;
      return (
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.cargo ?? "").toLowerCase().includes(q) ||
        (p.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [profiles, rolesByUser, search, roleFilter]);

  const totals = useMemo(() => {
    const counts: Record<AppRole, number> = { administrator: 0, team: 0, client: 0 };
    rolesByUser.forEach((set) => set.forEach((r) => (counts[r] += 1)));
    return counts;
  }, [rolesByUser]);

  if (authLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Somente administradores podem acessar a área de permissões.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loading = loadingProfiles || loadingRoles;

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5" /> Administração
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Permissões</h1>
        <p className="text-sm text-muted-foreground">
          Controle quem faz parte da equipe, dos clientes e quem administra o workspace.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          label="Administradores"
          value={totals.administrator}
        />
        <StatCard
          icon={<UserCog className="h-4 w-4 text-blue-500" />}
          label="Equipe"
          value={totals.team}
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-emerald-500" />}
          label="Clientes"
          value={totals.client}
        />
      </div>

      <RolesCatalogCard />

      <Card className="shadow-soft">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Usuários</CardTitle>
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {profiles?.length ?? 0} usuários
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, email, cargo..."
                className="pl-8 sm:w-72"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as permissões</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Usuário</TableHead>
                  <TableHead>Cargo / Empresa</TableHead>
                  <TableHead>Permissões atuais</TableHead>
                  {ROLES.map((r) => (
                    <TableHead key={r} className="text-center">
                      {ROLE_META[r].label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3 + ROLES.length}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3 + ROLES.length}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filtered.map((p) => {
                    const set = rolesByUser.get(p.id) ?? new Set<AppRole>();
                    const isSelf = p.id === user?.id;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={p.avatar_url ?? undefined} />
                              <AvatarFallback>{initials(p.name, p.email)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {p.name || "Sem nome"}
                                </span>
                                {isSelf && (
                                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                    você
                                  </Badge>
                                )}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {p.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{p.cargo || "—"}</div>
                          <div className="text-xs text-muted-foreground">{p.company || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {set.size === 0 && (
                              <span className="text-xs text-muted-foreground">Nenhuma</span>
                            )}
                            {[...set].map((r) => (
                              <Badge
                                key={r}
                                variant="outline"
                                className={ROLE_META[r].className}
                              >
                                {ROLE_META[r].label}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        {ROLES.map((r) => {
                          const checked = set.has(r);
                          const busy =
                            toggleRole.isPending &&
                            toggleRole.variables?.userId === p.id &&
                            toggleRole.variables?.role === r;
                          const disableSelfAdmin =
                            isSelf && r === "administrator" && checked;
                          return (
                            <TableCell key={r} className="text-center">
                              <div className="flex justify-center">
                                {busy ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <Checkbox
                                    checked={checked}
                                    disabled={disableSelfAdmin || toggleRole.isPending}
                                    onCheckedChange={(v) =>
                                      toggleRole.mutate({
                                        userId: p.id,
                                        role: r,
                                        enable: !!v,
                                      })
                                    }
                                    aria-label={`Alternar ${ROLE_META[r].label}`}
                                  />
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Guia de permissões</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div
              key={r}
              className="rounded-lg border bg-card/50 p-3"
            >
              <Badge variant="outline" className={ROLE_META[r].className}>
                {ROLE_META[r].label}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">{ROLE_META[r].desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Silence unused import warning for `redirect` — reserved for future guard usage.
void redirect;
