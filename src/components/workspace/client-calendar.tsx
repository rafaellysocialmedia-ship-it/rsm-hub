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
import { ChevronLeft, ChevronRight, Clock3, Plus, UserRound } from "lucide-react";
import { ContentFilters } from "@/components/posts/content-filters";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PostCreativeThumb } from "@/components/posts/post-creative-viewer";
import { PostNetworkBadges } from "@/components/posts/post-network-badges";
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
  const [daySearch, setDaySearch] = useState("");
  const [dayGrouping, setDayGrouping] = useState("time");
  useEffect(() => {
    setDaySearch("");
  }, [dayList]);
  const [dragging, setDragging] = useState<Post | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const workspace = usePostWorkspace();
  const prefs = useNavigationPreferences();
  const density = prefs.data?.calendar_density ?? "compact";
  // The monthly grid always shows two cards; other views retain their existing density.
  const limit =
    view === "month"
      ? density === "expanded"
        ? 3
        : 2
      : density === "compact"
        ? 5
        : density === "expanded"
          ? 2
          : 3;
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

  const item = (p: Post, thumb = false, showDate = false, modal = false) => (
    <article
      key={p.id}
      data-post-id={p.id}
      onDragStartCapture={(e) => {
        if (modal || !movable(p)) e.preventDefault();
      }}
      draggable={!modal && movable(p) && !moving && !zone.isError && !zone.isPending}
      onDragStart={(e) => {
        if (modal || !movable(p) || moving) {
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
      className={`group min-w-0 select-none rounded-lg border border-border/70 bg-card ${view === "month" && !modal ? "p-1.5" : density === "compact" && !modal ? "p-2" : "p-2.5"} shadow-none transition-colors hover:border-[#b283f3]/70 ${dragging?.id === p.id ? "opacity-50 ring-2 ring-[#b283f3]" : ""}`}
    >
      <button
        type="button"
        onClick={() => {
          if (!dragging) {
            setDayList(null);
            workspace.openPost(p);
          }
        }}
        aria-label={`Abrir publicação ${p.title}, ${statusMeta(p.status).label}`}
        className="block w-full min-w-0 space-y-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69139b]"
      >
        {view === "month" && !modal ? (
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {p.scheduled_time && (
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#42145d] dark:text-violet-200">
                  {p.scheduled_time.slice(0, 5)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={p.title}>
                {p.title}
              </span>
              <span
                className={`size-1.5 shrink-0 rounded-full ${statusMeta(p.status).dot}`}
                title={statusMeta(p.status).label}
                aria-label={statusMeta(p.status).label}
              />
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <PostNetworkBadges networks={postNetworks(p)} compact maxVisible={1} />
              <span
                className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground"
                title={
                  p.client_id
                    ? (clientNames.get(p.client_id) ?? "Cliente indisponível")
                    : "Sem cliente"
                }
              >
                {p.client_id
                  ? (clientNames.get(p.client_id) ?? "Cliente indisponível")
                  : "Sem cliente"}
              </span>
              <span
                className="max-w-[75px] shrink-0 truncate rounded bg-muted px-1 text-[9px] text-muted-foreground"
                title={statusMeta(p.status).label}
              >
                {statusMeta(p.status).label}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-sky-50 px-1.5 py-1 text-[10px] font-medium text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                <UserRound
                  className="size-3 shrink-0 text-sky-700 dark:text-sky-300"
                  aria-hidden="true"
                />
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
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-50 px-1.5 py-1 text-[10px] font-semibold tabular-nums text-[#42145d] dark:bg-violet-950/40 dark:text-violet-200"
                title={
                  p.scheduled_time
                    ? `Horário: ${p.scheduled_time.slice(0, 5)}`
                    : "Horário a definir"
                }
              >
                <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                {p.scheduled_time?.slice(0, 5) || "—:—"}
              </span>
            </div>
            {thumb && (
              <div className="max-h-28 overflow-hidden rounded-lg">
                <PostCreativeThumb postId={p.id} />
              </div>
            )}
            <p
              className={`min-w-0 text-xs font-semibold leading-snug text-foreground ${view === "month" && !modal ? "truncate" : "line-clamp-2"}`}
              title={p.title}
            >
              {p.title}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <PostNetworkBadges
                networks={postNetworks(p)}
                compact
                maxVisible={view === "month" && !modal ? 2 : undefined}
              />
              <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
              {p.format && (
                <span
                  className="inline-flex min-w-0 max-w-full truncate rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
                  title={p.format}
                >
                  {p.format}
                </span>
              )}
              <span
                className={`inline-flex min-w-0 max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta(p.status).tone}`}
                title={statusMeta(p.status).label}
              >
                {statusMeta(p.status).label}
              </span>
            </div>
            {showDate && p.scheduled_date && (
              <span className="block text-[10px] text-muted-foreground">
                {p.scheduled_date.split("-").reverse().join("/")}
              </span>
            )}
          </>
        )}
      </button>
      {!modal && workspace.canEdit && p.publication_source && p.publication_source !== "manual" && (
        <p
          className="mt-1 text-[10px] text-muted-foreground"
          title="Reagendamento gerenciado no provedor externo"
        >
          Reagendamento no provedor externo
        </p>
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
        className={`min-w-0 space-y-1 rounded-md border border-border/60 p-1.5 transition-colors ${view === "day" ? "min-h-40" : density === "compact" ? "min-h-[88px]" : density === "expanded" ? "min-h-48" : "min-h-28"} ${isToday ? "bg-[#b283f3]/10" : "bg-card"} ${selected ? "outline outline-2 -outline-offset-2 outline-[#69139b]" : ""} ${destination === date ? "ring-2 ring-inset ring-[#b283f3]" : ""}`}
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
            className="flex items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-[#69139b]"
          >
            <span className="text-[10px] text-muted-foreground">
              {format(d, "EEE", { locale: ptBR })}
            </span>
            <span
              className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-[#42145d] text-white" : "text-foreground"}`}
            >
              {format(d, "dd")}
            </span>
            {isToday && <span className="text-[10px] font-medium text-[#42145d]">Hoje</span>}
          </button>
          {workspace.canCreate && (
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
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
        <div className={view === "day" ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3" : "space-y-1"}>
          {shown.map((p) => item(p))}
        </div>
        {view !== "day" && posts.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-full justify-start rounded px-1 text-[10px] font-semibold text-[#42145d] hover:bg-[#b283f3]/15 dark:text-violet-200"
            aria-label={`Mostrar mais ${posts.length - limit} ${posts.length - limit === 1 ? "publicação" : "publicações"} de ${format(d, "dd/MM/yyyy")}`}
            onClick={() => setDayList(date)}
          >
            +{posts.length - limit} mostrar mais
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
    <section className="@container space-y-2">
      {(zone.isError || moving) && (
        <p className="text-xs text-muted-foreground" role="status">
          {zone.isError
            ? "Não foi possível verificar o fuso. Reagendamento indisponível até recarregar."
            : "Salvando nova data…"}
        </p>
      )}
      {prefs.error && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas preferências.
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            aria-label="Período anterior"
            variant="ghost"
            className="size-7 shrink-0"
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
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <h2 className="min-w-[105px] text-xs font-semibold capitalize sm:text-sm">
            {view === "day"
              ? format(cursor, "dd 'de' MMMM yyyy", { locale: ptBR })
              : view === "week"
                ? `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`
                : format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <Button
            type="button"
            size="icon"
            aria-label="Próximo período"
            variant="ghost"
            className="size-8 shrink-0"
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
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs shadow-none"
            onClick={() => {
              setCursorText(today);
              setSelectedDay(today);
            }}
          >
            Hoje
          </Button>
        </div>
        <div
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Visão do calendário"
        >
          {(providedPosts !== undefined
            ? [
                { value: "month", label: "Mês" },
                { value: "week", label: "Semana" },
                { value: "day", label: "Dia" },
              ]
            : [
                { value: "month", label: "Mês" },
                { value: "week", label: "Semana" },
                { value: "day", label: "Dia" },
                { value: "list", label: "Lista" },
                { value: "grid", label: "Grade" },
              ]
          ).map((mode) => (
            <Button
              type="button"
              key={mode.value}
              size="sm"
              variant={view === mode.value ? "secondary" : "ghost"}
              aria-pressed={view === mode.value}
              onClick={() => setView(mode.value)}
              className={`h-7 rounded-md px-2 text-[11px] shadow-none ${view === mode.value ? "font-semibold text-[#42145d]" : "text-muted-foreground"}`}
            >
              {mode.label}
            </Button>
          ))}
          {providedPosts !== undefined && (
            <>
              <label htmlFor="calendar-more-views" className="sr-only">
                Outras visualizações do calendário
              </label>
              <select
                id="calendar-more-views"
                aria-label="Outras visualizações do calendário"
                title="Outras visualizações do calendário"
                value={view === "list" || view === "grid" ? view : "other"}
                onChange={(e) => {
                  if (e.target.value !== "other") setView(e.target.value);
                }}
                className="h-7 max-w-[94px] rounded-md border border-border/70 bg-background px-1 text-[11px]"
              >
                <option value="other">Outras apresentações</option>
                <option value="list">Agenda do período</option>
                <option value="grid">Grade de prévias</option>
              </select>
            </>
          )}
          <label htmlFor="calendar-date-jump" className="sr-only">
            Ir para data
          </label>
          <input
            type="date"
            id="calendar-date-jump"
            title="Ir diretamente para uma data"
            className="h-7 w-[120px] max-w-full rounded-md border border-border/70 bg-background px-1.5 text-xs shadow-none"
            value={format(cursor, "yyyy-MM-dd")}
            onChange={(e) => {
              if (e.target.value) {
                setCursor(new Date(e.target.value + "T12:00:00"));
                setSelectedDay(e.target.value);
              }
            }}
          />
          <label htmlFor="calendar-density" className="sr-only">
            Tamanho dos cartões
          </label>
          <select
            id="calendar-density"
            title="Tamanho dos cartões"
            aria-label="Tamanho dos cartões"
            disabled={prefs.isPending || prefs.update.isPending}
            className="h-7 w-[84px] rounded-md border border-border/70 bg-background px-1.5 text-xs shadow-none"
            value={density}
            onChange={(e) => prefs.update.mutate({ calendar_density: e.target.value })}
          >
            <option value="compact">Compacto</option>
            <option value="standard">Padrão</option>
            <option value="expanded">Ampliado</option>
          </select>
        </div>
      </div>
      {providedPosts === undefined && (
        <div className="rounded-xl border border-border/60 bg-card p-3 sm:p-4">
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
          <div className="w-full overflow-x-auto rounded-lg">
            <div
              className={`grid gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}
              style={view === "day" ? undefined : { minWidth: "620px" }}
            >
              {days.map(dayCell)}
            </div>
          </div>
        ) : (
          <div
            className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}
          >
            {list.map((p) => item(p, view === "grid", true))}
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
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Publicações de {dayList?.split("-").reverse().join("/")}</DialogTitle>
            <DialogDescription>
              Todos os {list.filter((p) => p.scheduled_date === dayList).length} conteúdos deste
              dia, com os filtros atuais. Selecione um card para editar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <input
              aria-label="Buscar nas publicações do dia"
              placeholder="Buscar título ou cliente…"
              value={daySearch}
              onChange={(e) => setDaySearch(e.target.value)}
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <select
              aria-label="Organizar publicações do dia"
              value={dayGrouping}
              onChange={(e) => setDayGrouping(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="time">Por horário</option>
              <option value="client">Agrupar por cliente</option>
            </select>
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {(() => {
              const entries = list
                .filter(
                  (p) =>
                    p.scheduled_date === dayList &&
                    `${p.title} ${clientNames.get(p.client_id ?? "") ?? ""}`
                      .toLocaleLowerCase()
                      .includes(daySearch.toLocaleLowerCase()),
                )
                .sort(
                  (a, b) =>
                    (dayGrouping === "client"
                      ? (clientNames.get(a.client_id ?? "") ?? "").localeCompare(
                          clientNames.get(b.client_id ?? "") ?? "",
                        )
                      : 0) ||
                    (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99") ||
                    a.title.localeCompare(b.title),
                );
              return entries.length ? (
                entries.map((p, i) => (
                  <div key={p.id}>
                    {dayGrouping === "client" &&
                      (i === 0 || entries[i - 1].client_id !== p.client_id) && (
                        <h3 className="bg-card py-2 text-sm font-semibold">
                          {clientNames.get(p.client_id ?? "") ?? "Sem cliente"}
                        </h3>
                      )}
                    {item(p, true, false, true)}
                  </div>
                ))
              ) : (
                <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum conteúdo encontrado neste dia.
                </p>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
