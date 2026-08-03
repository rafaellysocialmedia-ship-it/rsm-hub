import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-brand">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        <Badge variant="outline" className="mt-5 border-dashed text-xs font-normal text-muted-foreground">
          Em desenvolvimento
        </Badge>
      </div>
    </div>
  );
}
