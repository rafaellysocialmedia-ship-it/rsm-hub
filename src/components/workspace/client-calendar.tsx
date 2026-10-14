import { useCalendarToday } from "@/hooks/use-calendar-today";
import { calendarRange, shiftCalendar } from "@/lib/calendar-period";
import { ClientLabel } from "@/components/clients/client-label";
import { usePostWorkspace } from "@/components/posts/post-workspace";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { useStickyState } from "@/hooks/use-sticky-state";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarClock, Plus } from "lucide-react";
import { ContentFilters } from "@/components/posts/content-filters";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PostCreativeThumb } from "@/components/posts/post-creative-viewer";
import { QueryState } from "./account-panels";
import { statusMeta, postNetworks, POST_STATUS, type Post } from "@/lib/posts";
export function ClientCalendarPage({
  clientId,
  defaultClientId,
  providedPosts,
  onMonthChange,
}: {
  clientId?: string;
  defaultClientId?: string;
  providedPosts?: Post[];
  onMonthChange?: (date: Date) => void;
}) {
  const { user } = useAuth();
  const { today, zone } = useCalendarToday();
  const scope = `calendar:${user?.id}:${clientId ?? "all"}`;
  const [cursorText, setCursorText] = useStickyState(`${scope}:date`, "");
  const currentDate = cursorText || today;
  const cursor = new Date(currentDate + "T12:00:00");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const setCursor = (value: Date | ((date: Date) => Date)) =>
    setCursorText(format(typeof value === "function" ? value(cursor) : value, "yyyy-MM-dd"));
  const [view, setView] = useStickyState(`${scope}:view`, "month");
  const [channel, setChannel] = useStickyState(`${scope}:channel`, "");
  const [kind, setKind] = useStickyState(`${scope}:kind`, "");
  const [status, setStatus] = useStickyState(`${scope}:status`, "");
  const [search, setSearch] = useStickyState(`${scope}:search`, "");
  const [dayList, setDayList] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Post | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Post | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const workspace = usePostWorkspace();
  const prefs = useNavigationPreferences();
  const density = prefs.data?.calendar_density ?? "standard";
  const limit = density === "compact" ? 5 : density === "expanded" ? 2 : 3;
  const clients = useQuery({
    queryKey: ["calendar-client-labels", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,calendar_label_color");
      if (error) throw error;
      return data;
    },
  });
  const clientNames = new Map(clients.data?.map((c) => [c.id, c.name]));
  const clientColors = new Map(clients.data?.map((c) => [c.id, c.calendar_label_color]));
  const movable = (p: Post) =>
    workspace.canEdit &&
    p.status !== "published" &&
    (!p.publication_source || p.publication_source === "manual");
  const openMove = (p: Post) => {
    setMoveTarget(p);
    setMoveDate(p.scheduled_date ?? "");
    setMoveTime(p.scheduled_time?.slice(0, 5) ?? "");
  };
  const move = async (p: Post, date: string, time = p.scheduled_time) => {
    setMoving(true);
    try {
      return await workspace.movePost(p, date, time);
    } finally {
      setMoving(false);
      setDragging(null);
      setDestination(null);
    }
  };
  useEffect(() => {
    onMonthChange?.(cursor);
  }, [currentDate, onMonthChange]);
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
  const { start, end, from, to, days } = calendarRange(cursor, view);
  const list = all.filter(
    (p) =>
      (providedPosts !== undefined || !channel || postNetworks(p).includes(channel)) &&
      (providedPosts !== undefined || !kind || p.format === kind) &&
      (providedPosts !== undefined || !status || p.status === status) &&
      (providedPosts !== undefined || p.title.toLowerCase().includes(search.toLowerCase())) &&
      p.scheduled_date &&
      p.scheduled_date >= from &&
      p.scheduled_date <= to,
  );
  const selectClass = "h-9 max-w-full rounded-lg border border-input bg-background px-3 text-xs shadow-none";
  const item = (p: Post, thumb = false) => (
    <article
      key={p.id}
      data-post-id={p.id}
      onDragStartCapture={(e) => {
        if (!movable(p)) e.preventDefault();
      }}
      draggable={movable(p) && !moving && !zone.isError && !zone.isPending}
      onDragStart={(e) => {
        if (!movable(p) || moving) {
          e.preventDefault();
          return;
        }
        setDragging(p);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", p.id);
      }}
      onDragEnd={() => {
        setDragging(null);
        setDestination(null);
      }}
      className={`select-none min-w-0 rounded-lg border bg-white ${density === "compact" ? "p-1.5" : "p-2"} ${dragging?.id === p.id ? "opacity-50 ring-2 ring-[#b283f3]" : ""}`}
    >
      <button
        onClick={() => {
          if (!dragging) {
            setDayList(null);
            workspace.openPost(p);
          }
        }}
        className="block w-full min-w-0 space-y-1 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69139b]"
      >
        <div
          className={
            density === "compact"
              ? "float-left mr-2 w-10 max-h-8 overflow-hidden"
              : density === "expanded"
                ? "max-h-56 overflow-hidden"
                : thumb
                  ? "max-h-28 overflow-hidden"
                  : "max-h-16 overflow-hidden"
          }
        >
          <PostCreativeThumb postId={p.id} />
        </div>
        <ClientLabel
          id={p.client_id ?? "none"}
          color={p.client_id ? clientColors.get(p.client_id) : null}
          name={
            p.client_id
              ? (clientNames.get(p.client_id) ??
                (clients.isPending ? "Carregando cliente…" : "Cliente indisponível"))
              : "Sem cliente"
          }
        />
        <p
          className={`text-sm font-medium ${density === "compact" ? "truncate" : "break-words"}`}
          title={p.title}
        >
          {p.title}
        </p>
        {density === "compact" && p.format && (
          <span className="inline-flex max-w-full truncate rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
            title={`Formato: ${p.format}`}>Formato: {p.format}</span>
        )}
        {density !== "compact" && (
          <p className="text-xs text-muted-foreground">
            {postNetworks(p).join(" · ")} · {p.format}
          </p>
        )}
        <p className="text-xs">
          {p.scheduled_date?.split("-").reverse().join("/")} ·{" "}
          {p.scheduled_time?.slice(0, 5) ?? "Sem horário"}
        </p>
        <span
          className={`inline-block rounded border px-1.5 py-0.5 text-xs ${statusMeta(p.status).tone}`}
        >
          {statusMeta(p.status).label}
        </span>
      </button>
      {workspace.canEdit && p.publication_source && p.publication_source !== "manual" && (
        <p className="mt-1 text-xs text-muted-foreground">Reagendamento no provedor externo</p>
      )}
      {movable(p) && (
        <Button
          variant="ghost"
          size="sm"
          disabled={moving || zone.isError || zone.isPending}
          className="mt-1 h-8 max-w-full gap-1 px-1 text-xs"
          onClick={() => {
            setDayList(null);
            openMove(p);
          }}
          aria-label={`Mover ${p.title} para outra data`}
        >
          <CalendarClock className="size-3 shrink-0" />
          <span className="truncate">Mover data</span>
        </Button>
      )}
    </article>
  );
  const go = (direction: number) => setCursor((d) => shiftCalendar(d, view, direction));
  const periodDrop = async (direction: number) => {
    if (!dragging?.scheduled_date || moving) return;
    const date = format(
      shiftCalendar(new Date(dragging.scheduled_date + "T12:00:00"), view, direction),
      "yyyy-MM-dd",
    );
    if (date < today) return;
    if (await move(dragging, date)) {
      setCursorText(date);
      setSelectedDay(date);
    }
  };
  const dayCell = (d: Date) => {
    const date = format(d, "yyyy-MM-dd");
    const isToday = date === today,
      selected = date === selectedDay;
    const posts = list.filter((p) => p.scheduled_date === date);
    const shown = view === "day" ? posts : posts.slice(0, limit);
    return (
      <div
        key={date}
        data-calendar-date={date}
        aria-current={isToday ? "date" : undefined}
        className={`min-w-0 space-y-2 border-b border-r p-2 ${view === "day" ? "min-h-64" : density === "compact" ? "@[760px]:min-h-24" : density === "expanded" ? "@[760px]:min-h-64" : "@[760px]:min-h-40"} ${isToday ? "bg-[#b283f3]/10" : "bg-white"} ${selected ? "outline outline-2 -outline-offset-2 outline-[#69139b]" : ""} ${destination === date ? "ring-2 ring-inset ring-[#b283f3]" : ""}`}
        onDragOver={(e) => {
          if (dragging && date >= today && !moving) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDestination(date);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDestination(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragging && !moving && date >= today) void move(dragging, date);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-1">
          <button
            type="button"
            aria-label={`${format(d, "dd/MM/yyyy")}${isToday ? ", hoje" : ""}`}
            aria-pressed={selected}
            onClick={() => setSelectedDay(date)}
            className="flex items-center gap-1.5 rounded focus-visible:ring-2 focus-visible:ring-[#69139b]"
          >
            <span className="text-xs text-muted-foreground">
              {format(d, "EEE", { locale: ptBR })}
            </span>
            <span
              className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-[#42145d] text-white" : "text-foreground"}`}
            >
              {format(d, "dd")}
            </span>
            {isToday && <span className="text-[10px] font-medium text-[#42145d]">Hoje</span>}
          </button>
          {workspace.canCreate && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`Criar publicação em ${format(d, "dd/MM/yyyy")}`}
              onClick={() =>
                workspace.createPost({
                  scheduled_date: date,
                  client_id: clientId ?? defaultClientId ?? null,
                })
              }
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>
        <div className={view === "day" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
          {shown.map((p) => item(p))}
        </div>
        {view !== "day" && posts.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full whitespace-normal text-xs"
            onClick={() => setDayList(date)}
          >
            + {posts.length - limit} publicações
          </Button>
        )}
        {view === "day" && !posts.length && (
          <p className="py-8 text-sm text-muted-foreground">
            Nenhuma publicação neste dia com os filtros atuais.
          </p>
        )}
      </div>
    );
  };
  return (
    <section className="@container space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {providedPosts === undefined ? "Calendário do cliente" : "Período e exibição"}
          </h2>
          {providedPosts === undefined && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Arraste conteúdos para mudar a data. A aprovação permanece independente da publicação.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="calendar-period-view" className="sr-only">Período do calendário</label>
          <select
            id="calendar-period-view"
            aria-label="Visualização do calendário"
            className={selectClass}
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="month">Mês</option>
            <option value="week">Semana</option>
            <option value="day">Dia</option>
            <option value="list">Lista por período</option>
            <option value="grid">Grade de prévias</option>
          </select>
          <label htmlFor="calendar-density" className="sr-only">Densidade do calendário</label>
          <select
            id="calendar-density"
            aria-label="Densidade do calendário"
            disabled={prefs.isPending || prefs.update.isPending}
            className={selectClass}
            value={density}
            onChange={(e) => prefs.update.mutate({ calendar_density: e.target.value })}
          >
            <option value="compact">Visual compacto</option>
            <option value="standard">Visual padrão</option>
            <option value="expanded">Visual ampliado</option>
          </select>
        </div>
      </header>
      <p className="text-xs text-muted-foreground" role="status">
        {zone.isError
          ? "Não foi possível verificar o fuso. Reagendamento indisponível até recarregar."
          : `Fuso da conta: ${zone.data ?? "carregando…"}. Mês e semana preservam o horário ao arrastar.`}
        {moving ? " Salvando nova data…" : ""} Datas anteriores a hoje não aceitam reagendamento.
      </p>
      {prefs.error && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas preferências.
        </p>
      )}
      {providedPosts === undefined && (
        <div className="rounded-xl border bg-card p-4">
          <ContentFilters
            search={search}
            onSearch={setSearch}
            filters={[
              {
                key: "status",
                label: "Status",
                value: status || "all",
                empty: "all",
                primary: true,
                onChange: (v) => setStatus(v === "all" ? "" : v),
                options: POST_STATUS.map((s) => ({ value: s.value, label: s.label })),
              },
              {
                key: "channel",
                label: "Canal",
                value: channel || "all",
                empty: "all",
                onChange: (v) => setChannel(v === "all" ? "" : v),
                options: [...new Set(all.flatMap(postNetworks))].map((n) => ({
                  value: n,
                  label: n,
                })),
              },
              {
                key: "format",
                label: "Formato",
                value: kind || "all",
                empty: "all",
                onChange: (v) => setKind(v === "all" ? "" : v),
                options: [...new Set(all.map((p) => p.format).filter((f): f is string => !!f))].map(
                  (f) => ({ value: f, label: f }),
                ),
              },
            ]}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            aria-label="Período anterior"
            variant="outline"
            onClick={() => go(-1)}
            title={
              dragging ? "Solte para mover ao mesmo dia do período anterior" : "Período anterior"
            }
            onDragOver={(e) => {
              if (dragging) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              void periodDrop(-1);
            }}
          >
            ←
          </Button>
          <h3 className="text-sm font-semibold capitalize">
            {view === "day"
              ? format(cursor, "dd 'de' MMMM yyyy", { locale: ptBR })
              : view === "week"
                ? `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`
                : format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button
            aria-label="Próximo período"
            variant="outline"
            onClick={() => go(1)}
            title={
              dragging ? "Solte para mover ao mesmo dia do próximo período" : "Próximo período"
            }
            onDragOver={(e) => {
              if (dragging) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              void periodDrop(1);
            }}
          >
            →
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCursorText(today);
              setSelectedDay(today);
            }}
          >
            Hoje
          </Button>
        </div>
        <input
          type="date"
          className={selectClass}
          aria-label="Ir para período"
          value={format(cursor, "yyyy-MM-dd")}
          onChange={(e) => {
            if (e.target.value) {
              setCursor(new Date(e.target.value + "T12:00:00"));
              setSelectedDay(e.target.value);
            }
          }}
        />
      </div>
      {dragging && (
        <p role="status" className="text-xs text-[#42145d]">
          Solte em um dia ou nas setas para mover ao período anterior/seguinte. O horário será
          preservado.
        </p>
      )}
      {clients.error && (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível carregar os nomes dos clientes.
        </p>
      )}
      <QueryState loading={!providedPosts && q.isLoading} error={q.error}>
        {view === "month" || view === "week" || view === "day" ? (
          <div
            className={`overflow-hidden rounded-xl border bg-card ${view === "day" ? "" : "grid grid-cols-1 @[760px]:grid-cols-7"}`}
          >
            {days.map(dayCell)}
          </div>
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
      <Dialog
        open={!!dayList}
        onOpenChange={(v) => {
          if (!v) setDayList(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Publicações de {dayList?.split("-").reverse().join("/")}</DialogTitle>
            <DialogDescription>Todos os conteúdos do dia com os filtros atuais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {list.filter((p) => p.scheduled_date === dayList).map((p) => item(p))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!moveTarget}
        onOpenChange={(v) => {
          if (!v && !moving) setMoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para outra data</DialogTitle>
            <DialogDescription>
              {moveTarget?.title} · {zone.data}. Uma mudança de data pode exigir nova revisão.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            Data
            <input
              type="date"
              min={today}
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className={`${selectClass} block w-full`}
            />
          </label>
          <label className="space-y-1 text-sm">
            Horário
            <input
              type="time"
              value={moveTime}
              onChange={(e) => setMoveTime(e.target.value)}
              className={`${selectClass} block w-full`}
            />
          </label>
          <Button
            disabled={moving || !moveDate || moveDate < today}
            onClick={async () => {
              if (moveTarget && (await move(moveTarget, moveDate, moveTime || null)))
                setMoveTarget(null);
            }}
          >
            {moving ? "Salvando…" : "Confirmar nova data"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
