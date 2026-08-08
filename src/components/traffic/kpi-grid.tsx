import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Kpi = { label: string; value: string; hint?: string };

export function KpiGrid({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-5", className)}>
      {items.map((k) => (
        <Card key={k.label} className="p-4 shadow-soft">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{k.value}</p>
          {k.hint && <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>}
        </Card>
      ))}
    </div>
  );
}
