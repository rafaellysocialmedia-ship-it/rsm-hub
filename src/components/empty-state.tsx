import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyAction = {
  label: string;
  onClick?: () => void;
  /** Link interno: renderize um <Link> e passe via `asChild`. */
  render?: ReactNode;
  variant?: "default" | "outline";
};

/**
 * Estado vazio padrão do RSM Hub: ícone discreto, título curto,
 * uma frase dizendo o que aparece ali e (se fizer sentido) a ação principal.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actions = [],
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyAction[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-xl bg-muted text-muted-foreground",
          compact ? "size-9" : "size-11",
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) =>
            a.render ? (
              <Button key={a.label} size="sm" variant={a.variant ?? (i === 0 ? "default" : "outline")} asChild>
                {a.render}
              </Button>
            ) : (
              <Button
                key={a.label}
                size="sm"
                variant={a.variant ?? (i === 0 ? "default" : "outline")}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
