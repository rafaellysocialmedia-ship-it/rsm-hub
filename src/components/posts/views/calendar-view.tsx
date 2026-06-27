import { useMemo, useState } from "react";
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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { statusMeta, type Post } from "@/lib/posts";
import { cn } from "@/lib/utils";

type Props = {
  posts: Post[];
  clientMap: Map<string, string>;
  onOpen: (p: Post) => void;
  onAddOn: (dateISO: string) => void;
  onMove: (id: string, dateISO: string) => void;
};

export function CalendarView({ posts, clientMap, onOpen, onAddOn, onMove }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
            return (
              <DayCell
                key={iso}
                date={d}
                iso={iso}
                inMonth={isSameMonth(d, cursor)}
                isToday={isSameDay(d, new Date())}
                posts={list}
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
  date, iso, inMonth, isToday, posts, clientMap, onOpen, onAdd,
}: {
  date: Date; iso: string; inMonth: boolean; isToday: boolean;
  posts: Post[]; clientMap: Map<string, string>;
  onOpen: (p: Post) => void; onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative min-h-[110px] border-b border-r border-border p-1.5 transition-colors",
        !inMonth && "bg-muted/20",
        isOver && "bg-primary/5",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={cn(
          "text-xs font-medium",
          !inMonth && "text-muted-foreground/50",
          isToday && "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
        )}>
          {format(date, "d")}
        </span>
        <button onClick={onAdd} className="opacity-0 transition-opacity group-hover:opacity-100">
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-1">
        {posts.slice(0, 3).map((p) => (
          <CalendarEvent key={p.id} post={p} clientMap={clientMap} onOpen={onOpen} />
        ))}
        {posts.length > 3 && (
          <p className="px-1 text-[10px] text-muted-foreground">+{posts.length - 3} mais</p>
        )}
      </div>
    </div>
  );
}

function CalendarEvent({ post, clientMap, onOpen }: { post: Post; clientMap: Map<string, string>; onOpen: (p: Post) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  const meta = statusMeta(post.status);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(post)}
      className={cn(
        "cursor-pointer truncate rounded border-l-2 bg-muted/60 px-1.5 py-0.5 text-[10px] hover:bg-muted",
        isDragging && "opacity-30",
      )}
      style={{ borderLeftColor: `var(--${meta.value})` }}
    >
      <div className="flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
        {post.scheduled_time && <span className="text-muted-foreground">{post.scheduled_time.slice(0, 5)}</span>}
        <span className="truncate font-medium">{post.title}</span>
      </div>
      {post.client_id && clientMap.get(post.client_id) && (
        <div className="truncate text-muted-foreground">{clientMap.get(post.client_id)}</div>
      )}
    </div>
  );
}
