import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTrafficAccess } from "@/hooks/use-traffic";
import {
  campaignStatusMeta,
  money,
  num,
  objectiveLabel,
  pct,
  platformLabel,
  sumMetrics,
  type TrafficCampaign,
  type TrafficMetric,
} from "@/lib/traffic";
import { formatDate } from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiGrid } from "@/components/traffic/kpi-grid";
import { MetricDialog } from "@/components/traffic/metric-dialog";
import { CampaignDialog } from "@/components/traffic/campaign-dialog";
import { TrafficLocked } from "@/components/traffic/traffic-locked";
import { GrowthAreaChart } from "@/components/dashboard/charts";

export const Route = createFileRoute("/_authenticated/traffic/campaigns/$campaignId")({
  head: () => ({
    meta: [
      { title: "Analytics da campanha · Tráfego Pago" },
      {
        name: "description",
        content: "Métricas manuais e evolução de investimento, cliques, leads e conversões da campanha.",
      },
      { property: "og:title", content: "Analytics da campanha · Tráfego Pago" },
      { property: "og:description", content: "Evolução das métricas da campanha de tráfego pago." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampaignAnalyticsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Campanha não encontrada</div>
  ),
});

function CampaignAnalyticsPage() {
  const { campaignId } = Route.useParams();
  const { isStaff, allowed, loading } = useTrafficAccess();
  const [metricOpen, setMetricOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TrafficMetric | null>(null);

  const { data: campaign } = useQuery({
    queryKey: ["traffic-campaigns", campaignId],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();
      if (error) throw error;
      return data as TrafficCampaign | null;
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["traffic-metrics", campaignId],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_metrics")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("collected_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrafficMetric[];
    },
  });

  if (loading) return <div className="px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <TrafficLocked />;
  if (!campaign)
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        Campanha não encontrada.
      </div>
    );

  const totals = sumMetrics(metrics);
  const meta = campaignStatusMeta(campaign.status);
  const chart = metrics.slice(-30).map((m) => ({
    label: new Date(`${m.collected_at}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    total: Number(Number(m.spend ?? 0).toFixed(2)),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        to="/traffic/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Campanhas
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {platformLabel(campaign.platform)} · {objectiveLabel(campaign.objective)} ·{" "}
            {formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}
          </p>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setMetricOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Métricas
            </Button>
          </div>
        )}
      </div>

      <KpiGrid
        className="mt-6"
        items={[
          { label: "Investimento", value: money(totals.spend) },
          { label: "Impressões", value: num(totals.impressions) },
          { label: "Alcance", value: num(totals.reach) },
          { label: "Cliques", value: num(totals.clicks) },
          { label: "CTR", value: pct(totals.ctr) },
          { label: "CPC", value: money(totals.cpc) },
          { label: "CPM", value: money(totals.cpm) },
          { label: "Leads", value: num(totals.leads) },
          { label: "CPA", value: money(totals.cpa) },
          { label: "ROAS", value: totals.roas ? `${totals.roas.toFixed(2)}x` : "—" },
        ]}
      />

      <Card className="mt-6 p-5 shadow-soft">
        <p className="text-sm font-medium">Evolução do investimento</p>
        <div className="mt-4 h-[240px]">
          {chart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhuma métrica registrada.
            </div>
          ) : (
            <GrowthAreaChart data={chart} />
          )}
        </div>
      </Card>

      <h2 className="mt-6 text-sm font-semibold">Registros manuais</h2>
      {metrics.length === 0 ? (
        <Card className="mt-3 border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum registro ainda.
        </Card>
      ) : (
        <Card className="mt-3 divide-y divide-border shadow-soft">
          {[...metrics].reverse().map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!isStaff}
              onClick={() => {
                setEditing(m);
                setMetricOpen(true);
              }}
              className="flex w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm font-medium">{formatDate(m.collected_at)}</p>
              <p className="text-xs text-muted-foreground">
                {money(m.spend)} · {num(m.impressions)} impr. · {num(m.clicks)} cliques ·{" "}
                {num(m.leads)} leads · {num(m.conversions)} conv.
              </p>
            </button>
          ))}
        </Card>
      )}

      <MetricDialog
        open={metricOpen}
        onOpenChange={setMetricOpen}
        campaignId={campaignId}
        metric={editing}
      />
      <CampaignDialog open={editOpen} onOpenChange={setEditOpen} campaign={campaign} />
    </div>
  );
}
