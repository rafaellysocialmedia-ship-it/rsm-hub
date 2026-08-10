import { useFinanceHistory } from "@/hooks/use-finance";
import { FINANCE_HISTORY_LABELS, dateTimeBR, money } from "@/lib/finance-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function FinanceHistoryTimeline({ clientId }: { clientId?: string }) {
  const { data: events = [], isLoading } = useFinanceHistory(clientId);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Histórico financeiro</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum evento financeiro registrado.
          </div>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {FINANCE_HISTORY_LABELS[e.event_type] ?? e.event_type}
                  </Badge>
                  <span className="text-sm font-medium">{e.title}</span>
                  {e.amount != null && (
                    <span className="text-sm text-muted-foreground">{money(e.amount)}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dateTimeBR(e.created_at)}
                  {e.detail ? ` · ${e.detail}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
