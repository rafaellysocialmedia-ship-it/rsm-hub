import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/tasks/task-card";
import { STATUS_COLUMNS, type Task, type TaskStatus } from "@/lib/tasks";
import type { Client } from "@/lib/clients";
import { cn } from "@/lib/utils";

type Props = {
  tasks: Task[];
  clients: Client[];
  onMove: (taskId: string, status: TaskStatus) => void;
  onAdd: (status: TaskStatus) => void;
  onOpen: (task: Task) => void;
};

function Column({ id, label, tone, children, count, onAdd }: { id: TaskStatus; label: string; tone: string; children: React.ReactNode; count: number; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-xl border border-border/60 bg-muted/30 p-3 transition",
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function KanbanBoard({ tasks, clients, onMove, onAdd, onOpen }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const [showDone, setShowDone] = useState(false);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const t = tasks.find((x) => x.id === active.id);
    if (t && t.status !== newStatus) onMove(t.id, newStatus);
  };

  const visibleColumns = STATUS_COLUMNS.filter((c) => c.id !== "done" || showDone);
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowDone((v) => !v)} className="gap-2">
          {showDone ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showDone ? "Ocultar concluídos" : `Ver concluídos${doneCount ? ` (${doneCount})` : ""}`}
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {visibleColumns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <Column key={col.id} id={col.id} label={col.label} tone={col.tone} count={colTasks.length} onAdd={() => onAdd(col.id)}>
              {colTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  client={t.client_id ? clientMap.get(t.client_id) : null}
                  onClick={() => onOpen(t)}
                />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
