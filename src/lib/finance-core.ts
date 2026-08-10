import type { Database } from "@/integrations/supabase/types";

export type FinancePaymentMethod =
  Database["public"]["Tables"]["finance_payment_methods"]["Row"];
export type FinanceContract = Database["public"]["Tables"]["finance_contracts"]["Row"];
export type FinanceCharge = Database["public"]["Tables"]["finance_charges"]["Row"];
export type FinanceHistoryEvent = Database["public"]["Tables"]["finance_history"]["Row"];

export type ChargeStatus = Database["public"]["Enums"]["finance_status"];
export type Periodicity = Database["public"]["Enums"]["finance_periodicity"];
export type ContractStatus = Database["public"]["Enums"]["finance_contract_status"];

export const PERIODICITY_OPTIONS: { value: Periodicity; label: string; months: number }[] = [
  { value: "once", label: "Único", months: 0 },
  { value: "monthly", label: "Mensal", months: 1 },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "semiannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 },
];

export function periodicityLabel(value: Periodicity) {
  return PERIODICITY_OPTIONS.find((p) => p.value === value)?.label ?? value;
}

export function periodicityMonths(value: Periodicity) {
  return PERIODICITY_OPTIONS.find((p) => p.value === value)?.months ?? 0;
}

export const CONTRACT_STATUS_META: Record<
  ContractStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Ativo",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  pending: {
    label: "Pendente",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  ended: {
    label: "Encerrado",
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export const CHARGE_STATUS_META: Record<ChargeStatus, { label: string; className: string }> = {
  pending: {
    label: "Pendente",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  paid: {
    label: "Pago",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  overdue: {
    label: "Vencido",
    className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export const FINANCE_HISTORY_LABELS: Record<string, string> = {
  charge_created: "Cobrança criada",
  charge_updated: "Cobrança editada",
  charge_cancelled: "Cobrança cancelada",
  payment_registered: "Pagamento registrado",
  amount_changed: "Alteração de valor",
  contract_created: "Contrato criado",
  contract_status_changed: "Status do contrato",
  contract_amount_changed: "Valor do contrato",
};

export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const dateBR = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export const dateTimeBR = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Considera vencido quando pendente e a data de vencimento já passou. */
export function effectiveStatus(charge: Pick<FinanceCharge, "status" | "due_date">): ChargeStatus {
  if (charge.status === "pending" && charge.due_date < todayISO()) return "overdue";
  return charge.status;
}

/** Próxima data de vencimento a partir de um contrato (para gerar cobrança). */
export function nextDueDate(contract: Pick<FinanceContract, "periodicity" | "due_day">, from = new Date()) {
  const months = periodicityMonths(contract.periodicity);
  const day = contract.due_day ?? from.getDate();
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  if (months === 0) {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.toISOString().slice(0, 10);
  }
  if (day <= from.getDate()) d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
