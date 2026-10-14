/**
 * Resumo mensal previsto: serviços ativos são a fonte principal para clientes
 * cadastrados na Central. Contratos mensais são fallback para cadastros antigos.
 * Nunca mistura os dois grupos, evitando contar o mesmo serviço duas vezes.
 * Cobranças já geradas não participam do cálculo.
 */
export type MonthlyService = {
  situation: string;
  amount: number | null;
  auto_billing?: boolean;
  billing_day?: number | null;
};
export type MonthlyContract = {
  status: string;
  periodicity: string;
  amount: number;
};

export function monthlyServiceSummary(
  services: readonly MonthlyService[] = [],
  contracts: readonly MonthlyContract[] = [],
) {
  const active = services.filter(
    (s) => s.situation === "active" && s.amount !== null &&
      Number.isFinite(Number(s.amount)) && Number(s.amount) > 0,
  );
  const missingBillingDay = active.some((s) => s.auto_billing && !s.billing_day);
  if (active.length) {
    return {
      hasMonthly: true,
      amount: active.reduce((sum, s) => sum + Number(s.amount), 0),
      missingBillingDay,
    };
  }
  const monthlyContracts = contracts.filter(
    (c) => c.status === "active" && c.periodicity === "monthly",
  );
  return {
    hasMonthly: monthlyContracts.length > 0,
    amount: monthlyContracts.reduce((sum, c) => sum + Number(c.amount), 0),
    missingBillingDay,
  };
}
