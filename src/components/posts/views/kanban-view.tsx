import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POST_STATUS, type Post, type PostStatus } from "@/lib/posts";
import { PostCard } from "../post-card";
import { cn } from "@/lib/utils";

type Props = {
  posts: Post[];
  clientMap: Map<string, string>;
  onOpen: (post: Post) => void;
  onStatusChange: (id: string, status: PostStatus) => void;
  onAdd: (status: PostStatus) => void;
};

export function KanbanView({ posts, clientMap, onOpen, onStatusChange, onAdd }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<PostStatus, Post[]>();
    POST_STATUS.forEach((s) => m.set(s.value, []));
    posts.forEach((p) => m.get(p.status)?.push(p));
    return m;
  }, [posts]);

  const active = posts.find((p) => p.id === activeId) ?? null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    const newStatus = over as PostStatus;
    const post = posts.find((p) => p.id === id);
    if (post && post.status !== newStatus) onStatusChange(id, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {POST_STATUS.map((s) => (
          <Column
            key={s.value}
            status={s.value}
            label={s.label}
            dot={s.dot}
            posts={grouped.get(s.value) ?? []}
            clientMap={clientMap}
            onOpen={onOpen}
            onAdd={() => onAdd(s.value)}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className="w-72">
            <PostCard post={active} clientName={active.client_id ? clientMap.get(active.client_id) : undefined} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status, label, dot, posts, clientMap, onOpen, onAdd,
}: {
  status: PostStatus; label: string; dot: string;
  posts: Post[]; clientMap: Map<string, string>;
  onOpen: (p: Post) => void; onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{posts.length}</Badge>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg border border-transparent p-2 transition-colors",
          isOver && "border-primary/40 bg-primary/5",
        )}
      >
        {posts.map((p) => (
          <Draggable key={p.id} id={p.id}>
            <PostCard
              post={p}
              clientName={p.client_id ? clientMap.get(p.client_id) : undefined}
              onClick={() => onOpen(p)}
            />
          </Draggable>
        ))}
        {posts.length === 0 && (
          <p className="rounded-md border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground">
            Solte aqui
          </p>
        )}
      </div>
    </div>
  );
}

function Draggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
}
