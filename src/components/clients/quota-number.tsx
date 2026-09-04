import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number | string;
  tone?: string;
  className?: string;
};

/** Compact "big colored number + tiny label" used for post balance readouts. */
export function QuotaNumber({ label, value, tone, className }: Props) {
  return (
    <div className={cn("text-center leading-none", className)}>
      <p className={cn("text-xl font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

