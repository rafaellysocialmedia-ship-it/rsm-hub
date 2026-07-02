import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { cn } from "@/lib/utils";

export function TimelineView({
  posts, clientMap, onOpen,
}: { posts: Post[]; clientMap: Map<string, string>; onOpen: (p: Post) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    const dated = posts.filter((p) => p.scheduled_date);
    dated
      .sort((a, b) => (a.scheduled_date! + (a.scheduled_time ?? "")).localeCompare(b.scheduled_date! + (b.scheduled_time ?? "")))
      .forEach((p) => {
        const arr = map.get(p.scheduled_date!) ?? [];
        arr.push(p);
        map.set(p.scheduled_date!, arr);
      });
    return Array.from(map.entries());
  }, [posts]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Nenhuma publicação agendada
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([date, items]) => (
        <div key={date} className="relative pl-6">
          <div className="absolute left-0 top-0 flex h-full flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <div className="mt-1 h-full w-px bg-border" />
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="space-y-2">
            {items.map((p) => {
              const meta = statusMeta(p.status);
              return (
                <div
                  key={p.id}
                  onClick={() => onOpen(p)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-soft transition-all hover:border-primary/40"
                >
                  {p.scheduled_time && (
                    <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      {p.scheduled_time.slice(0, 5)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.client_id ? clientMap.get(p.client_id) : null, p.social_network, p.format].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", meta.tone)}>{meta.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
