import { useEffect, useMemo } from "react";
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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  // Realtime: invalidate on any change
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        () => qc.invalidateQueries({ queryKey: ["clients"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "active").length;
    const inactive = clients.filter((c) => c.status === "inactive").length;
    const paused = clients.filter((c) => c.status === "paused").length;
    const prospect = clients.filter((c) => c.status === "prospect").length;
    return { total, active, inactive, paused, prospect };
  }, [clients]);

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
    // cumulative
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
          label="Receita mensal"
          value="—"
          hint="Configure planos por valor"
          icon={CircleDollarSign}
          loading={false}
          accent="from-amber-500/20 to-transparent"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Posts programados" value={0} icon={Send} />
        <MiniStat label="Posts publicados" value={0} icon={CheckCircle2} />
        <MiniStat label="Aprovações pendentes" value={0} icon={Clock} tone="text-amber-500" />
        <MiniStat label="Tarefas atrasadas" value={0} icon={AlertTriangle} tone="text-rose-500" />
      </div>

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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {distribution.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
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
          <CardHeader>
            <CardTitle className="text-base">Próximas reuniões</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={CalendarCheck}
              title="Nenhuma reunião"
              description="Suas próximas reuniões com clientes aparecerão aqui."
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Pendências</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Clock} title="Tudo em dia" description="Sem pendências no momento." />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Aprovações pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={CheckCircle2} title="Nenhuma aprovação" description="Posts aguardando aprovação aparecerão aqui." />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas atividades</CardTitle>
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="space-y-3 px-6">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="px-6">
                <EmptyState icon={Activity} title="Sem atividades" description="Ações recentes aparecerão aqui." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentActivity.map((c) => {
                  const meta = statusMeta(c.status);
                  return (
                    <li key={c.id}>
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: c.id }}
                        className="flex items-center gap-3 px-6 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.tone)}>
                          {meta.label}
                        </Badge>
                      </Link>
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
