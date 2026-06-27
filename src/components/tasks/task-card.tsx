import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, MessageSquare, Paperclip, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PRIORITY_META, type Task, formatDue, isOverdue } from "@/lib/tasks";
import type { Client } from "@/lib/clients";
import { cn } from "@/lib/utils";

type Props = {
  task: Task;
  client?: Client | null;
  commentCount?: number;
  fileCount?: number;
  onClick: () => void;
};

export function TaskCard({ task, client, commentCount = 0, fileCount = 0, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  const pr = PRIORITY_META[task.priority];
  const overdue = isOverdue(task);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "group cursor-grab space-y-2.5 border border-border/60 bg-card p-3 shadow-sm transition hover:border-border hover:shadow-md active:cursor-grabbing",
        overdue && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", pr.dot)} />
      </div>
      {client && (
        <div className="text-[11px] font-medium text-muted-foreground">{client.name}</div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge variant="outline" className={cn("border-0", pr.tone)}>
          {pr.label}
        </Badge>
        {task.due_date && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-muted-foreground",
              overdue && "bg-destructive/10 text-destructive",
            )}
          >
            {overdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {formatDue(task.due_date)}
          </span>
        )}
        {commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {commentCount}
          </span>
        )}
        {fileCount > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {fileCount}
          </span>
        )}
      </div>
    </Card>
  );
}
