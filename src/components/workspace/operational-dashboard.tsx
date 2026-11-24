import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceAccess } from "@/hooks/use-finance";
import { useRetention } from "@/hooks/use-retention";
import { localDate } from "@/lib/account-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QueryState } from "./account-panels";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { isActiveClient } from "@/lib/active-clients";
import { AlertTriangle, CalendarPlus, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { addDays, startOfWeek, format } from "date-fns";
type Item = { id: string; client: string; title: string; date: string | null; tab: string };
/** Ordem de gravidade em "Andamento das contas". */
const SEVERITY: Record<string, number> = { critical: 0, attention: 1 };
export function OperationalDashboard({ name }: { name: string }) {
  const access = useFinanceAccess();
  const retention = useRetention();
  const [selection, setSelection] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const isMobile = useIsMobile();
  const today = localDate(),
    soon = format(addDays(new Date(today + "T12:00:00"), 7), "yyyy-MM-dd");
  const weekStart = format(
      startOfWeek(new Date(today + "T12:00:00"), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    ),
    weekEnd = format(addDays(new Date(weekStart + "T12:00:00"), 6), "yyyy-MM-dd");
  const q = useQuery({
    queryKey: ["operational-dashboard", access.canView],
    refetchInterval: 30000,
    queryFn: async () => {
      const clients = await supabase
        .from("clients")
        .select("id,name")
        .eq("status", "active")
        .eq("churned", false);
      if (clients.error) throw clients.error;
      const ids = clients.data.map((c) => c.id);
      if (!ids.length)
        return {
          clients: [],
          posts: [],
          tasks: [],
          meetings: [],
          requests: [],
          charges: [],
          events: [],
        };
      const results = await Promise.all([
        supabase
          .from("posts")
          .select("id,client_id,title,status,scheduled_date")
          .in("client_id", ids),
        supabase.from("tasks").select("id,client_id,title,status,due_date").in("client_id", ids),
        supabase
          .from("meetings")
          .select("id,client_id,title,status,meeting_date,meeting_time")
          .in("client_id", ids),
        supabase
          .from("client_requests")
          .select("id,client_id,title,status,kind,due_date")
          .in("client_id", ids),
        access.canView
          ? supabase
              .from("finance_charges")
              .select("id,client_id,description,status,due_date")
              .in("client_id", ids)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("client_timeline")
          .select("id,client_id,title,created_at")
          .in("client_id", ids)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
      for (const r of results) if (r.error) throw r.error;
      return {
        clients: clients.data,
        posts: results[0].data ?? [],
        tasks: results[1].data ?? [],
        meetings: results[2].data ?? [],
        requests: results[3].data ?? [],
        charges: results[4].data ?? [],
        events: results[5].data ?? [],
      };
    },
  });
  const d = q.data;
  const clientName = (id: string) => d?.clients.find((c) => c.id === id)?.name ?? "Conta";
  const groups: Record<string, Item[]> = {
    "Aprovações atrasadas": (d?.posts ?? [])
      .filter(
        (p) =>
          ["review", "changes_requested"].includes(p.status) &&
          p.scheduled_date &&
          p.scheduled_date < today,
      )
      .map((p) => ({
        id: p.id,
        client: p.client_id!,
        title: p.title,
        date: p.scheduled_date,
        tab: "approvals",
      })),
    "Materiais aguardados": (d?.requests ?? [])
      .filter((r) => r.kind === "material" && r.status === "waiting_client")
      .map((r) => ({
        id: r.id,
        client: r.client_id,
        title: r.title,
        date: r.due_date,
        tab: "support",
      })),
    "Tarefas vencidas": (d?.tasks ?? [])
      .filter((t) => t.status !== "done" && t.due_date && t.due_date < today)
      .map((t) => ({
        id: t.id,
        client: t.client_id!,
        title: t.title,
        date: t.due_date,
        tab: "demands",
      })),
    "Publicações próximas": (d?.posts ?? [])
      .filter(
        (p) =>
          p.status !== "published" &&
          p.status !== "archived" &&
          p.status !== "rejected" &&
          p.scheduled_date &&
          p.scheduled_date >= today &&
          p.scheduled_date <= soon,
      )
      .map((p) => ({
        id: p.id,
        client: p.client_id!,
        title: p.title,
        date: p.scheduled_date,
        tab: "calendar",
      })),
    "Reuniões de hoje": (d?.meetings ?? [])
      .filter((m) => m.status === "scheduled" && m.meeting_date === today)
      .map((m) => ({
        id: m.id,
        client: m.client_id!,
        title: m.title,
        date: m.meeting_date,
        tab: "meetings",
      })),
    ...(access.canView
      ? {
          "Cobranças vencidas": (d?.charges ?? [])
            .filter((c) => ["pending", "overdue"].includes(c.status) && c.due_date < today)
            .map((c) => ({
              id: c.id,
              client: c.client_id,
              title: c.description,
              date: c.due_date,
              tab: "finance",
            })),
        }
      : {}),
  };
  const rows = (items: Item[]) =>
    items.length ? (
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">{i.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {clientName(i.client)}
                {i.date && ` · ${i.date.split("-").reverse().join("/")}`}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link
                to="/clientes/$clientId"
                params={{ clientId: i.client }}
                search={{ tab: i.tab }}
              >
                Abrir conta
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="py-5 text-sm text-muted-foreground">Nenhum registro nesta lista.</p>
    );
  const agenda = (d?.meetings ?? [])
    .filter(
      (m) => m.status === "scheduled" && m.meeting_date >= weekStart && m.meeting_date <= weekEnd,
    )
    .map((m) => ({
      id: m.id,
      client: m.client_id!,
      title: `${m.meeting_time?.slice(0, 5) || ""} ${m.title}`,
      date: m.meeting_date,
      tab: "meetings",
    }));
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Olá, {name}.{" "}
            {new Date(today + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sua atenção hoje</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pendências e próximos compromissos das contas ativas.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/clientes">Gerenciar clientes e histórico</Link>
        </Button>
      </header>
      <QueryState loading={q.isLoading} error={q.error}>
        {(() => {
          // Cards que pedem ação: só aparecem em destaque quando há algo a fazer.
          const ACTIONS = [
            { title: "Cobranças vencidas", tone: "critical", cta: "Cobrar", to: "/financeiro/receber" },
            { title: "Tarefas vencidas", tone: "critical", cta: "Ver tarefas", to: "/tarefas", search: { de: "equipe", overdue: "1" } },
            { title: "Aprovações atrasadas", tone: "warning", cta: "Ver aprovações", to: "/conteudo/aprovacoes" },
            { title: "Materiais aguardados", tone: "warning", cta: "Ver pedidos" },
          ] as const;
          const pending = ACTIONS.filter((a) => (groups[a.title]?.length ?? 0) > 0);
          const meetingsToday = groups["Reuniões de hoje"] ?? [];
          const upcoming = groups["Publicações próximas"] ?? [];
          const zeroNames = [
            ...ACTIONS.filter((a) => a.title in groups && !(groups[a.title]?.length ?? 0)).map((a) =>
              a.title === "Cobranças vencidas"
                ? "cobranças"
                : a.title === "Tarefas vencidas"
                  ? "tarefas"
                  : a.title === "Aprovações atrasadas"
                    ? "aprovações"
                    : "materiais",
            ),
            ...(meetingsToday.length ? [] : ["reuniões de hoje"]),
          ];
          return (
            <div className="space-y-3">
              {pending.length === 0 && meetingsToday.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-5" aria-hidden />
                    </span>
                    <p className="text-base font-semibold">Tudo em dia por hoje.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="h-10">
                      <Link to="/conteudo/calendario">Abrir Calendário</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-10">
                      <Link to="/tarefas" search={{ de: "minhas" }}>Abrir Tarefas</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {pending.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {pending.map((a) => {
                        const items = groups[a.title] ?? [];
                        const accounts = new Set(items.map((i) => i.client)).size;
                        const critical = a.tone === "critical";
                        return (
                          <div
                            key={a.title}
                            className={`flex flex-col gap-3 rounded-xl border p-4 ${critical ? "border-red-500/40 bg-red-500/[0.06]" : "border-amber-500/50 bg-amber-500/[0.07]"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-sm font-medium ${critical ? "text-red-800 dark:text-red-200" : "text-amber-900 dark:text-amber-200"}`}>
                                {a.title}
                              </span>
                              <AlertTriangle
                                className={`size-4 shrink-0 ${critical ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}
                                aria-hidden
                              />
                            </div>
                            <div>
                              <strong className="block text-3xl font-semibold tabular-nums tracking-tight">{items.length}</strong>
                              <span className="text-xs text-muted-foreground">
                                {accounts} {accounts === 1 ? "conta" : "contas"}
                              </span>
                            </div>
                            <div className="mt-auto flex flex-wrap gap-2">
                              {"to" in a ? (
                                <Button asChild size="sm" className="h-10 flex-1">
                                  <Link to={a.to as never} search={("search" in a ? a.search : undefined) as never}>
                                    {a.cta}
                                  </Link>
                                </Button>
                              ) : (
                                <Button size="sm" className="h-10 flex-1" onClick={() => setSelection(a.title)}>
                                  {a.cta}
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-10" onClick={() => setSelection(a.title)}>
                                Ver lista
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {zeroNames.length > 0 && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                      Tudo em dia: {zeroNames.join(", ")}
                    </p>
                  )}
                </>
              )}
              {/* Informativos (sem cor de alerta). */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Publicações próximas</span>
                    <strong className="block text-2xl font-semibold tabular-nums">{upcoming.length}</strong>
                    <span className="text-xs text-muted-foreground">Hoje e próximos 7 dias</span>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-10">
                    <Link to="/conteudo/calendario">Ver calendário</Link>
                  </Button>
                </div>
                {meetingsToday.length > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Reuniões de hoje</span>
                      <strong className="block text-2xl font-semibold tabular-nums">{meetingsToday.length}</strong>
                    </div>
                    <Button variant="outline" size="sm" className="h-10" onClick={() => setSelection("Reuniões de hoje")}>
                      Ver reuniões
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* No celular: cards de ação → Andamento das contas → Agenda da semana. */}
          <section className={`order-2 rounded-xl border bg-card p-5 lg:order-1 ${agenda.length ? "" : "self-start"}`}>
            <h2 className="text-lg font-semibold">Agenda da semana</h2>
            {[
              ["Passadas · verificar conclusão", agenda.filter((i) => i.date && i.date < today)],
              ["Hoje", agenda.filter((i) => i.date === today)],
              ["Próximas", agenda.filter((i) => i.date && i.date > today)],
            ].map(
              ([label, entries]) =>
                (entries as Item[]).length > 0 && (
                  <div key={label as string} className="mt-3">
                    <h3 className="text-xs font-medium text-muted-foreground">{label as string}</h3>
                    {rows(
                      (entries as Item[]).sort((a, b) =>
                        (a.date ?? "").localeCompare(b.date ?? ""),
                      ),
                    )}
                  </div>
                ),
            )}
            {!agenda.length && (
              // Semana sem reunião: card compacto com a ação de agendar.
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                <p className="text-sm text-muted-foreground">Nenhuma reunião nesta semana.</p>
                <Button size="sm" onClick={() => setMeetingOpen(true)}>
                  <CalendarPlus className="mr-1.5 size-4" aria-hidden /> Agendar reunião
                </Button>
              </div>
            )}
            <ScheduleMeeting open={meetingOpen} onOpenChange={setMeetingOpen} />
          </section>
          <section className="order-1 rounded-xl border bg-card p-5 lg:order-2">
            <h2 className="text-lg font-semibold">Andamento das contas</h2>
            <QueryState
              loading={retention.isLoading}
              error={retention.error}
              empty={!retention.data?.length}
            >
              <ul className="divide-y">
                {[...(retention.data ?? [])]
                  .sort((x, y) => (SEVERITY[x.health] ?? 2) - (SEVERITY[y.health] ?? 2) || x.name.localeCompare(y.name))
                  .filter((_, idx) => !isMobile || showAllAccounts || idx < 5)
                  .map((c) => (
                  <li className="flex items-center justify-between gap-3 py-3" key={c.client_id}>
                    <Link
                      className="text-sm font-medium hover:underline"
                      to="/clientes/$clientId"
                      params={{ clientId: c.client_id }}
                      search={{ tab: "overview" }}
                    >
                      {c.name}
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {c.overdue_payments > 0
                          ? `${c.overdue_payments} cobrança(s) vencida(s)`
                          : c.approvals_pending > 0
                            ? `${c.approvals_pending} aprovação(ões) pendente(s)`
                            : c.late_tasks > 0
                              ? "Demandas atrasadas"
                              : c.days_without_meeting >= c.checkin_days
                                ? "Reunião de acompanhamento pendente"
                                : "Rotina de acompanhamento"}
                      </span>
                    </Link>
                    <span
                      className={`text-sm ${c.health === "critical" ? "text-red-700 dark:text-red-300" : c.health === "attention" ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"}`}
                    >
                      {c.health === "critical"
                        ? "Precisa de ação"
                        : c.health === "attention"
                          ? "Atenção"
                          : "Em acompanhamento"}
                    </span>
                  </li>
                ))}
              </ul>
              {isMobile && !showAllAccounts && (retention.data?.length ?? 0) > 5 && (
                <Button variant="ghost" size="sm" className="mt-2 h-10 w-full" onClick={() => setShowAllAccounts(true)}>
                  Ver todas ({retention.data?.length})
                </Button>
              )}
            </QueryState>
          </section>
        </div>
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Atividades recentes</h2>
          {rows(
            (d?.events ?? []).map((e) => ({
              id: e.id,
              client: e.client_id,
              title: e.title,
              date: e.created_at.slice(0, 10),
              tab: "history",
            })),
          )}
        </section>
      </QueryState>
      <Dialog
        open={!!selection}
        onOpenChange={(o) => {
          if (!o) setSelection(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selection}</DialogTitle>
            <DialogDescription>
              Lista filtrada com os registros que compõem este indicador.
            </DialogDescription>
          </DialogHeader>
          {selection && rows(groups[selection] ?? [])}
        </DialogContent>
      </Dialog>
    </main>
  );
}

/** Abre o formulário de reunião com os clientes ativos (só carrega quando abre). */
function ScheduleMeeting({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const clients = useQuery({
    queryKey: ["meetings-clients"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, status, churned")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <MeetingDialog
      open={open}
      onOpenChange={onOpenChange}
      meeting={null}
      clients={(clients.data ?? []).filter(isActiveClient)}
    />
  );
}
