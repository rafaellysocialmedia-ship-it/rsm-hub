import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, History, LineChart, Pencil, Plus, Target } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTrafficAccess, useTrafficClients } from "@/hooks/use-traffic";
import { usePermissions } from "@/hooks/use-permissions";
import {
  campaignStatusMeta,
  money,
  num,
  objectiveLabel,
  platformLabel,
  sumMetrics,
  type TrafficCampaign,
  type TrafficLead,
  type TrafficMetric,
  type TrafficPlatform,
} from "@/lib/traffic";
import {
  PERIODS,
  dayLabel,
  kpiItems,
  NA,
  periodRange,
  roasLabel,
  type PeriodKey,
} from "@/lib/traffic-analytics";
import { formatDate } from "@/lib/client-master";
import { campaignHealth, type CampaignHealth } from "@/lib/campaign-health";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiGrid } from "@/components/traffic/kpi-grid";
import { CampaignDialog } from "@/components/traffic/campaign-dialog";
import { MetricDialog } from "@/components/traffic/metric-dialog";
import { CampaignCompare } from "@/components/traffic/campaign-compare";
import { TrafficLocked } from "@/components/traffic/traffic-locked";
import {
  LeadsBarChart,
  RevenueVsSpendChart,
  SpendVsLeadsChart,
  type SeriesPoint,
} from "@/components/traffic/traffic-charts";
import { GrowthAreaChart } from "@/components/dashboard/charts";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/traffic/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics de Tráfego Pago · Social Media Hub" },
      {
        name: "description",
        content:
          "Investimento, impressões, cliques, CTR, CPC, CPM, leads, conversões, CPA e ROAS das campanhas de tráfego pago.",
      },
      { property: "og:title", content: "Analytics de Tráfego Pago" },
      {
        property: "og:description",
        content: "Performance das campanhas de Meta Ads e Google Ads por período.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrafficAnalyticsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Não encontrado</div>
  ),
});

