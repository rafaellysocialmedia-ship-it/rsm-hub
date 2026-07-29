import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarHeart, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { CommemorativeDatesDialog } from "@/components/posts/commemorative-dates-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CommemorativeDate = {
  id: string;
  name: string;
  month: number;
  day: number;
  category: string | null;
  emoji: string | null;
};

type Props = {
  posts: Post[];
  clientMap: Map<string, string>;
  onOpen: (p: Post) => void;
  onAddOn: (dateISO: string) => void;
  onMove: (id: string, dateISO: string) => void;
  onMonthChange?: (month: Date) => void;
};

export function CalendarView({ posts, clientMap, onOpen, onAddOn, onMove, onMonthChange }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [datesOpen, setDatesOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { onMonthChange?.(cursor); }, [cursor, onMonthChange]);

  const { data: commemoratives = [] } = useQuery({
    queryKey: ["commemorative-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commemorative_dates" as never)
        .select("id, name, month, day, category, emoji");
      if (error) throw error;
      return (data ?? []) as unknown as CommemorativeDate[];
    },
    staleTime: 60 * 60 * 1000,
  });


  const commemorativesByMD = useMemo(() => {
    const m = new Map<string, CommemorativeDate[]>();
    commemoratives.forEach((c) => {
      const key = `${c.month}-${c.day}`;
      const arr = m.get(key) ?? [];
      arr.push(c);
      m.set(key, arr);
    });
    return m;
  }, [commemoratives]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [cursor]);

  const byDate = useMemo(() => {
    const m = new Map<string, Post[]>();
    posts.forEach((p) => {
      if (!p.scheduled_date) return;
      const arr = m.get(p.scheduled_date) ?? [];
      arr.push(p);
      m.set(p.scheduled_date, arr);
    });
    // Ordena as publicações do dia por horário crescente (sem horário fica no fim)
    m.forEach((arr) => {
      arr.sort((a, b) => {
        const ta = a.scheduled_time ?? "99:99";
        const tb = b.scheduled_time ?? "99:99";
        return ta.localeCompare(tb);
      });
    });
    return m;
  }, [posts]);

  function handleEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    onMove(id, over);
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold capitalize">
          {format(cursor, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setCursor(startOfMonth(new Date()))}>Hoje</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleEnd}>
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div key={d} className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const list = byDate.get(iso) ?? [];
            const dates = commemorativesByMD.get(`${d.getMonth() + 1}-${d.getDate()}`) ?? [];
            return (
              <DayCell
                key={iso}
                date={d}
                iso={iso}
                inMonth={isSameMonth(d, cursor)}
                isToday={isSameDay(d, new Date())}
                posts={list}
                commemoratives={dates}
                clientMap={clientMap}
                onOpen={onOpen}
                onAdd={() => onAddOn(iso)}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function DayCell({
  date, iso, inMonth, isToday, posts, commemoratives, clientMap, onOpen, onAdd,
}: {
  date: Date; iso: string; inMonth: boolean; isToday: boolean;
  posts: Post[]; commemoratives: CommemorativeDate[]; clientMap: Map<string, string>;
  onOpen: (p: Post) => void; onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const [dayOpen, setDayOpen] = useState(false);
  const hasMore = posts.length > 3;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative min-h-[110px] border-b border-r border-border p-1.5 transition-colors",
        !inMonth && "bg-muted/20",
        isOver && "bg-primary/5",
        commemoratives.length > 0 && inMonth && "bg-amber-500/5",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => hasMore && setDayOpen(true)}
          className={cn(
            "text-xs font-medium",
            !inMonth && "text-muted-foreground/50",
            isToday && "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
            hasMore && "cursor-pointer hover:underline",
          )}
        >
          {format(date, "d")}
        </button>
        <div className="flex items-center gap-0.5">
          {commemoratives.length > 0 && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-sm leading-none">
                    {commemoratives[0].emoji ?? "🎉"}
                    {commemoratives.length > 1 && (
                      <span className="ml-0.5 text-[9px] font-medium text-amber-600">+{commemoratives.length - 1}</span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-0.5">
                    {commemoratives.map((c) => (
                      <div key={c.id} className="text-xs">
                        {c.emoji} <span className="font-medium">{c.name}</span>
                        {c.category && <span className="ml-1 text-muted-foreground">· {c.category}</span>}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <button onClick={onAdd} className="opacity-0 transition-opacity group-hover:opacity-100">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {posts.slice(0, 3).map((p) => (
          <CalendarEvent key={p.id} post={p} clientMap={clientMap} onOpen={onOpen} />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setDayOpen(true)}
            className="w-full rounded px-1 text-left text-[10px] font-medium text-primary hover:bg-primary/10"
          >
            +{posts.length - 3} mais
          </button>
        )}
      </div>

      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })} · {posts.length} publicaç{posts.length === 1 ? "ão" : "ões"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {posts.map((p) => {
              const meta = statusMeta(p.status);
              const client = p.client_id ? clientMap.get(p.client_id) : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setDayOpen(false); onOpen(p); }}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60"
                >
                  <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      {p.scheduled_time && (
                        <span className="shrink-0 text-xs text-muted-foreground">{p.scheduled_time.slice(0, 5)}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {client && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{client}</span>}
                      <span className={cn("rounded border px-1.5 py-0.5", meta.tone)}>{meta.label}</span>
                      {p.format && <span className="rounded bg-muted px-1.5 py-0.5">{p.format}</span>}
                      {postNetworks(p).map((n) => (
                        <span key={n} className="rounded bg-muted px-1.5 py-0.5">{n}</span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarEvent({ post, clientMap, onOpen }: { post: Post; clientMap: Map<string, string>; onOpen: (p: Post) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  const meta = statusMeta(post.status);
  const isRejected = post.status === ("rejected" as typeof post.status);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(post)}
      className={cn(
        "cursor-pointer truncate rounded border-l-2 px-1.5 py-0.5 text-[10px] hover:brightness-105",
        meta.tone,
        isDragging && "opacity-30",
        isRejected && "opacity-50 grayscale",
      )}
    >
      <div className="flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
        {post.scheduled_time && <span className="opacity-70">{post.scheduled_time.slice(0, 5)}</span>}
        <span className={cn("truncate font-medium", isRejected && "line-through")}>{post.title}</span>
      </div>
      <div className="flex items-center gap-1 truncate opacity-80">
        {post.format && <span className="rounded bg-background/60 px-1 text-[9px] font-medium">{post.format}</span>}
        {post.client_id && clientMap.get(post.client_id) && (
          <span className="truncate">{clientMap.get(post.client_id)}</span>
        )}
      </div>
    </div>
  );
}
