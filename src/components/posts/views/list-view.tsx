import { CalendarX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { PostNetworkBadges } from "@/components/posts/post-network-badges";
import { cn } from "@/lib/utils";

export function ListView({
  posts, clientMap, onOpen, selected, onToggleSelect,
}: {
  posts: Post[];
  clientMap: Map<string, string>;
  onOpen: (p: Post) => void;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  if (posts.length === 0) {
    return <Empty />;
  }
  const selectable = !!onToggleSelect;
  // Agrupa por dia: a data fica em destaque e os posts do dia logo abaixo.
  const groups = new Map<string, Post[]>();
  [...posts]
    .sort(
      (a, b) =>
        (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999") ||
        (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99"),
    )
    .forEach((p) => {
      const k = p.scheduled_date ?? "";
      groups.set(k, [...(groups.get(k) ?? []), p]);
    });
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([day, items]) => {
        const date = day ? new Date(day + "T00:00:00") : null;
        return (
          <section key={day || "sem-data"} aria-label={date ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Sem data"}>
            <h3 className="sticky top-[5.75rem] z-10 flex items-baseline gap-2 bg-background/95 px-1 py-1.5 backdrop-blur">
              {date ? (
                <>
                  <span className="text-xl font-semibold tabular-nums text-brand">{format(date, "dd")}</span>
                  <span className="inline-block text-sm font-medium first-letter:uppercase">{format(date, "EEEE", { locale: ptBR })}</span>
                  <span className="text-xs text-muted-foreground">{format(date, "MMMM", { locale: ptBR })}</span>
                </>
              ) : (
                <span className="text-sm font-medium">Sem data</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "post" : "posts"}
              </span>
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
              {items.map((p) => {
                const meta = statusMeta(p.status);
                const isSelected = selected?.has(p.id) ?? false;
                return (
                  <li
                    key={p.id}
                    onClick={() => onOpen(p)}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    {selectable && (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect?.(p.id)}
                          aria-label="Selecionar publicação"
                        />
                      </div>
                    )}
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium sm:truncate">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.scheduled_time?.slice(0, 5), p.client_id ? clientMap.get(p.client_id) : null, p.format]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      <PostNetworkBadges networks={postNetworks(p)} className="mt-1" />
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.tone)}>
                      {meta.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Empty() {
  return (
    <EmptyState
      icon={CalendarX}
      title="Nenhuma publicação neste período"
      description="Troque o mês ou os filtros, ou crie uma publicação nova."
    />
  );
}
