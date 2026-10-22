import { useQuery } from "@tanstack/react-query";
import { useRetention, useRetentionActions, useRetentionTeam } from "@/hooks/use-retention";
import { useClientServices, useFinanceAccess } from "@/hooks/use-finance";
import { monthlyServiceSummary } from "@/lib/monthly-service-summary";
import { supabase } from "@/integrations/supabase/client";
import { HealthBadge } from "@/components/retention/retention-workspace";
import { dateLabel } from "@/lib/retention";
import { money } from "@/lib/finance-core";
import { Button } from "@/components/ui/button";
import type { Client } from "@/lib/clients";
export function AccountHeaderFacts({
  client,
  onConfigureBilling,
}: {
  client: Client;
  onConfigureBilling: () => void;
}) {
  const retention = useRetention(),
    actions = useRetentionActions(client.id),
    team = useRetentionTeam(),
    finance = useFinanceAccess();
  const services = useClientServices(finance.canView ? client.id : null);
  const q = useQuery({
    queryKey: ["header-facts", client.id, finance.canView],
    queryFn: async () => {
      const [accounts, contracts, charges] = await Promise.all([
        supabase
          .from("client_accounts")
          .select("platform,identifier")
          .eq("client_id", client.id)
          .ilike("platform", "instagram"),
        finance.canView
          ? supabase
              .from("finance_contracts")
              .select("amount,start_date,end_date,periodicity")
              .eq("client_id", client.id)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
        finance.canView
          ? supabase
              .from("finance_charges")
              .select("due_date")
              .eq("client_id", client.id)
              .in("status", ["pending", "overdue"])
              .order("due_date")
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (accounts.error || contracts.error || charges.error)
        throw accounts.error || contracts.error || charges.error;
      return {
        instagram: accounts.data?.[0]?.identifier,
        contracts: contracts.data ?? [],
        due: charges.data?.[0]?.due_date,
      };
    },
  });
  const a = retention.data?.find((a) => a.client_id === client.id),
    next = actions.data?.find((a) => a.status === "open");
  const owner = team.data?.find((t) => t.id === a?.account_manager_id)?.name;
  const monthly = monthlyServiceSummary(
    services.data ?? [],
    q.data?.contracts.map((c) => ({ ...c, status: "active" })) ?? [],
  );
  const end = q.data?.contracts
    .map((c) => c.end_date)
    .filter((x): x is string => !!x)
    .sort()[0];
  return (
    <div className="mt-4 space-y-3">
      <details className="rsm-account-details rounded-xl border bg-card">
        <summary className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted/50">
          <span className="flex-1">Dados e acompanhamento da conta</span>
          {a && <HealthBadge account={a} />}
          <svg
            className="size-4 shrink-0 text-muted-foreground transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <dl className="grid gap-x-6 gap-y-4 border-t p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Empresa", client.trade_name || client.name],
            ["Instagram", q.data?.instagram || "Não informado"],
            ["Entrada", dateLabel(client.start_date || client.created_at)],
            ["Responsável", owner || "Não atribuído"],
            ...(finance.canView
              ? [
                  [
                    "Mensalidade",
                    services.isLoading
                      ? "…"
                      : monthly.hasMonthly
                        ? money(monthly.amount)
                        : "Não cadastrada",
                  ],
                  ...(monthly.missingBillingDay
                    ? [["Vencimento", "Não configurado nos serviços"]]
                    : []),
                  [
                    "Próxima cobrança",
                    q.data?.due ? dateLabel(q.data.due) : "Sem cobrança pendente",
                  ],
                  ["Término do contrato", end ? dateLabel(end) : "Não informado"],
                ]
              : []),
            ["Último contato", a?.last_contact ? dateLabel(a.last_contact) : "Sem registro"],
            [
              "Próxima ação",
              next ? `${next.title} · ${dateLabel(next.due_date)}` : "Nenhuma ação aberta",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-medium">{q.isLoading ? "…" : value}</dd>
            </div>
          ))}
        </dl>
      </details>
      {finance.canView && monthly.missingBillingDay && (
        <Button size="sm" variant="outline" onClick={onConfigureBilling}>
          Configurar vencimento dos serviços
        </Button>
      )}
      {(q.error || services.error || retention.error || actions.error || team.error) && (
        <p role="alert" className="text-sm text-destructive">
          Parte do resumo não pôde ser carregada. Consulte a aba correspondente.
        </p>
      )}
    </div>
  );
}
