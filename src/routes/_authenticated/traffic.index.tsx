import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTrafficAccess, useTrafficClients } from "@/hooks/use-traffic";
import {
  money,
  num,
  pct,
  sumMetrics,
  type TrafficCampaign,
  type TrafficMetric,
} from "@/lib/traffic";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiGrid } from "@/components/traffic/kpi-grid";
import { CampaignDialog } from "@/components/traffic/campaign-dialog";
import { TrafficLocked } from "@/components/traffic/traffic-locked";
import { GrowthAreaChart } from "@/components/dashboard/charts";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/traffic/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Tráfego Pago · Hub de Performance" },
      {
        name: "description",
        content:
          "Investimento, cliques, impressões, leads, conversões, CPC, CPM, CTR e CPA das campanhas de tráfego pago.",
      },
      { property: "og:title", content: "Dashboard de Tráfego Pago" },
      { property: "og:description", content: "Painel de performance das campanhas de tráfego pago." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrafficDashboard,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Não encontrado</div>
  ),
});

function TrafficDashboard() {
  const { isStaff, allowed, loading, client } = useTrafficAccess();
  const { data: clients = [] } = useTrafficClients();
  const [clientFilter, setClientFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["traffic-campaigns"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrafficCampaign[];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["traffic-metrics"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_metrics")
        .select("*")
        .order("collected_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrafficMetric[];
    },
  });

  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter((c) =>
        clientFilter === "all" ? true : c.client_id === clientFilter,
      ),
    [campaigns, clientFilter],
  );

  const ids = new Set(visibleCampaigns.map((c) => c.id));
  const rows = metrics.filter((m) => ids.has(m.campaign_id));
  const totals = sumMetrics(rows);

  const chart = useMemo(() => {
    const byDate = new Map<string, number>();
    rows.forEach((r) => {
      byDate.set(r.collected_at, (byDate.get(r.collected_at) ?? 0) + Number(r.spend ?? 0));
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([label, total]) => ({
        label: new Date(`${label}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        total: Number(total.toFixed(2)),
      }));
  }, [rows]);

  if (loading) return <div className="px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <TrafficLocked />;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Tráfego Pago</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {client ? `Performance das campanhas de ${client.name}.` : "Hub de performance das campanhas."}
          </p>
        </div>
        {isStaff && (
          <div className="flex items-center gap-2">
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Campanha
            </Button>
          </div>
        )}
      </div>

      <KpiGrid
        className="mt-6"
        items={[
          { label: "Investimento", value: money(totals.spend) },
          { label: "Cliques", value: num(totals.clicks) },
          { label: "Impressões", value: num(totals.impressions) },
          { label: "Alcance", value: num(totals.reach) },
          { label: "Leads", value: num(totals.leads) },
          { label: "Conversões", value: num(totals.conversions) },
          { label: "CPC", value: money(totals.cpc) },
          { label: "CPM", value: money(totals.cpm) },
          { label: "CTR", value: pct(totals.ctr) },
          { label: "CPA", value: money(totals.cpa) },
        ]}
      />

      <Card className="mt-6 p-5 shadow-soft">
        <p className="text-sm font-medium">Investimento por dia</p>
        <div className="mt-4 h-[260px]">
          {chart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhuma métrica registrada ainda.
            </div>
          ) : (
            <GrowthAreaChart data={chart} />
          )}
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Campanhas recentes</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/traffic/campaigns">Ver todas</Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="mt-3">
          <ListSkeleton />
        </div>
      ) : visibleCampaigns.length === 0 ? (
        <Card className="mt-3 border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma campanha cadastrada.
        </Card>
      ) : (
        <Card className="mt-3 divide-y divide-border shadow-soft">
          {visibleCampaigns.slice(0, 5).map((c) => {
            const t = sumMetrics(metrics.filter((m) => m.campaign_id === c.id));
            return (
              <Link
                key={c.id}
                to="/traffic/campaigns/$campaignId"
                params={{ campaignId: c.id }}
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {money(t.spend)} · {num(t.leads)} leads · CTR {pct(t.ctr)}
                </p>
              </Link>
            );
          })}
        </Card>
      )}

      <CampaignDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
