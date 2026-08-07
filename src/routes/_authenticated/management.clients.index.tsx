import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Building2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/clients";
import { CLIENT_STATUS } from "@/lib/clients";
import { formatDate, formatDateTime, type ClientService } from "@/lib/client-master";
import { useStaffMembers } from "@/hooks/use-staff";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientLogo } from "@/components/clients/client-logo";
import { StatusBadge } from "@/components/clients/status-badge";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/management/clients/")({
  head: () => ({
    meta: [
      { title: "Central de Clientes · Gerência" },
      {
        name: "description",
        content:
          "Cadastro mestre dos clientes da agência: dados, serviços, equipe, documentos e histórico.",
      },
      { property: "og:title", content: "Central de Clientes · Gerência" },
      {
        property: "og:description",
        content: "Cadastro mestre dos clientes da agência em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagementClientsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Não encontrado</div>
  ),
});

type SortKey = "name" | "start_date" | "updated_at";

function ManagementClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated_at");
  const { data: staff = [] } = useStaffMembers();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["management-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["management-client-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_services")
        .select("client_id, label, service_key, situation");
      if (error) throw error;
      return (data ?? []) as Pick<
        ClientService,
        "client_id" | "label" | "service_key" | "situation"
      >[];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients ?? [])
      .filter((c) => (status === "all" ? true : c.status === status))
      .filter((c) =>
        !q
          ? true
          : [c.name, c.legal_name, c.responsible, c.email, c.segment]
              .filter(Boolean)
              .some((v) => (v as string).toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        const av = (a as unknown as Record<string, string | null>)[sort] ?? "";
        const bv = (b as unknown as Record<string, string | null>)[sort] ?? "";
        return bv.localeCompare(av);
      });
  }, [clients, search, status, sort]);

  const nameOf = (id: string | null | undefined) => {
    if (!id) return "—";
    const m = staff.find((s) => s.id === id);
    return m?.name || m?.email || "—";
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Central de Clientes</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Cadastro mestre da operação — base única para todos os módulos do sistema.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, empresa, responsável…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {CLIENT_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="sm:w-[200px]">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Última atualização</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="start_date">Data de início</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="mt-6">
          <ListSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <Card className="mt-6 border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado com os filtros atuais.
        </Card>
      ) : (
        <Card className="mt-6 divide-y divide-border shadow-soft">
          {rows.map((c) => {
            const extra = c as Client & {
              trade_name?: string | null;
              account_manager_id?: string | null;
            };
            const svc = services.filter((s) => s.client_id === c.id);
            return (
              <Link
                key={c.id}
                to="/management/clients/$clientId"
                params={{ clientId: c.id }}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <ClientLogo path={c.logo_url} name={c.name} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {extra.trade_name || c.legal_name || "Sem empresa"} ·{" "}
                    {c.responsible || "Sem responsável"}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5 sm:w-[220px]">
                  {svc.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sem serviços</span>
                  ) : (
                    svc.slice(0, 3).map((s) => (
                      <Badge key={s.service_key} variant="outline" className="text-[10px]">
                        {s.label || s.service_key}
                      </Badge>
                    ))
                  )}
                  {svc.length > 3 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{svc.length - 3}
                    </Badge>
                  )}
                </div>
                <div className="sm:w-[160px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Responsável interno
                  </p>
                  <p className="truncate text-xs">{nameOf(extra.account_manager_id)}</p>
                </div>
                <div className="sm:w-[130px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Início
                  </p>
                  <p className="text-xs">{formatDate(c.start_date)}</p>
                </div>
                <div className="sm:w-[150px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Atualizado
                  </p>
                  <p className="text-xs">{formatDateTime(c.updated_at)}</p>
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
