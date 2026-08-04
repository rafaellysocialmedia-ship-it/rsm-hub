import { lazy, Suspense, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Users,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Send,
  CalendarCheck,
  Activity,
  CircleDollarSign,
  ArrowUpRight,
  Sparkles,
  Radio,
} from "lucide-react";
// Gráficos (recharts) carregam sob demanda, depois dos cartões principais.
const GrowthAreaChart = lazy(() =>
  import("@/components/dashboard/charts").then((m) => ({ default: m.GrowthAreaChart })),
);
const StatusPieChart = lazy(() =>
  import("@/components/dashboard/charts").then((m) => ({ default: m.StatusPieChart })),
);

import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  subMonths,
  startOfMonth,
  formatDistanceToNow,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { statusMeta, type Client } from "@/lib/clients";
import { cn } from "@/lib/utils";
import { ChartSkeleton, ListSkeleton } from "@/components/skeletons";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Social Media Hub" },
      { name: "description", content: "Visão geral em tempo real da sua operação de social media." },
    ],
  }),
  component: DashboardPage,
});

async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function DashboardPage() {
  const { profile, user, hasRole } = useAuth();
  const qc = useQueryClient();
  const name = profile?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";
  const isStaff = hasRole("administrator") || hasRole("team");

  if (!isStaff) {
    return <ClientDashboard name={name} />;
  }

  return <StaffDashboard qc={qc} name={name} />;
}

