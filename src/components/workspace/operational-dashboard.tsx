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
import { addDays, startOfWeek, format } from "date-fns";
type Item = { id: string; client: string; title: string; date: string | null; tab: string };
export function OperationalDashboard({ name }: { name: string }) {
  const access = useFinanceAccess();
  const retention = useRetention();
  const [selection, setSelection] = useState<string | null>(null);
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
                to="/management/clients/$clientId"
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
        <Button asChild>
          <Link to="/management/clients">Gerenciar clientes e histórico</Link>
        </Button>
      </header>
      <QueryState loading={q.isLoading} error={q.error}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Object.entries(groups).map(([title, items]) => (
            <button
              key={title}
              onClick={() => setSelection(title)}
              className="rounded-xl border bg-card p-5 text-left hover:border-primary/50"
            >
              <span className="text-sm text-muted-foreground">{title}</span>
              <strong className="mt-3 block text-3xl">{items.length}</strong>
              <span className="mt-2 block text-xs text-primary">Ver lista filtrada →</span>
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Agenda da semana</h2>
            {rows(agenda)}
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Andamento das contas</h2>
            <QueryState
              loading={retention.isLoading}
              error={retention.error}
              empty={!retention.data?.length}
            >
              <ul className="divide-y">
                {retention.data?.map((c) => (
                  <li className="flex items-center justify-between gap-3 py-3" key={c.client_id}>
                    <Link
                      className="text-sm font-medium hover:underline"
                      to="/management/clients/$clientId"
                      params={{ clientId: c.client_id }}
                      search={{ tab: "overview" }}
                    >
                      {c.name}
                    </Link>
                    <span
                      className={`text-sm ${c.health === "critical" ? "text-red-700" : c.health === "attention" ? "text-amber-800" : "text-emerald-800"}`}
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
