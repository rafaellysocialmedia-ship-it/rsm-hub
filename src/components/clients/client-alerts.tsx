import { AlertCircle, AlertTriangle, ArrowUpRight, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AlertLevel, ClientAlert } from "@/lib/client-alerts";
import { cn } from "@/lib/utils";

const CHIP: Record<AlertLevel, string> = {
  urgent: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  info: "border-border bg-muted/60 text-muted-foreground",
};
const ROW: Record<AlertLevel, string> = {
  urgent: "border-rose-500/20 bg-rose-500/[0.04]",
  warning: "border-amber-500/25 bg-amber-500/[0.05]",
  info: "border-primary/15 bg-primary/[0.035]",
};
const ICON = { urgent: AlertTriangle, warning: AlertCircle, info: Bell } as const;

/** Compact alert chips for client cards and list rows. */
export function ClientAlertChips({
  alerts,
  max = 3,
  className,
}: {
  alerts: ClientAlert[];
  max?: number;
  className?: string;
}) {
  if (!alerts.length) return null;
  const hidden = alerts.slice(max);
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Alertas do cliente">
      {alerts.slice(0, max).map((alert) => {
        const Icon = ICON[alert.level];
        return (
          <li
            key={alert.key}
            title={alert.detail}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              CHIP[alert.level],
            )}
          >
            <Icon className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{alert.label}</span>
          </li>
        );
      })}
      {hidden.length > 0 && (
        <li
          title={hidden.map((alert) => alert.label).join(" · ")}
          className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          +{hidden.length}
        </li>
      )}
    </ul>
  );
}

/** Full alert list with an action that opens the tab where it is resolved. */
export function ClientAlertList({
  alerts,
  onTab,
}: {
  alerts: ClientAlert[];
  onTab: (tab: string) => void;
}) {
  return (
    <ul className="grid gap-2.5 md:grid-cols-2">
      {alerts.map((alert) => {
        const Icon = ICON[alert.level];
        return (
          <li
            key={alert.key}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-xl border p-3",
              ROW[alert.level],
            )}
          >
            <div className="rounded-lg bg-background/80 p-2 text-foreground" aria-hidden>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{alert.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{alert.detail}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 bg-background text-xs"
              onClick={() => onTab(alert.tab)}
            >
              {alert.action}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
