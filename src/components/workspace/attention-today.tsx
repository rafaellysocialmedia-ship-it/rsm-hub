import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useRetention } from "@/hooks/use-retention";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryState } from "./account-panels";
export function AttentionToday() {
  const q = useRetention();
  const [all, setAll] = useState(false);
  const alerts = (q.data ?? [])
    .flatMap((a) =>
      [
        ...(a.health === "critical"
          ? [
              {
                text: "Conta em risco de churn",
                tab: "retention",
                cta: "Acompanhar conta",
                priority: 0,
              },
            ]
          : []),
        ...(a.overdue_payments > 0
          ? [
              {
                text: `${a.overdue_payments} mensalidade(s) em atraso`,
                tab: "finance",
                cta: "Ver financeiro",
                priority: 0,
              },
            ]
          : []),
        ...(a.awaiting_response > 0
          ? [
              {
                text: `${a.awaiting_response} solicitação(ões) aguardam resposta`,
                tab: "support",
                cta: "Responder",
                priority: 0,
              },
            ]
          : []),
        ...(a.late_posts > 0
          ? [
              {
                text: `${a.late_posts} conteúdo(s) atrasado(s)`,
                tab: "contents",
                cta: "Ver conteúdos",
                priority: 1,
              },
            ]
          : []),
        ...(a.late_tasks > 0
          ? [
              {
                text: `${a.late_tasks} demanda(s) atrasada(s)`,
                tab: "demands",
                cta: "Ver demandas",
                priority: 1,
              },
            ]
          : []),
        ...(a.approvals_pending > 0
          ? [
              {
                text: `${a.approvals_pending} conteúdo(s) aguardam aprovação`,
                tab: "approvals",
                cta: "Ver aprovações",
                priority: 1,
              },
            ]
          : []),
        ...(a.signals.includes("renewal")
          ? [
              {
                text: "Contrato vencido ou vencendo em até 30 dias",
                tab: "contract",
                cta: "Ver contrato",
                priority: 1,
              },
            ]
          : []),
        ...(a.onboarding_pending > 0
          ? [
              {
                text: `Onboarding com ${a.onboarding_pending} etapa(s) pendente(s)`,
                tab: "onboarding",
                cta: "Ver onboarding",
                priority: 2,
              },
            ]
          : []),
        ...(a.days_without_meeting >= a.checkin_days
          ? [
              {
                text: `${a.days_without_meeting} dias sem reunião registrada`,
                tab: "meetings",
                cta: "Agendar reunião",
                priority: 2,
              },
            ]
          : []),
        ...(a.no_scheduled
          ? [
              {
                text: "Sem publicação aprovada ou programada nos próximos 30 dias",
                tab: "calendar",
                cta: "Planejar calendário",
                priority: 2,
              },
            ]
          : []),
        ...(a.no_production
          ? [
              {
                text: "Sem conteúdo em produção",
                tab: "contents",
                cta: "Criar conteúdo",
                priority: 2,
              },
            ]
          : []),
      ].map((x) => ({ ...x, id: a.client_id, name: a.name })),
    )
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">O que precisa da minha atenção hoje</CardTitle>
        <p className="text-sm text-muted-foreground">
          {alerts.length} pendência(s) nas contas ativas.
        </p>
      </CardHeader>
      <CardContent>
        <QueryState loading={q.isLoading} error={q.error}>
          {!alerts.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência identificada nos dados disponíveis.
            </p>
          ) : (
            <div className="divide-y">
              {(all ? alerts : alerts.slice(0, 8)).map((a) => (
                <div
                  key={a.id + a.tab + a.text}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.text}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/management/clients/$clientId"
                      params={{ clientId: a.id }}
                      search={{ tab: a.tab }}
                    >
                      {a.cta}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
          {alerts.length > 8 && (
            <Button variant="ghost" onClick={() => setAll(!all)}>
              {all ? "Mostrar menos" : "Ver todas as pendências"}
            </Button>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
