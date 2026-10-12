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
import { CalendarClock } from "lucide-react";
import { ContentFilters } from "@/components/posts/content-filters";
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
  const { user } = useAuth();
  const scope = `calendar:${user?.id}:${clientId ?? "all"}`;
  const [cursorText, setCursorText] = useStickyState(
    `${scope}:date`,
    format(new Date(), "yyyy-MM-dd"),
  );
  const cursor = new Date(cursorText + "T12:00:00");
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
  const zone = useQuery({
    queryKey: ["calendar-timezone"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calendar_timezone");
      if (error) throw error;
      return data;
    },
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone.data ?? "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  }, [cursorText, onMonthChange]);
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
      (providedPosts !== undefined || !channel || postNetworks(p).includes(channel)) &&
      (providedPosts !== undefined || !kind || p.format === kind) &&
      (providedPosts !== undefined || !status || p.status === status) &&
      (providedPosts !== undefined || p.title.toLowerCase().includes(search.toLowerCase())) &&
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
    <article
      key={p.id}
      draggable={movable(p) && !moving && !zone.isError && !zone.isPending}
      onDragStart={(e) => {
        setDragging(p);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", p.id);
      }}
      onDragEnd={() => {
        setDragging(null);
        setDestination(null);
      }}
      className={`min-w-0 rounded-lg border bg-white ${density === "compact" ? "p-1.5" : "p-2"} ${dragging?.id === p.id ? "opacity-50 ring-2 ring-[#b283f3]" : ""}`}
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
        <p
          className={`text-sm font-medium ${density === "compact" ? "truncate" : "break-words"}`}
          title={p.title}
        >
          {p.title}
        </p>
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
  return (
    <section className="@container space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Calendário compartilhado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprovação e publicação são etapas distintas. As datas mostram a previsão registrada pela
            equipe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Densidade do calendário"
            disabled={prefs.isPending || prefs.update.isPending}
            className={selectClass}
            value={density}
            onChange={(e) => prefs.update.mutate({ calendar_density: e.target.value })}
          >
            <option value="compact">Compacta</option>
            <option value="standard">Padrão</option>
            <option value="expanded">Ampliada</option>
          </select>
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
            <div className="hidden overflow-hidden rounded-xl border bg-card @[760px]:grid @[760px]:grid-cols-7">
              {days.map((d) => (
                <div
                  className={`${density === "compact" ? "min-h-24 p-1" : density === "expanded" ? "min-h-64 p-2" : "min-h-40 p-2"} min-w-0 space-y-2 border-b border-r ${destination === format(d, "yyyy-MM-dd") ? "bg-[#b283f3]/20 ring-2 ring-inset ring-[#69139b]" : ""}`}
                  onDragOver={(e) => {
                    if (dragging && format(d, "yyyy-MM-dd") >= today && !moving) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDestination(format(d, "yyyy-MM-dd"));
                    }
                  }}
                  onDragLeave={() => setDestination(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging && !moving && format(d, "yyyy-MM-dd") >= today)
                      void move(dragging, format(d, "yyyy-MM-dd"));
                  }}
                  key={format(d, "yyyy-MM-dd")}
                >
                  <p className="text-sm font-medium">{format(d, "EEE dd", { locale: ptBR })}</p>
                  {list
                    .filter((p) => p.scheduled_date === format(d, "yyyy-MM-dd"))
                    .slice(0, limit)
                    .map((p) => item(p))}
                  {list.filter((p) => p.scheduled_date === format(d, "yyyy-MM-dd")).length >
                    limit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full whitespace-normal text-xs"
                      onClick={() => setDayList(format(d, "yyyy-MM-dd"))}
                    >
                      +{" "}
                      {list.filter((p) => p.scheduled_date === format(d, "yyyy-MM-dd")).length -
                        limit}{" "}
                      publicações
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-3 @[760px]:hidden">{list.map((p) => item(p))}</div>
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
