import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { cn } from "@/lib/utils";

export function ListView({
  posts, clientMap, onOpen,
}: { posts: Post[]; clientMap: Map<string, string>; onOpen: (p: Post) => void }) {
  if (posts.length === 0) {
    return <Empty />;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
      {posts.map((p) => {
        const meta = statusMeta(p.status);
        return (
          <li
            key={p.id}
            onClick={() => onOpen(p)}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[p.client_id ? clientMap.get(p.client_id) : null, p.social_network, p.format].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            {p.scheduled_date && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {format(new Date(p.scheduled_date + "T00:00:00"), "dd MMM", { locale: ptBR })}
                {p.scheduled_time ? ` · ${p.scheduled_time.slice(0, 5)}` : ""}
              </span>
            )}
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.tone)}>{meta.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
      Nenhuma publicação encontrada
    </div>
  );
}
