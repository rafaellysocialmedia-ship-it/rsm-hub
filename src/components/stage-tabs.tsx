import { cn } from "@/lib/utils";

export type Stage = { id: string; label: string; count: number; dot?: string };

/**
 * Abas de etapas para quadros no celular: uma etapa por vez, com a contagem de cada uma.
 * As abas rolam dentro da própria faixa, sem rolagem horizontal na página.
 */
export function StageTabs({
  stages,
  value,
  onChange,
  label,
}: {
  stages: Stage[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none]"
    >
      {stages.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s.dot && <span className={cn("size-2 rounded-full", s.dot)} aria-hidden="true" />}
            {s.label}
            <span
              className={cn(
                "rounded-full px-1.5 tabular-nums",
                active ? "bg-white/20" : "bg-muted text-foreground",
              )}
            >
              {s.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