function StaffDashboard({ qc, name }: { qc: ReturnType<typeof useQueryClient>; name: string }) {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["dash-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("id,title,status,scheduled_date,scheduled_time,client_id,social_network");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["dash-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("post_approvals").select("id,decision,post_id,client_id,created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id,title,status,due_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["dash-finance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_transactions").select("id,type,status,amount,issue_date,paid_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["dash-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,meeting_date,meeting_time,status,client_id")
        .eq("status", "scheduled")
        .gte("meeting_date", new Date().toISOString().slice(0, 10))
        .order("meeting_date", { ascending: true })
        .order("meeting_time", { ascending: true, nullsFirst: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["dash-activity"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_activity_log")
        .select("id,action,detail,created_at,post_id,client_id")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: invalidate on any change
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => qc.invalidateQueries({ queryKey: ["clients"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => qc.invalidateQueries({ queryKey: ["dash-posts"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "post_approvals" }, () => qc.invalidateQueries({ queryKey: ["dash-approvals"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => qc.invalidateQueries({ queryKey: ["dash-tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, () => qc.invalidateQueries({ queryKey: ["dash-finance"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => qc.invalidateQueries({ queryKey: ["dash-meetings"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "post_activity_log" }, () => qc.invalidateQueries({ queryKey: ["dash-activity"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "active").length;
    const inactive = clients.filter((c) => c.status === "inactive").length;
    const paused = clients.filter((c) => c.status === "paused").length;
    const prospect = clients.filter((c) => c.status === "prospect").length;
    return { total, active, inactive, paused, prospect };
  }, [clients]);

  const postMetrics = useMemo(() => {
    const scheduled = posts.filter((p) => p.status === "scheduled").length;
    const published = posts.filter((p) => p.status === "published").length;
    return { scheduled, published };
  }, [posts]);

  const pendingApprovals = useMemo(
    () => (approvals as Array<{ decision: string }>).filter((a) => a.decision === "pending").length,
    [approvals],
  );

  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (tasks as Array<{ status: string; due_date: string | null }>)
      .filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
  }, [tasks]);

  const monthRevenue = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return (transactions as Array<{ type: string; status: string; amount: number | string; paid_date: string | null; issue_date: string }>)
      .filter((t) => t.type === "income" && t.status === "paid")
      .filter((t) => (t.paid_date ?? t.issue_date).startsWith(ym))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  const trend = useMemo(() => {
    const months: { key: string; label: string; clientes: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM", { locale: ptBR }),
        clientes: 0,
      });
    }
    clients.forEach((c) => {
      if (!c.created_at) return;
      const key = format(new Date(c.created_at), "yyyy-MM");
      const m = months.find((x) => x.key === key);
      if (m) m.clientes += 1;
    });
    let acc = 0;
    return months.map((m) => {
      acc += m.clientes;
      return { ...m, total: acc };
    });
  }, [clients]);

  const distribution = useMemo(
    () => [
      { name: "Ativos", value: metrics.active, color: "hsl(152 76% 44%)" },
      { name: "Pausados", value: metrics.paused, color: "hsl(38 92% 55%)" },
      { name: "Prospects", value: metrics.prospect, color: "hsl(199 89% 55%)" },
      { name: "Inativos", value: metrics.inactive, color: "hsl(var(--muted-foreground))" },
    ],
    [metrics],
  );

  const recentActivity = useMemo(() => clients.slice(0, 6), [clients]);
  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Bem-vindo de volta{name ? `, ${name}` : ""}.
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Tempo real
        </Badge>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de clientes"
          value={metrics.total}
          icon={Briefcase}
          loading={isLoading}
          accent="from-violet-500/20 to-transparent"
        />
        <StatCard
          label="Clientes ativos"
          value={metrics.active}
          icon={TrendingUp}
          loading={isLoading}
          accent="from-emerald-500/20 to-transparent"
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Clientes inativos"
          value={metrics.inactive}
          icon={Users}
          loading={isLoading}
          accent="from-slate-500/20 to-transparent"
        />
        <StatCard
          label="Receita paga (mês)"
          value={brl(monthRevenue)}
          hint="Somente transações pagas"
          icon={CircleDollarSign}
          loading={false}
          accent="from-amber-500/20 to-transparent"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Posts programados" value={postMetrics.scheduled} icon={Send} />
        <MiniStat label="Posts publicados" value={postMetrics.published} icon={CheckCircle2} />
        <MiniStat label="Aprovações pendentes" value={pendingApprovals} icon={Clock} tone="text-amber-500" />
        <MiniStat label="Tarefas atrasadas" value={overdueTasks} icon={AlertTriangle} tone="text-rose-500" />
      </div>

      {/* Monthly post quota */}
      <MonthlyQuotaCard clients={clients} posts={posts} />

      {/* Deliverable deadlines */}
      <DeadlinesCard clients={clients} />

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Crescimento de clientes</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
            <Badge variant="secondary" className="gap-1 text-xs">
              <TrendingUp className="h-3 w-3" /> Acumulado
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Suspense fallback={<ChartSkeleton />}>
                <GrowthAreaChart data={trend} />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por status</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Status dos clientes</p>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {metrics.total === 0 ? (
                <EmptyMini label="Sem clientes ainda" />
              ) : (
                <Suspense fallback={<ChartSkeleton />}>
                  <StatusPieChart data={distribution} />
                </Suspense>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {distribution.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly calendar + side panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Calendário semanal</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" disabled>
              <CalendarIcon className="h-3.5 w-3.5" /> Ver completo
            </Button>
          </CardHeader>
          <CardContent>
            <WeeklyCalendar />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Próximas reuniões</CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/meetings"><ArrowUpRight className="h-3.5 w-3.5" /> Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {meetings.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Nenhuma reunião" description="Agende a próxima reunião com seus clientes." />
            ) : (
              meetings.map((m) => (
                <Link
                  key={m.id}
                  to="/meetings"
                  className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted text-center">
                    <span className="text-[9px] uppercase leading-none text-muted-foreground">
                      {format(new Date(m.meeting_date + "T00:00:00"), "MMM", { locale: ptBR })}
                    </span>
                    <span className="mt-0.5 text-sm font-semibold leading-none">
                      {format(new Date(m.meeting_date + "T00:00:00"), "dd")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.meeting_time ? m.meeting_time.slice(0, 5) : "—"}
                      {m.client_id && clientNameById.get(m.client_id) ? ` · ${clientNameById.get(m.client_id)}` : ""}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Pendências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks === 0 && pendingApprovals === 0 ? (
              <EmptyState icon={Clock} title="Tudo em dia" description="Sem pendências no momento." />
            ) : (
              <>
                {overdueTasks > 0 && (
                  <Link to="/tasks" className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 hover:bg-rose-500/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                      <span className="text-sm">Tarefas atrasadas</span>
                    </div>
                    <Badge variant="outline" className="border-rose-500/40 text-rose-600">{overdueTasks}</Badge>
                  </Link>
                )}
                {pendingApprovals > 0 && (
                  <Link to="/portal" className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 hover:bg-amber-500/10">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Aprovações pendentes</span>
                    </div>
                    <Badge variant="outline" className="border-amber-500/40 text-amber-600">{pendingApprovals}</Badge>
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Aprovações pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingApprovals === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nenhuma aprovação" description="Posts aguardando aprovação aparecerão aqui." />
            ) : (
              <Link to="/portal" className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center hover:bg-muted/40">
                <div className="text-3xl font-semibold text-amber-500">{pendingApprovals}</div>
                <p className="mt-1 text-xs text-muted-foreground">Publicações aguardando o cliente</p>
                <p className="mt-3 text-xs text-primary underline">Ir para aprovações</p>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas atividades</CardTitle>
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-0">
            {activityLoading ? (
              <ListSkeleton rows={5} className="px-6" />
            ) : activity.length === 0 ? (
              <div className="px-6">
                <EmptyState icon={Activity} title="Sem atividades" description="Ações recentes aparecerão aqui." />
              </div>

            ) : (
              <ul className="divide-y divide-border">
                {activity.map((a) => {
                  const item = a as { id: string; action: string; detail: string | null; created_at: string; client_id: string | null };
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-6 py-2.5">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {actionLabel(item.action)}
                          {item.client_id && clientNameById.get(item.client_id)
                            ? ` · ${clientNameById.get(item.client_id)}`
                            : ""}
                        </p>
                        {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    commented: "Novo comentário",
    approval_approved: "Aprovação concedida",
    approval_rejected: "Publicação rejeitada",
    approval_changes_requested: "Alterações solicitadas",
  };
  return map[a] ?? a;
}


function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  hint,
  accent,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  hint?: string;
  accent: string;
  tone?: string;
}) {
  return (
    <Card className="shadow-soft relative overflow-hidden">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl", accent)} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", tone)} />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className={cn("text-3xl font-semibold tracking-tight", tone)}>{value}</div>
          )}
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-muted", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyCalendar() {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const isToday = isSameDay(d, today);
        return (
          <div
            key={d.toISOString()}
            className={cn(
              "flex h-32 flex-col rounded-lg border p-2 transition-colors",
              isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted/40",
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {format(d, "EEE", { locale: ptBR })}
              </span>
              <span className={cn("text-sm font-semibold", isToday && "text-primary")}>
                {format(d, "dd")}
              </span>
            </div>
            <div className="mt-auto text-[10px] text-muted-foreground/60">—</div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </div>
  );
}

// ============================================================
// Client-scoped dashboard: only shows data related to this client
// ============================================================
function ClientDashboard({ name }: { name: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ["dash-client", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["dash-client-posts", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("client_id", client!.id)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; status: string; scheduled_date: string | null; scheduled_time: string | null; title: string; social_network: string | null }>;
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["dash-client-approvals", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_approvals")
        .select("*")
        .eq("client_id", client!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!client?.id) return;
    const channel = supabase
      .channel(`dash-client-${client.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `client_id=eq.${client.id}` },
        () => qc.invalidateQueries({ queryKey: ["dash-client-posts", client.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "post_approvals", filter: `client_id=eq.${client.id}` },
        () => qc.invalidateQueries({ queryKey: ["dash-client-approvals", client.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client?.id, qc]);

  const now = new Date();
  const total = posts.length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const published = posts.filter((p) => p.status === "published").length;
  const inReview = posts.filter((p) => p.status === "review").length;
  const pendingApproval = approvals.filter((a) => (a as { decision: string }).decision === "pending").length;

  const upcoming = posts
    .filter((p) => p.scheduled_date && new Date(p.scheduled_date + "T00:00:00") >= new Date(now.toDateString()))
    .slice(0, 6);

  if (!client) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá{ name ? `, ${name}` : ""}!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta ainda não foi vinculada a um cliente. Peça ao administrador para vincular seu login para você acompanhar suas publicações e aprovações.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Bem-vindo(a)</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Olá{ name ? `, ${name}` : ""} · {client.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe suas publicações e aprovações em tempo real.</p>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/portal"><ArrowUpRight className="h-4 w-4" /> Área do cliente</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CMiniStat icon={Send} label="Publicações totais" value={total} tint="bg-primary/10 text-primary" />
        <CMiniStat icon={CalendarCheck} label="Agendadas" value={scheduled} tint="bg-sky-500/10 text-sky-500" />
        <CMiniStat icon={CheckCircle2} label="Publicadas" value={published} tint="bg-emerald-500/10 text-emerald-500" />
        <CMiniStat icon={Clock} label="Aguardando você" value={pendingApproval} tint="bg-amber-500/10 text-amber-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Próximas publicações</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{upcoming.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma publicação futura ainda.</p>
            )}
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.scheduled_date ? format(new Date(p.scheduled_date + "T00:00:00"), "dd MMM", { locale: ptBR }) : "—"}
                    {p.scheduled_time ? ` · ${p.scheduled_time.slice(0,5)}` : ""}
                    {p.social_network ? ` · ${p.social_network}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Em revisão" value={inReview} />
            <Row label="Agendadas" value={scheduled} />
            <Row label="Publicadas" value={published} />
            <Row label="Aprovações pendentes" value={pendingApproval} highlight />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CMiniStat({ icon: Icon, label, value, tint }: { icon: typeof Send; label: string; value: number; tint: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tint)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", highlight && value > 0 && "text-amber-500")}>{value}</span>
    </div>
  );
}

function DeadlinesCard({ clients }: { clients: Client[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type Row = {
    clientId: string;
    clientName: string;
    kind: "profile" | "editorial";
    deadline: Date;
    days: number;
  };

  const rows: Row[] = [];
  (clients as unknown as Array<Client & {
    profile_project_deadline?: string | null;
    editorial_deadline?: string | null;
  }>).forEach((c) => {
    const push = (kind: Row["kind"], iso: string | null | undefined) => {
      if (!iso) return;
      const d = new Date(iso + "T00:00:00");
      const days = Math.round((d.getTime() - today.getTime()) / 86400000);
      rows.push({ clientId: c.id, clientName: c.name, kind, deadline: d, days });
    };
    push("profile", c.profile_project_deadline);
    push("editorial", c.editorial_deadline);
  });

  rows.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const upcoming = rows.slice(0, 10);

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Entregas em andamento</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Prazos de Projeto de Perfil e Editorial por cliente.</p>
        </div>
        <Badge variant="outline" className="gap-1 text-xs"><Clock className="h-3 w-3" />{rows.length}</Badge>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhum prazo definido. Edite um cliente para incluir prazos de Projeto de Perfil ou Editorial.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {upcoming.map((r) => {
              const overdue = r.days < 0;
              const urgent = r.days >= 0 && r.days <= 3;
              return (
                <Link
                  key={`${r.clientId}-${r.kind}`}
                  to="/clients/$clientId"
                  params={{ clientId: r.clientId }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                    overdue ? "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
                    : urgent ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                    : "border-border bg-card/50 hover:bg-muted/50",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md border text-center",
                    overdue ? "border-rose-500/40 text-rose-500"
                    : urgent ? "border-amber-500/40 text-amber-500"
                    : "border-border text-muted-foreground",
                  )}>
                    <span className="text-sm font-semibold leading-none">{Math.abs(r.days)}</span>
                    <span className="mt-0.5 text-[9px] uppercase leading-none">
                      {overdue ? "atras." : "dias"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.kind === "profile" ? "Projeto de Perfil" : "Editorial"}
                      {" · "}
                      {format(r.deadline, "dd 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>
                  {overdue && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyQuotaCard({
  clients,
  posts,
}: {
  clients: Client[];
  posts: { client_id: string | null; status: string | null; scheduled_date: string | null }[];
}) {
  const withQuota = clients.filter((c) => (c.monthly_post_quota ?? 0) > 0);
  if (withQuota.length === 0) return null;
  const ref = new Date();
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const rows = withQuota
    .map((c) => {
      const used = posts.filter((p) => {
        if (p.client_id !== c.id) return false;
        if (!p.scheduled_date) return false;
        const s = p.status ?? "";
        if (s === "archived" || s === "rejected") return false;
        const d = new Date(p.scheduled_date + "T00:00:00");
        return d.getFullYear() === y && d.getMonth() === m;
      }).length;
      const quota = c.monthly_post_quota ?? 0;
      return { client: c, used, quota, remaining: Math.max(0, quota - used) };
    })
    .sort((a, b) => (a.remaining === b.remaining ? b.quota - a.quota : b.remaining - a.remaining));

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Cota mensal de posts</CardTitle>
          <p className="mt-1 text-xs capitalize text-muted-foreground">
            {ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {withQuota.length} client{withQuota.length === 1 ? "e" : "es"} com cota
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ client, used, quota, remaining }) => {
            const pct = Math.min(100, Math.round((used / quota) * 100));
            const done = used >= quota;
            const closing = !done && used / quota >= 0.8;
            const barCls = done
              ? "bg-emerald-500"
              : closing
                ? "bg-amber-500"
                : "bg-primary";
            const label = done
              ? "Meta batida"
              : `${remaining} restante${remaining === 1 ? "" : "s"}`;
            return (
              <Link
                key={client.id}
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{client.name}</p>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      done
                        ? "text-emerald-600 dark:text-emerald-400"
                        : closing
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-primary",
                    )}
                  >
                    {used}/{quota}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", barCls)} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

