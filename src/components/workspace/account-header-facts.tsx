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
  const fact = ([label, value]: string[]) => (
    <div key={label} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium" title={q.isLoading ? undefined : value}>
        {q.isLoading ? "…" : value}
      </dd>
    </div>
  );
  // O essencial fica sempre visível; o restante do cadastro abre sob demanda.
  const primary: string[][] = [
    ...(finance.canView
      ? [
          [
            "Mensalidade",
            services.isLoading ? "…" : monthly.hasMonthly ? money(monthly.amount) : "Não cadastrada",
          ],
          ["Próxima cobrança", q.data?.due ? dateLabel(q.data.due) : "Sem cobrança pendente"],
        ]
      : []),
    ["Responsável", owner || "Não atribuído"],
    ["Próxima ação", next ? `${next.title} · ${dateLabel(next.due_date)}` : "Nenhuma ação aberta"],
  ];
  const secondary: string[][] = [
    ["Empresa", client.trade_name || client.name],
    ["Instagram", q.data?.instagram || "Não informado"],
    ["Cliente desde", dateLabel(client.start_date || client.created_at)],
    ["Último contato", a?.last_contact ? dateLabel(a.last_contact) : "Sem registro"],
    ...(finance.canView
      ? [
          ...(monthly.missingBillingDay ? [["Vencimento", "Não configurado nos serviços"]] : []),
          ["Término do contrato", end ? dateLabel(end) : "Não informado"],
        ]
      : []),
  ];
  return (
    <div className="space-y-2">
      <section aria-label="Resumo da conta" className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm">
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            {primary.map(fact)}
          </dl>
          {a && <HealthBadge account={a} />}
        </div>
        <details className="rsm-account-details border-t">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50">
            <span className="flex-1">Mais detalhes da conta</span>
            <svg
              className="size-4 shrink-0 transition-transform"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <dl className="grid gap-x-6 gap-y-3 border-t p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {secondary.map(fact)}
          </dl>
        </details>
        {finance.canView && monthly.missingBillingDay && (
          <div className="border-t px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={onConfigureBilling}>
              Configurar vencimento dos serviços
            </Button>
          </div>
        )}
      </section>
      {(q.error || services.error || retention.error || actions.error || team.error) && (
        <p role="alert" className="text-sm text-destructive">
          Parte do resumo não pôde ser carregada. Consulte a aba correspondente.
        </p>
      )}
    </div>
  );
}