function TrafficAnalyticsPage() {
  const { isStaff, allowed, loading, client } = useTrafficAccess();
  const { can } = usePermissions();
  const { data: clients = [] } = useTrafficClients();

  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [platform, setPlatform] = useState<"all" | TrafficPlatform>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [tab, setTab] = useState("overview");

  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<TrafficCampaign | null>(null);
  const [metricTarget, setMetricTarget] = useState<{ campaignId: string; metric: TrafficMetric | null } | null>(null);

  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  const canCreate = isStaff && can("traffic.analytics", "create");
  const canEdit = isStaff && can("traffic.analytics", "edit");

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["traffic-campaigns"],
    enabled: allowed,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrafficCampaign[];
    },
  });

  /** Métricas apenas do período selecionado — nunca todo o histórico. */
  const { data: metrics = [], isLoading: loadingMetrics } = useQuery({
    queryKey: ["traffic-metrics", range.from, range.to],
    enabled: allowed,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_metrics")
        .select("*")
        .gte("collected_at", range.from)
        .lte("collected_at", range.to)
        .order("collected_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as TrafficMetric[];
    },
  });

  /** Leads do CRM (sem duplicar) — usados para relacionar conversões. */
  const { data: leads = [] } = useQuery({
    queryKey: ["traffic-leads-analytics"],
    enabled: allowed,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_leads")
        .select("id,client_id,campaign_id,stage,value,name")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Pick<TrafficLead, "id" | "client_id" | "campaign_id" | "stage" | "value" | "name">[];
    },
  });

  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          (clientFilter === "all" || c.client_id === clientFilter) &&
          (platform === "all" || c.platform === platform),
      ),
    [campaigns, clientFilter, platform],
  );

  const campaignIds = useMemo(() => new Set(visibleCampaigns.map((c) => c.id)), [visibleCampaigns]);
  const rows = useMemo(() => metrics.filter((m) => campaignIds.has(m.campaign_id)), [metrics, campaignIds]);
  const totals = useMemo(() => sumMetrics(rows), [rows]);

  const crmConversions = useMemo(
    () => leads.filter((l) => l.stage === "client" && l.campaign_id && campaignIds.has(l.campaign_id)),
    [leads, campaignIds],
  );

  const series = useMemo<SeriesPoint[]>(() => {
    const map = new Map<string, SeriesPoint>();
    rows.forEach((r) => {
      const cur =
        map.get(r.collected_at) ??
        { label: dayLabel(r.collected_at), spend: 0, leads: 0, conversions: 0, revenue: 0 };
      cur.spend += Number(r.spend ?? 0);
      cur.leads += r.leads ?? 0;
      cur.conversions += r.conversions ?? 0;
      cur.revenue += Number(r.revenue ?? 0);
      map.set(r.collected_at, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, spend: Number(v.spend.toFixed(2)), revenue: Number(v.revenue.toFixed(2)) }));
  }, [rows]);

  const spendSeries = useMemo(
    () => series.map((s) => ({ label: s.label, total: s.spend })),
    [series],
  );

  const hasRevenue = totals.revenue > 0;
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const history = useMemo(() => buildHistory(visibleCampaigns, rows), [visibleCampaigns, rows]);

  /** Investimento acumulado (todo o histórico) — base para detectar saldo esgotado. */
  const { data: lifetime = [] } = useQuery({
    queryKey: ["traffic-metrics-lifetime"],
    enabled: allowed,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_metrics")
        .select("campaign_id,spend,collected_at")
        .order("collected_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Pick<TrafficMetric, "campaign_id" | "spend" | "collected_at">[];
    },
  });

  /** Saúde por campanha: sem saldo, saldo baixo, pausada, vigência vencida, sem métricas. */
  const healthById = useMemo(() => {
    const spend = new Map<string, number>();
    const last = new Map<string, string>();
    for (const m of lifetime) {
      spend.set(m.campaign_id, (spend.get(m.campaign_id) ?? 0) + Number(m.spend ?? 0));
      const prev = last.get(m.campaign_id);
      if (!prev || m.collected_at > prev) last.set(m.campaign_id, m.collected_at);
    }
    const map = new Map<string, CampaignHealth>();
    for (const c of visibleCampaigns) {
      map.set(c.id, campaignHealth(c, spend.get(c.id) ?? 0, last.get(c.id) ?? null));
    }
    return map;
  }, [lifetime, visibleCampaigns]);

  const campaignAlerts = useMemo(
    () => visibleCampaigns.filter((c) => healthById.get(c.id)?.alert),
    [visibleCampaigns, healthById],
  );

  if (loading) return <div className="px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <TrafficLocked />;

  const header = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Analytics de Tráfego Pago</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {client
            ? `Resultados das campanhas de ${client.name}.`
            : "Performance das campanhas por período e plataforma."}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {period === "custom" && (
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">De</Label>
              <Input
                type="date"
                className="w-[150px]"
                value={custom.from || range.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Até</Label>
              <Input
                type="date"
                className="w-[150px]"
                value={custom.to || range.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </div>
          </div>
        )}

        <Select value={platform} onValueChange={(v) => setPlatform(v as "all" | TrafficPlatform)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as plataformas</SelectItem>
            <SelectItem value="meta_ads">Meta Ads</SelectItem>
            <SelectItem value="google_ads">Google Ads</SelectItem>
          </SelectContent>
        </Select>

        {isStaff && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px]">
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
        )}

        {canCreate && (
          <Button
            onClick={() => {
              setEditingCampaign(null);
              setCampaignOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Campanha
          </Button>
        )}
      </div>
    </div>
  );

  /* ---------------- Visão simplificada do cliente ---------------- */
  if (!isStaff) {
    const active = visibleCampaigns.filter((c) => c.status === "active");
    return (
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        {header}
        <KpiGrid className="mt-6" items={kpiItems(totals, { simplified: true })} />

        <Card className="mt-6 p-5 shadow-soft">
          <p className="text-sm font-medium">Investimento por dia</p>
          <div className="mt-4 h-[240px]">
            {spendSeries.length === 0 ? (
              <EmptyChart />
            ) : (
              <GrowthAreaChart data={spendSeries} />
            )}
          </div>
        </Card>

        <Card className="mt-6 p-5 shadow-soft">
          <p className="text-sm font-medium">Leads e conversões</p>
          <div className="mt-4 h-[240px]">
            {series.length === 0 ? <EmptyChart /> : <LeadsBarChart data={series} />}
          </div>
        </Card>

        <h2 className="mt-8 text-sm font-semibold">Campanhas ativas</h2>
        {active.length === 0 ? (
          <Card className="mt-3 border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhuma campanha ativa no momento.
          </Card>
        ) : (
          <Card className="mt-3 divide-y divide-border shadow-soft">
            {active.map((c) => {
              const t = sumMetrics(rows.filter((m) => m.campaign_id === c.id));
              return (
                <div key={c.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {platformLabel(c.platform)} · {objectiveLabel(c.objective)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {money(t.spend)} · {num(t.leads)} leads · {num(t.conversions)} conversões
                    </p>
                    {(() => {
                      const h = healthById.get(c.id);
                      if (!h || h.key === "ok") return null;
                      return (
                        <Badge variant="outline" className={h.tone}>
                          {h.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    );
  }

  /* ---------------- Visão do gestor de tráfego ---------------- */
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      {header}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* -------- Visão Geral -------- */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {loadingMetrics ? (
            <ListSkeleton rows={4} />
          ) : (
            <>
              <KpiGrid items={kpiItems(totals)} />

              {campaignAlerts.length > 0 && (
                <Card className="border-amber-500/30 p-5 shadow-soft">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-medium">
                      {campaignAlerts.length} campanha{campaignAlerts.length === 1 ? "" : "s"} precisa
                      {campaignAlerts.length === 1 ? "" : "m"} de atenção
                    </p>
                  </div>
                  <ul className="mt-3 divide-y divide-border">
                    {campaignAlerts.map((c) => {
                      const h = healthById.get(c.id)!;
                      return (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <Link
                              to="/traffic/campaigns/$campaignId"
                              params={{ campaignId: c.id }}
                              className="text-sm font-medium hover:underline"
                            >
                              {c.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {clientName(c.client_id)} · {platformLabel(c.platform)}
                              {h.detail ? ` · ${h.detail}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className={h.tone}>
                            {h.label}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}

              <Card className="p-5 shadow-soft">
                <p className="text-sm font-medium">Investimento ao longo do tempo</p>
                <div className="mt-4 h-[260px]">
                  {spendSeries.length === 0 ? <EmptyChart /> : <GrowthAreaChart data={spendSeries} />}
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5 shadow-soft">
                  <p className="text-sm font-medium">Leads e conversões</p>
                  <div className="mt-4 h-[240px]">
                    {series.length === 0 ? <EmptyChart /> : <LeadsBarChart data={series} />}
                  </div>
                </Card>
                <Card className="p-5 shadow-soft">
                  <p className="text-sm font-medium">Investimento x Leads</p>
                  <div className="mt-4 h-[240px]">
                    {series.length === 0 ? <EmptyChart /> : <SpendVsLeadsChart data={series} />}
                  </div>
                </Card>
              </div>

              {hasRevenue && (
                <Card className="p-5 shadow-soft">
                  <p className="text-sm font-medium">Receita x Investimento</p>
                  <div className="mt-4 h-[240px]">
                    <RevenueVsSpendChart data={series} />
                  </div>
                </Card>
              )}

              <Card className="p-5 shadow-soft">
                <p className="text-sm font-medium">Relação com o CRM</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Campanha → Investimento → Leads → Conversões → Receita
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <MiniStat label="Investimento" value={money(totals.spend)} />
                  <MiniStat label="Leads (métricas)" value={num(totals.leads)} />
                  <MiniStat label="Leads no CRM" value={num(leads.filter((l) => l.campaign_id && campaignIds.has(l.campaign_id)).length)} />
                  <MiniStat label="Fechados (conversões)" value={num(crmConversions.length)} />
                  <MiniStat
                    label="Receita CRM"
                    value={
                      crmConversions.length
                        ? money(crmConversions.reduce((a, l) => a + Number(l.value ?? 0), 0))
                        : NA
                    }
                  />
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/traffic/crm">Abrir CRM de Tráfego</Link>
                </Button>
              </Card>

              <CampaignCompare campaigns={visibleCampaigns} metrics={rows} />
            </>
          )}
        </TabsContent>

        {/* -------- Campanhas -------- */}
        <TabsContent value="campaigns" className="mt-6">
          {loadingCampaigns ? (
            <ListSkeleton />
          ) : visibleCampaigns.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhuma campanha encontrada para os filtros selecionados.
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleCampaigns.map((c) => {
                const t = sumMetrics(rows.filter((m) => m.campaign_id === c.id));
                const meta = campaignStatusMeta(c.status);
                return (
                  <Card key={c.id} className="p-4 shadow-soft">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/traffic/campaigns/$campaignId"
                            params={{ campaignId: c.id }}
                            className="text-sm font-medium hover:underline"
                          >
                            {c.name}
                          </Link>
                          <Badge variant="outline" className={meta.tone}>
                            {meta.label}
                          </Badge>
                          {(() => {
                            const h = healthById.get(c.id);
                            if (!h || h.key === "ok" || h.key === "paused" || h.key === "ended") return null;
                            return (
                              <Badge variant="outline" className={h.tone} title={h.detail}>
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                {h.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {clientName(c.client_id)} · {platformLabel(c.platform)} ·{" "}
                          {objectiveLabel(c.objective)} · {formatDate(c.start_date)} —{" "}
                          {c.end_date ? formatDate(c.end_date) : "em aberto"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <Stat label="Investimento" value={money(t.spend)} />
                        <Stat label="Leads" value={num(t.leads)} />
                        <Stat label="Conversões" value={num(t.conversions)} />
                        <Stat
                          label="CPA"
                          value={(t.conversions || t.leads) > 0 ? money(t.cpa) : NA}
                        />
                        <Stat label="ROAS" value={roasLabel(t.revenue, t.spend, t.roas)} />
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCampaign(c);
                                setCampaignOpen(true);
                              }}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMetricTarget({ campaignId: c.id, metric: null })}
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Métrica
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* -------- Métricas -------- */}
        <TabsContent value="metrics" className="mt-6">
          {loadingMetrics ? (
            <ListSkeleton />
          ) : rows.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhuma métrica lançada no período.
            </Card>
          ) : (
            <Card className="overflow-x-auto shadow-soft">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Campanha</th>
                    <th className="p-3 font-medium">Investimento</th>
                    <th className="p-3 font-medium">Impr.</th>
                    <th className="p-3 font-medium">Cliques</th>
                    <th className="p-3 font-medium">CTR</th>
                    <th className="p-3 font-medium">CPC</th>
                    <th className="p-3 font-medium">Leads</th>
                    <th className="p-3 font-medium">Conv.</th>
                    <th className="p-3 font-medium">CPA</th>
                    <th className="p-3 font-medium">ROAS</th>
                    {canEdit && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows
                    .slice()
                    .reverse()
                    .slice(0, 200)
                    .map((m) => {
                      const t = sumMetrics([m]);
                      const camp = campaigns.find((c) => c.id === m.campaign_id);
                      return (
                        <tr key={m.id}>
                          <td className="p-3 whitespace-nowrap">{formatDate(m.collected_at)}</td>
                          <td className="p-3">{camp?.name ?? "—"}</td>
                          <td className="p-3 whitespace-nowrap">{money(t.spend)}</td>
                          <td className="p-3">{num(t.impressions)}</td>
                          <td className="p-3">{num(t.clicks)}</td>
                          <td className="p-3">{t.impressions > 0 ? `${t.ctr.toFixed(2)}%` : NA}</td>
                          <td className="p-3 whitespace-nowrap">{t.clicks > 0 ? money(t.cpc) : NA}</td>
                          <td className="p-3">{num(t.leads)}</td>
                          <td className="p-3">{num(t.conversions)}</td>
                          <td className="p-3 whitespace-nowrap">
                            {(t.conversions || t.leads) > 0 ? money(t.cpa) : NA}
                          </td>
                          <td className="p-3">{roasLabel(t.revenue, t.spend, t.roas)}</td>
                          {canEdit && (
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setMetricTarget({ campaignId: m.campaign_id, metric: m })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* -------- Histórico -------- */}
        <TabsContent value="history" className="mt-6">
          {history.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
              Sem eventos no período selecionado.
            </Card>
          ) : (
            <Card className="divide-y divide-border shadow-soft">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 rounded-md bg-muted p-1.5">
                    {h.kind === "campaign" ? (
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : h.kind === "metric" ? (
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.campaignName} · {new Date(h.at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <CampaignDialog
        open={campaignOpen}
        onOpenChange={(v) => {
          setCampaignOpen(v);
          if (!v) setEditingCampaign(null);
        }}
        campaign={editingCampaign}
        defaultClientId={clientFilter === "all" ? null : clientFilter}
      />

      {metricTarget && (
        <MetricDialog
          open={!!metricTarget}
          onOpenChange={(v) => {
            if (!v) setMetricTarget(null);
          }}
          campaignId={metricTarget.campaignId}
          metric={metricTarget.metric}
        />
      )}
    </div>
  );
}
type HistoryEvent = {
  id: string;
  kind: "campaign" | "metric" | "status";
  title: string;
  campaignName: string;
  at: string;
};

/** Timeline derivada dos dados existentes (sem duplicar registros). */
function buildHistory(campaigns: TrafficCampaign[], metrics: TrafficMetric[]): HistoryEvent[] {
  const statusTitle: Record<string, string> = {
    active: "Campanha ativada",
    paused: "Campanha pausada",
    ended: "Campanha encerrada",
    setup: "Campanha em configuração",
  };
  const events: HistoryEvent[] = [];
  campaigns.forEach((c) => {
    events.push({
      id: `c-${c.id}`,
      kind: "campaign",
      title: "Campanha criada",
      campaignName: c.name,
      at: c.created_at,
    });
    if (c.updated_at !== c.created_at) {
      events.push({
        id: `s-${c.id}`,
        kind: "status",
        title: statusTitle[c.status] ?? "Campanha atualizada",
        campaignName: c.name,
        at: c.updated_at,
      });
    }
  });
  const nameOf = new Map(campaigns.map((c) => [c.id, c.name]));
  metrics.forEach((m) => {
    const name = nameOf.get(m.campaign_id) ?? "—";
    events.push({
      id: `m-${m.id}`,
      kind: "metric",
      title: "Métrica adicionada",
      campaignName: name,
      at: m.created_at,
    });
    if (m.updated_at !== m.created_at) {
      events.push({
        id: `mu-${m.id}`,
        kind: "metric",
        title: "Métrica alterada",
        campaignName: name,
        at: m.updated_at,
      });
    }
  });
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Nenhum dado no período selecionado.
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
