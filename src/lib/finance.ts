export type FinanceType = "income" | "expense";
export type FinanceStatus = "pending" | "paid" | "overdue" | "cancelled";

export type FinanceTransaction = {
  id: string;
  client_id: string | null;
  type: FinanceType;
  category: string | null;
  description: string;
  amount: number;
  currency: string;
  status: FinanceStatus;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Preenchido quando o lançamento é espelhado automaticamente de uma
   * cobrança em Contas a Receber (finance_charges). Somente leitura aqui —
   * editar/excluir deve ser feito na tela de origem. */
  source_charge_id: string | null;
};

export const STATUS_META: Record<
  FinanceStatus,
  { label: string; className: string }
> = {
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

export const TYPE_META: Record<FinanceType, { label: string; className: string }> = {
  income: {
    label: "Receita",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  expense: {
    label: "Despesa",
    className: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  },
};

export const brl = (n: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n || 0);

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
