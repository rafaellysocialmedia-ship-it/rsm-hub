import type { ReactNode } from "react";
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  Handshake,
  LogOut,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "danger" | "warning" | "info" | "success" | "neutral";

const TONE: Record<Tone, { box: string; icon: string }> = {
  danger: {
    box: "border-red-500/30 bg-red-500/[0.06]",
    icon: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  warning: {
    box: "border-amber-500/35 bg-amber-500/[0.07]",
    icon: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  info: {
    box: "border-brand-accent/30 bg-brand-accent/[0.06]",
    icon: "bg-brand-accent/15 text-brand-accent",
  },
  success: {
    box: "border-emerald-500/30 bg-emerald-500/[0.06]",
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  neutral: { box: "border-border bg-card", icon: "bg-muted text-muted-foreground" },
};

export const ALERT_ICONS = {
  overdue: AlertTriangle,
  dueSoon: AlarmClock,
  renegotiation: Handshake,
  serviceClose: LogOut,
  ok: CheckCircle2,
  received: TrendingUp,
} satisfies Record<string, LucideIcon>;

/** Um aviso financeiro: ícone, título, explicação e ações. */
export function FinanceAlert({
  tone,
  icon: Icon,
  title,
  children,
  actions,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-3 rounded-xl border p-3.5", t.box)}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.icon)}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Indicador numérico colorido com símbolo. */
export function FinanceStat({
  tone,
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  active,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const t = TONE[tone];
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn("flex size-6 items-center justify-center rounded-md", t.icon)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
      </span>
      <span className="mt-2 block text-xl font-semibold tabular-nums tracking-tight">{value}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
    </>
  );
  const className = cn(
    "rounded-xl border p-3.5 text-left shadow-sm",
    tone === "neutral" ? "bg-card" : t.box,
    active && "ring-2 ring-primary",
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(className, "transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
