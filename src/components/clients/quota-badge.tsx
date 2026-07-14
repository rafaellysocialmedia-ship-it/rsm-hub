import { cn } from "@/lib/utils";
import { quotaTone } from "@/lib/post-quota";

type Props = {
  used: number;
  quota: number | null | undefined;
  className?: string;
  compact?: boolean;
};

export function QuotaBadge({ used, quota, className, compact }: Props) {
  if (!quota || quota <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        Sem cota mensal
      </span>
    );
  }
  const tone = quotaTone(used, quota);
  const pct = Math.min(100, Math.round((used / quota) * 100));
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-medium", tone.text)}>
          {used}/{quota} posts
        </span>
        {!compact && <span className="text-muted-foreground">{tone.label}</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tone.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
