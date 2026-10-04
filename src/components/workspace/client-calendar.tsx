import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReviewDialog } from "@/components/approval/review-dialog";
import { PostCreativeThumb } from "@/components/posts/post-creative-viewer";
import { QueryState } from "./account-panels";
import { statusMeta, postNetworks, POST_STATUS, type Post } from "@/lib/posts";
export function ClientCalendarPage({
  clientId,
  providedPosts,
  onMonthChange,
}: {
  clientId?: string;
  providedPosts?: Post[];
  onMonthChange?: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(new Date()),
    [view, setView] = useState("month"),
    [channel, setChannel] = useState(""),
    [kind, setKind] = useState(""),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState<Post | null>(null);
  useEffect(() => {
    onMonthChange?.(cursor);
  }, [cursor, onMonthChange]);
  const q = useQuery({
    enabled: !providedPosts,
    queryKey: ["portal-calendar-posts", clientId],
    refetchInterval: 15000,
    queryFn: async () => {
      let request = supabase
        .from("portal_posts")
        .select("*")
        .order("scheduled_date", { nullsFirst: false });
      if (clientId) request = request.eq("client_id", clientId);
      const { data, error } = await request;
      if (error) throw error;
      return data as Post[];
    },
  });
  const all = providedPosts ?? q.data ?? [];
  const start = view === "week" ? startOfWeek(cursor, { weekStartsOn: 1 }) : startOfMonth(cursor),
    end = view === "week" ? endOfWeek(cursor, { weekStartsOn: 1 }) : endOfMonth(cursor);
  const from = format(start, "yyyy-MM-dd"),
    to = format(end, "yyyy-MM-dd");
  const list = all.filter(
    (p) =>
      (!channel || postNetworks(p).includes(channel)) &&
      (!kind || p.format === kind) &&
      (!status || p.status === status) &&
      p.title.toLowerCase().includes(search.toLowerCase()) &&
      p.scheduled_date &&
      p.scheduled_date >= from &&
      p.scheduled_date <= to,
  );
  const days: Date[] = [];
  for (
    let d = view === "week" ? start : startOfWeek(start, { weekStartsOn: 1 });
    d <= (view === "week" ? end : endOfWeek(end, { weekStartsOn: 1 }));
    d = addDays(d, 1)
  )
    days.push(d);
  const selectClass = "min-h-11 rounded-md border bg-card px-3 text-sm";
  const item = (p: Post, thumb = false) => (
    <button
      key={p.id}
      onClick={() => setOpen(p)}
      className="block w-full min-w-0 space-y-2 rounded-lg border bg-card p-3 text-left hover:border-primary/40"
    >
      {thumb && <PostCreativeThumb postId={p.id} />}
      <p className="break-words text-sm font-medium">{p.title}</p>
      <p className="text-xs text-muted-foreground">
        {postNetworks(p).join(" · ")} · {p.format}
      </p>
      <p className="text-xs">
        {p.scheduled_date?.split("-").reverse().join("/")} {p.scheduled_time?.slice(0, 5)}
      </p>
      <span
        className={`inline-block rounded border px-2 py-1 text-xs ${statusMeta(p.status).tone}`}
      >
        {statusMeta(p.status).label}
      </span>
    </button>
  );
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Calendário compartilhado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprovação e publicação são etapas distintas. As datas mostram a previsão registrada pela
            equipe.
          </p>
        </div>
        <select
          aria-label="Visualização do calendário"
          className={selectClass}
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option value="month">Mês</option>
          <option value="week">Semana</option>
          <option value="list">Lista</option>
          <option value="grid">Grade de prévias</option>
        </select>
      </header>
      <div className="flex flex-wrap gap-2">
        <Input
          className="sm:max-w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conteúdo"
          aria-label="Buscar conteúdo"
        />
        <select
          aria-label="Canal"
          className={selectClass}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="">Todos os canais</option>
          {[...new Set(all.flatMap(postNetworks))].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <select
          aria-label="Formato"
          className={selectClass}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Todos os formatos</option>
          {[...new Set(all.map((p) => p.format).filter(Boolean))].map((n) => (
            <option key={n!}>{n}</option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {POST_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            aria-label="Período anterior"
            variant="outline"
            onClick={() => setCursor((d) => (view === "week" ? addDays(d, -7) : addMonths(d, -1)))}
          >
            ←
          </Button>
          <h3 className="text-sm font-semibold capitalize">
            {view === "week"
              ? `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`
              : format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button
            aria-label="Próximo período"
            variant="outline"
            onClick={() => setCursor((d) => (view === "week" ? addDays(d, 7) : addMonths(d, 1)))}
          >
            →
          </Button>
          <Button variant="ghost" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
        </div>
        <input
          type="date"
          className={selectClass}
          aria-label="Ir para período"
          value={format(cursor, "yyyy-MM-dd")}
          onChange={(e) => {
            if (e.target.value) setCursor(new Date(e.target.value + "T12:00:00"));
          }}
        />
      </div>
      <QueryState loading={!providedPosts && q.isLoading} error={q.error}>
        {view === "month" || view === "week" ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-card lg:grid lg:grid-cols-7">
              {days.map((d) => (
                <div
                  className="min-h-32 min-w-0 space-y-2 border-b border-r p-2"
                  key={d.toISOString()}
                >
                  <p className="text-sm font-medium">{format(d, "EEE dd", { locale: ptBR })}</p>
                  {list
                    .filter((p) => p.scheduled_date === format(d, "yyyy-MM-dd"))
                    .map((p) => item(p))}
                </div>
              ))}
            </div>
            <div className="space-y-3 lg:hidden">{list.map((p) => item(p))}</div>
          </>
        ) : (
          <div
            className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}
          >
            {list.map((p) => item(p, view === "grid"))}
          </div>
        )}
        {!list.length && (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Nenhum conteúdo neste período com os filtros selecionados.
          </p>
        )}
      </QueryState>
      {open && <ReviewDialog key={open.id} post={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
