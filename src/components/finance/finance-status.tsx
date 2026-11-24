import {
  AlarmClock,
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Handshake,
  type LucideIcon,
} from "lucide-react";

import {
  chargeState,
  dueText,
  isRenegotiated,
  type ChargeLike,
  type ChargeState,
} from "@/lib/finance-alerts";
import { cn } from "@/lib/utils";

export const STATE_META: Record<
  ChargeState,
  { label: string; icon: LucideIcon; badge: string; row: string }
> = {
  paid: {
    label: "Pago",
    icon: CheckCircle2,
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    row: "",
  },
  overdue: {
    label: "Vencido",
    icon: AlertTriangle,
    badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    row: "bg-red-500/[0.04]",
  },
  due_today: {
    label: "Vence hoje",
    icon: AlarmClock,
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    row: "bg-orange-500/[0.04]",
  },
  due_soon: {
    label: "Vence em breve",
    icon: CalendarClock,
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    row: "",
  },
  open: {
    label: "Em aberto",
    icon: Clock3,
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    row: "",
  },
  cancelled: {
    label: "Cancelado",
    icon: Ban,
    badge: "border-border bg-muted text-muted-foreground",
    row: "opacity-70",
  },
};

/** Selo de situação com cor, símbolo e prazo ("venceu há 13 dias"). */
export function ChargeStatusBadge({
  charge,
  showDue = true,
  className,
}: {
  charge: ChargeLike;
  showDue?: boolean;
  className?: string;
}) {
  const state = chargeState(charge);
  const meta = STATE_META[state];
  const Icon = meta.icon;
  const due = showDue ? dueText(charge) : "";
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
          meta.badge,
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {meta.label}
      </span>
      {due && state !== "open" && (
        <span className="pl-1 text-[11px] text-muted-foreground">{due}</span>
      )}
      {isRenegotiated(charge) && (
        <span className="inline-flex items-center gap-1 pl-1 text-[11px] text-brand-accent">
          <Handshake className="size-3" aria-hidden /> Acordo de renegociação
        </span>
      )}
    </span>
  );
}

export function chargeRowClass(charge: ChargeLike) {
  return STATE_META[chargeState(charge)].row;
}
