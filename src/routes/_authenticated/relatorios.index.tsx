import { calendarDateLabel } from "@/lib/calendar-period";
import { EmptyState } from "@/components/empty-state";
import { CardsSkeleton } from "@/components/skeletons";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, Heart, MessageCircle, Plus, Repeat, Share2, TrendingUp, TrendingDown, Users, Target, LayoutList, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { ListSkeleton } from "@/components/skeletons";
import { MetricsDialog } from "@/components/analytics/metrics-dialog";
import { BaselineDialog, type Baseline } from "@/components/analytics/baseline-dialog";
import type { Database } from "@/integrations/supabase/types";

type Metric = Database["public"]["Tables"]["post_metrics"]["Row"];

export const Route = createFileRoute("/_authenticated/relatorios/")({
  head: () => ({
    meta: [
      { title: "Resultados · Relatórios · RSM Gestão de Marketing" },
      { name: "description", content: "Métricas e relatórios de desempenho das publicações." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [editingPost, setEditingPost] = useState<{ postId: string; metric: Metric | null } | null>(
    null,
  );
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [showMore, setShowMore] = useState(false);
  // "Registrar métricas da semana": mostra só as publicações dos últimos 7 dias sem métricas.
  const [weekPending, setWeekPending] = useState(false);

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["analytics-posts"],
    queryFn: async () => {
      // Apenas os campos usados nesta tela — payload muito menor.
      const { data, error } = await supabase
        .from("portal_posts")
        .select("id,title,status,scheduled_date,client_id,social_network,social_networks")
        .in("status", ["published"])
        .order("scheduled_date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });

  const {
    data: metrics = [],
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery({
    queryKey: ["post-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_metrics")
        .select("*")
        .order("collected_at", { ascending: false });
      if (error) throw error;
      return data as Metric[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: baselines = [] } = useQuery({
    queryKey: ["client-baselines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_baselines").select("*");
      if (error) throw error;
      return data as Baseline[];
    },
  });

  const currentBaseline = useMemo(
    () =>
      clientFilter === "all" ? null : (baselines.find((b) => b.client_id === clientFilter) ?? null),
    [baselines, clientFilter],
  );

  const metricByPost = useMemo(() => {
    const m = new Map<string, Metric>();
    metrics.forEach((x) => {
      if (!m.has(x.post_id)) m.set(x.post_id, x);
    });
    return m;
  }, [metrics]);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          (clientFilter === "all" || p.client_id === clientFilter) &&
          (!period || p.scheduled_date?.startsWith(period)),
      ),
    [posts, clientFilter, period],
  );

  const totals = useMemo(() => {
    const ids = new Set(filteredPosts.map((p) => p.id));
    const rel = [...metricByPost.values()].filter((m) => ids.has(m.post_id));
    const sum = (k: keyof Metric) => rel.reduce((acc, m) => acc + ((m[k] as number) ?? 0), 0);
    const totalEng = sum("likes") + sum("comments") + sum("shares") + sum("saves");
    return {
      reach: sum("reach"),
      impressions: sum("impressions"),
      likes: sum("likes"),
      comments: sum("comments"),
      shares: sum("shares"),
      saves: sum("saves"),
      followers: sum("followers_gained"),
      videoViews: sum("video_views"),
      engagement: totalEng,
      engagementRate: sum("reach") > 0 ? (totalEng / sum("reach")) * 100 : 0,
      postsWithData: rel.length,
    };
  }, [metricByPost, filteredPosts]);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const listedPosts = weekPending
    ? filteredPosts.filter(
        (p) => !metricByPost.has(p.id) && !!p.scheduled_date && p.scheduled_date >= weekStart,
      )
    : filteredPosts;
  function startWeekRegistration() {
    setPeriod("");
    setWeekPending(true);
    requestAnimationFrame(() =>
      document.getElementById("publicacoes")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resultados
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Resultados</h1>
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? "Registre as métricas de cada publicação para acompanhar o alcance real."
              : "Métricas dos seus posts publicados."}
          </p>
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todos os clientes" />
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
      </header>

      {metricsError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as métricas. Atualize a página para tentar novamente.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm">
          Mês das publicações
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border bg-background p-2"
          />
        </label>
        {period && (
          <Button variant="ghost" size="sm" onClick={() => setPeriod("")}>
            Todos os períodos
          </Button>
        )}
        <p role="status" className="text-sm text-muted-foreground">
          {metricsLoading ? (
            <span className="inline-block h-3 w-64 animate-pulse rounded bg-muted align-middle" />
          ) : (
            <>
              {period || "Todos os períodos"} · {totals.postsWithData} de {filteredPosts.length}{" "}
              publicações com métricas. Última coleta de cada publicação; até 300 publicações mais
              recentes.
            </>
          )}
        </p>
      </div>
      {metricsLoading || postsLoading ? (
        <CardsSkeleton count={4} />
      ) : totals.postsWithData === 0 ? (
        // Sem métricas: um aviso com a ação, em vez de 10 cards com traço.
        <EmptyState
          icon={BarChart3}
          title="Ainda não há métricas registradas para este período."
          description="Registre alcance, curtidas e comentários das publicações para ver os resultados aqui."
          actions={
            isStaff ? [{ label: "Registrar métricas da semana", onClick: startWeekRegistration }] : []
          }
        />
      ) : (
        <div className="space-y-3">
          {/* No topo, só os 4 números principais; o restante fica em "Ver mais métricas". */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            hasData={totals.postsWithData > 0}
            icon={Eye}
            label="Alcance"
            value={totals.reach}
            tone="text-sky-500"
          />
          <MetricCard
            hasData={totals.postsWithData > 0}
            icon={TrendingUp}
            label="Engajamento"
            value={totals.engagement}
            tone="text-primary"
          />
          <MetricCard
            hasData={totals.postsWithData > 0}
            icon={Users}
            label="Seguidores"
            value={totals.followers}
            tone="text-amber-500"
          />
          <MetricCard
            hasData
            icon={LayoutList}
            label="Publicações"
            value={filteredPosts.length}
            tone="text-brand-accent"
          />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
            {showMore ? "Ver menos métricas" : "Ver mais métricas"}
          </Button>
          {showMore && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={BarChart3}
              label="Impressões"
              value={totals.impressions}
              tone="text-blue-500"
            />
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={Heart}
              label="Curtidas"
              value={totals.likes}
              tone="text-rose-500"
            />
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={MessageCircle}
              label="Comentários"
              value={totals.comments}
              tone="text-brand-accent"
            />
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={Share2}
              label="Compart."
              value={totals.shares}
              tone="text-emerald-500"
            />
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={Repeat}
              label="Salvamentos"
              value={totals.saves}
              tone="text-teal-500"
            />
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={Eye}
              label="Views vídeo"
              value={totals.videoViews}
              tone="text-indigo-500"
            />
            <MetricCard
              hasData={totals.postsWithData > 0}
              icon={TrendingUp}
              label="Taxa eng."
              value={`${totals.engagementRate.toFixed(1)}%`}
              tone="text-primary"
            />
            </div>
          )}
        </div>
      )}

      {clientFilter !== "all" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" /> Baseline vs atual
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {currentBaseline
                  ? `Snapshot registrado em ${new Date(currentBaseline.captured_at).toLocaleDateString("pt-BR")} · ${currentBaseline.network}`
                  : "Registre as métricas iniciais para comparar a evolução."}
              </p>
            </div>
            {isStaff && (
              <Button size="sm" variant="outline" onClick={() => setBaselineOpen(true)}>
                {currentBaseline ? (
                  "Editar baseline"
                ) : (
                  <>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Registrar baseline
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          {currentBaseline && totals.postsWithData > 0 && (
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <CompareCell
                label="Seguidores"
                baseline={currentBaseline.followers}
                current={totals.followers + currentBaseline.followers}
              />
              <CompareCell
                label="Alcance médio"
                baseline={currentBaseline.avg_reach}
                current={totals.postsWithData ? Math.round(totals.reach / totals.postsWithData) : 0}
              />
              <CompareCell
                label="Curtidas médias"
                baseline={currentBaseline.avg_likes}
                current={totals.postsWithData ? Math.round(totals.likes / totals.postsWithData) : 0}
              />
              <CompareCell
                label="Coment. médios"
                baseline={currentBaseline.avg_comments}
                current={
                  totals.postsWithData ? Math.round(totals.comments / totals.postsWithData) : 0
                }
              />
              <CompareCell
                label="Compart. médios"
                baseline={currentBaseline.avg_shares}
                current={
                  totals.postsWithData ? Math.round(totals.shares / totals.postsWithData) : 0
                }
              />
              <CompareCell
                label="Salvamentos"
                baseline={currentBaseline.avg_saves}
                current={totals.postsWithData ? Math.round(totals.saves / totals.postsWithData) : 0}
              />
              <CompareCell
                label="Taxa eng. (%)"
                baseline={Number(currentBaseline.engagement_rate)}
                current={Number(totals.engagementRate.toFixed(2))}
                suffix="%"
              />
              <CompareCell
                label="Impressões médias"
                baseline={currentBaseline.avg_impressions}
                current={
                  totals.postsWithData ? Math.round(totals.impressions / totals.postsWithData) : 0
                }
              />
            </CardContent>
          )}
        </Card>
      )}

      <Card id="publicacoes" className="scroll-mt-24">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">
            {weekPending
              ? `Publicações da semana sem métricas (${listedPosts.length})`
              : `Publicações (${filteredPosts.length})`}
          </CardTitle>
          {weekPending && (
            <Button size="sm" variant="ghost" onClick={() => setWeekPending(false)}>
              Ver todas as publicações
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {postsLoading ? (
            <ListSkeleton rows={6} />
          ) : listedPosts.length === 0 ? (
            <EmptyState
              compact
              icon={weekPending ? CheckCircle2 : LayoutList}
              title={
                weekPending
                  ? "Todas as publicações da semana já têm métricas."
                  : "Nenhuma publicação neste período."
              }
              description={
                weekPending
                  ? "Veja as outras publicações para registrar ou corrigir métricas."
                  : "As publicações publicadas aparecem aqui para você registrar as métricas."
              }
              actions={
                weekPending ? [{ label: "Ver todas as publicações", onClick: () => setWeekPending(false) }] : []
              }
            />
          ) : (
            listedPosts.map((p) => {
              const m = metricByPost.get(p.id);
              const clientName = p.client_id ? clientMap.get(p.client_id) : null;
              const meta = statusMeta(p.status);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {clientName && <span>{clientName}</span>}
                      {postNetworks(p).map((n) => (
                        <span key={n} className="rounded bg-muted px-1.5 py-0.5">
                          {n}
                        </span>
                      ))}
                      <Badge variant="outline" className={meta.tone}>
                        {meta.label}
                      </Badge>
                      {p.scheduled_date && <span>· {calendarDateLabel(p.scheduled_date)}</span>}
                    </div>
                  </div>
                  {m ? (
                    <div className="hidden gap-4 text-xs text-muted-foreground md:flex">
                      <span>
                        <Eye className="mr-1 inline h-3 w-3" />
                        {m.reach.toLocaleString("pt-BR")}
                      </span>
                      <span>
                        <Heart className="mr-1 inline h-3 w-3" />
                        {m.likes.toLocaleString("pt-BR")}
                      </span>
                      <span>
                        <MessageCircle className="mr-1 inline h-3 w-3" />
                        {m.comments.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Sem métricas
                    </Badge>
                  )}
                  {isStaff && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPost({ postId: p.id, metric: m ?? null })}
                    >
                      {m ? (
                        "Editar"
                      ) : (
                        <>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Registrar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {editingPost && (
        <MetricsDialog
          open={!!editingPost}
          onOpenChange={(o) => {
            if (!o) setEditingPost(null);
          }}
          postId={editingPost.postId}
          metric={editingPost.metric}
        />
      )}

      {clientFilter !== "all" && baselineOpen && (
        <BaselineDialog
          open={baselineOpen}
          onOpenChange={setBaselineOpen}
          clientId={clientFilter}
          baseline={currentBaseline}
        />
      )}
    </div>
  );
}

function CompareCell({
  label,
  baseline,
  current,
  suffix,
}: {
  label: string;
  baseline: number;
  current: number;
  suffix?: string;
}) {
  const diff = current - baseline;
  const pct = baseline > 0 ? (diff / baseline) * 100 : 0;
  const up = diff > 0;
  const flat = diff === 0;
  const color = flat ? "text-muted-foreground" : up ? "text-emerald-500" : "text-rose-500";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold">
          {current.toLocaleString("pt-BR")}
          {suffix ?? ""}
        </span>
        <span className="text-[11px] text-muted-foreground">
          vs {baseline.toLocaleString("pt-BR")}
          {suffix ?? ""}
        </span>
      </div>
      <div className={`mt-1 flex items-center gap-1 text-xs ${color}`}>
        {!flat && <Icon className="h-3 w-3" />}
        {flat
          ? "sem variação"
          : `${up ? "+" : ""}${diff.toLocaleString("pt-BR")}${suffix ?? ""} (${pct.toFixed(1)}%)`}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
  hasData,
}: {
  hasData: boolean;
  icon: typeof Eye;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between p-3">
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p
            title={!hasData ? "Sem dados registrados" : undefined}
            className="text-lg font-semibold"
          >
            {!hasData ? "—" : typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          </p>
        </div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </CardContent>
    </Card>
  );
}
