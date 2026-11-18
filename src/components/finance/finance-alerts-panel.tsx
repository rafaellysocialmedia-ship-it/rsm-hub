import { useMemo } from "react";
import { Link } from "@tanstack/react-router";

import { useCharges, useFinanceClients } from "@/hooks/use-finance";
import { useFinanceRequests } from "@/hooks/use-finance-requests";
import { financeSummary } from "@/lib/finance-alerts";
import { dateBR, money } from "@/lib/finance-core";
import { ALERT_ICONS, FinanceAlert, FinanceStat } from "./finance-alerts";

/**
 * Avisos financeiros de todas as contas: vencidas por cliente, o que vence nos
 * próximos dias e pedidos de renegociação ou encerramento feitos pelo portal.
 */
export function FinanceAlertsPanel({
  onFilterOverdue,
  overdueActive,
}: {
  /** Quando informado, o indicador de vencidas vira um filtro da lista. */
  onFilterOverdue?: () => void;
  overdueActive?: boolean;
}) {
  const { data: charges = [], isLoading } = useCharges();
  const { data: clients = [] } = useFinanceClients();
  const requests = useFinanceRequests();
  const summary = useMemo(() => financeSummary(charges), [charges]);
  const name = (id?: string) => clients.find((c) => c.id === id)?.name ?? "Cliente";

  const overdueByClient = useMemo(() => {
    const map = new Map<string, { total: number; count: number; oldest: string }>();
    for (const c of summary.overdue) {
      const current = map.get(c.client_id!) ?? { total: 0, count: 0, oldest: c.due_date };
      current.total += Number(c.amount);
      current.count += 1;
      if (c.due_date < current.oldest) current.oldest = c.due_date;
      map.set(c.client_id!, current);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [summary.overdue]);

  if (isLoading) return null;
  const renegotiations = (requests.data ?? []).filter((r) => r.kind === "renegotiation");
  const closes = (requests.data ?? []).filter((r) => r.kind === "service_close");
  const soon = [...summary.dueToday, ...summary.dueSoon];

  const clientLink = (clientId: string, label: string) => (
    <Link
      key={clientId + label}
      to="/management/clients/$clientId"
      params={{ clientId }}
      search={{ tab: "finance" }}
      className="font-medium text-foreground underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  );

  return (
    <section aria-label="Avisos financeiros" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceStat
          tone={summary.overdue.length ? "danger" : "neutral"}
          icon={ALERT_ICONS.overdue}
          label="Vencidas"
          value={money(summary.overdueTotal)}
          hint={`${summary.overdue.length} cobrança${summary.overdue.length === 1 ? "" : "s"} · ${overdueByClient.length} cliente${overdueByClient.length === 1 ? "" : "s"}`}
          onClick={onFilterOverdue}
          active={overdueActive}
        />
        <FinanceStat
          tone={soon.length ? "warning" : "neutral"}
          icon={ALERT_ICONS.dueSoon}
          label="Vencem em 7 dias"
          value={money(summary.dueSoonTotal)}
          hint={`${soon.length} cobrança${soon.length === 1 ? "" : "s"}${summary.dueToday.length ? ` · ${summary.dueToday.length} hoje` : ""}`}
        />
        <FinanceStat
          tone={renegotiations.length || closes.length ? "info" : "neutral"}
          icon={ALERT_ICONS.renegotiation}
          label="Pedidos dos clientes"
          value={String(renegotiations.length + closes.length)}
          hint={`${renegotiations.length} renegociação · ${closes.length} encerramento`}
        />
        <FinanceStat
          tone="success"
          icon={ALERT_ICONS.received}
          label="Recebido no mês"
          value={money(summary.paidThisMonth)}
          hint={`${money(summary.paidThisYear)} no ano`}
        />
      </div>

      {overdueByClient.length > 0 && (
        <FinanceAlert
          tone="danger"
          icon={ALERT_ICONS.overdue}
          title={`${overdueByClient.length} cliente${overdueByClient.length === 1 ? "" : "s"} com mensalidade vencida`}
        >
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {overdueByClient.map(([clientId, info]) => (
              <li key={clientId}>
                {clientLink(clientId, name(clientId))} · {money(info.total)} ·{" "}
                {info.count > 1 ? `${info.count} cobranças, ` : ""}desde {dateBR(info.oldest)}
              </li>
            ))}
          </ul>
        </FinanceAlert>
      )}
      {/* Cada nome abre a aba Cobranças do cliente, onde o pedido aparece com as ações. */}
      {renegotiations.length + closes.length > 0 && (
        <FinanceAlert
          tone="info"
          icon={ALERT_ICONS.renegotiation}
          title="Pedidos feitos pelos clientes no portal"
        >
          <ul className="mt-1 space-y-0.5">
            {[...renegotiations, ...closes].map((r) => (
              <li key={r.id}>
                {clientLink(r.client_id, name(r.client_id))} ·{" "}
                {r.kind === "renegotiation" ? "pediu renegociação" : r.title.replace("[Encerrar serviço] ", "pediu para encerrar: ")}{" "}
                em {dateBR(r.created_at.slice(0, 10))}
              </li>
            ))}
          </ul>
        </FinanceAlert>
      )}
    </section>
  );
}
