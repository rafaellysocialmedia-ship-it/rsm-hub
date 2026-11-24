import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { isActiveClient } from "@/lib/active-clients";
import type { Client } from "@/lib/clients";
import { sumMetrics, type TrafficMetric } from "@/lib/traffic";
import { kpiItems } from "@/lib/traffic-analytics";
import { MonthlyReports } from "@/components/workspace/monthly-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/relatorios/mensal")({
  validateSearch: (s: Record<string, unknown>): { cliente?: string } => ({
    cliente: typeof s.cliente === "string" ? s.cliente : undefined,
  }),
  head: () => ({ meta: [{ title: "Relatório mensal · Relatórios · RSM Gestão de Marketing" }] }),
  component: MonthlyReportPage,
});

function monthRange() {
  const now = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

function MonthlyReportPage() {
  const { cliente } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  const { hasRole } = useAuth();
  const canEdit = hasRole("administrator") || hasRole("team");

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
  const active = useMemo(() => (clients.data ?? []).filter(isActiveClient), [clients.data]);
  const client = active.find((c) => c.id === cliente) ?? (clients.data ?? []).find((c) => c.id === cliente);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatório mensal</h1>
          <p className="text-sm text-muted-foreground">Escolha o cliente para ver e editar o relatório do mês.</p>
        </div>
        <Select
          value={cliente ?? ""}
          onValueChange={(v) => void navigate({ search: { cliente: v }, replace: true })}
        >
          <SelectTrigger className="w-full sm:w-72" aria-label="Cliente do relatório">
            <SelectValue placeholder={clients.isLoading ? "Carregando clientes…" : "Escolha o cliente"} />
          </SelectTrigger>
          <SelectContent>
            {active.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {!client ? (
        clients.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Escolha um cliente acima para abrir o relatório mensal dele.
            </CardContent>
          </Card>
        )
      ) : (
        <>
          {can("traffic.analytics") && <TrafficSummary clientId={client.id} />}
          <MonthlyReports clientId={client.id} clientName={client.name} canEdit={canEdit && !client.churned} />
        </>
      )}
    </div>
  );
}

/** Resumo das métricas de tráfego do mês; o detalhe fica em Tráfego › Métricas. */
function TrafficSummary({ clientId }: { clientId: string }) {
  const range = monthRange();
  const q = useQuery({
    queryKey: ["monthly-traffic-summary", clientId, range.from],
    queryFn: async () => {
      const { data: campaigns, error } = await supabase
        .from("traffic_campaigns")
        .select("id")
        .eq("client_id", clientId);
      if (error) throw error;
      const ids = (campaigns ?? []).map((c) => c.id);
      if (!ids.length) return null;
      const { data, error: e2 } = await supabase
        .from("traffic_metrics")
        .select("spend,clicks,impressions,reach,leads,conversions,revenue")
        .in("campaign_id", ids)
        .gte("collected_at", range.from)
        .lte("collected_at", range.to);
      if (e2) throw e2;
      return sumMetrics((data ?? []) as Pick<TrafficMetric, "spend" | "clicks" | "impressions" | "reach" | "leads" | "conversions" | "revenue">[]);
    },
  });
  if (q.isLoading) return <Skeleton className="h-28 w-full" />;
  if (q.error || q.data === null) return null;
  const keep = ["Investimento", "Leads", "CPC", "CTR"];
  const items = kpiItems(q.data!).filter((k) => keep.includes(k.label));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4 text-brand-accent" aria-hidden /> Tráfego pago · {range.label}
        </CardTitle>
        <Button asChild size="sm" variant="ghost">
          <Link to="/trafego/metricas">
            Ver métricas completas <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((k) => (
          <div key={k.label} className="rounded-lg border border-border/70 p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
