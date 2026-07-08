import { Link, useRouterState } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AiThread = {
  id: string;
  title: string;
  updated_at: string;
};

type Props = {
  threads: AiThread[];
  activeId: string | null;
  loading?: boolean;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export function ThreadList({ threads, activeId, loading, onNew, onDelete }: Props) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <Button className="w-full" size="sm" onClick={onNew}>
          <MessageSquarePlus className="mr-2 h-4 w-4" /> Nova conversa
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <p className="p-3 text-xs text-muted-foreground">Carregando...</p>}
        {!loading && threads.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
        )}
        <ul className="space-y-1">
          {threads.map((t) => {
            const active = t.id === activeId;
            return (
              <li key={t.id} className="group relative">
                <Link
                  to="/ai/$threadId"
                  params={{ threadId: t.id }}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-3 py-2 pr-9 text-sm transition",
                    active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="truncate font-medium text-foreground">{t.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(t.updated_at), { locale: ptBR, addSuffix: true })}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm("Excluir esta conversa?")) onDelete(t.id);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Excluir conversa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
