import type { FinanceTransaction } from "@/lib/finance";

/**
 * Regras do Painel financeiro. Tudo parte dos lançamentos (finance_transactions),
 * que já incluem as cobranças dos clientes espelhadas automaticamente. Assim
 * existe uma única base e os números do painel não se contradizem.
 *
 * - Mês de um lançamento: pelo vencimento (ou emissão, quando não há vencimento).
 * - Recebido / pago: pela data do pagamento.
 */
export type MonthKey = string; // "YYYY-MM"

export const monthOf = (iso: string | null | undefined): MonthKey => (iso ?? "").slice(0, 7);

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: MonthKey, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: style,
    ...(style === "long" ? { year: "numeric" } : {}),
  });
  return style === "short" ? label.replace(".", "") : label;
}

/** Data que define o mês do lançamento. */
export const refDate = (t: Pick<FinanceTransaction, "due_date" | "issue_date">) =>
  t.due_date ?? t.issue_date;

export type EffectiveStatus = "paid" | "overdue" | "open" | "cancelled";

export function effectiveTxStatus(t: FinanceTransaction, today: string): EffectiveStatus {
  if (t.status === "paid") return "paid";
  if (t.status === "cancelled") return "cancelled";
  return refDate(t) < today ? "overdue" : "open";
}

/** Lançamento fixo (repete todo mês) ainda não criado no mês. */
export type Projection = {
  key: string;
  template: FinanceTransaction;
  month: MonthKey;
  issue_date: string;
  due_date: string | null;
};

const sameDay = (iso: string | null, month: MonthKey) => {
  if (!iso) return null;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(Number(iso.slice(8, 10)), 28, last);
  return `${month}-${String(day).padStart(2, "0")}`;
};

/**
 * Fixos ativos que ainda não têm lançamento no mês. Só projeta do mês atual em
 * diante e a partir do mês em que o fixo foi criado.
 */
export function projectionsFor(
  month: MonthKey,
  txs: FinanceTransaction[],
  currentMonth: MonthKey,
): Projection[] {
  if (month < currentMonth) return [];
  return txs
    .filter(
      (t) =>
        t.recurrence === "monthly" &&
        t.recurrence_active !== false &&
        !t.recurrence_parent_id &&
        t.status !== "cancelled" &&
        monthOf(refDate(t)) <= month,
    )
    .filter(
      (t) =>
        !txs.some(
          (x) => (x.id === t.id || x.recurrence_parent_id === t.id) && monthOf(refDate(x)) === month,
        ),
    )
    .map((t) => ({
      key: `${t.id}:${month}`,
      template: t,
      month,
      issue_date: sameDay(t.issue_date, month)!,
      due_date: sameDay(t.due_date, month),
    }));
}

const sum = (list: { amount: number }[]) => list.reduce((s, t) => s + Number(t.amount || 0), 0);

export type MonthSummary = ReturnType<typeof summarizeMonth>;

export function summarizeMonth(
  month: MonthKey,
  txs: FinanceTransaction[],
  today: string,
  projections: Projection[] = [],
) {
  const live = txs.filter((t) => t.status !== "cancelled");
  const inMonth = live.filter((t) => monthOf(refDate(t)) === month);
  const income = inMonth.filter((t) => t.type === "income");
  const expense = inMonth.filter((t) => t.type === "expense");
  const projIncome = projections.filter((p) => p.template.type === "income");
  const projExpense = projections.filter((p) => p.template.type === "expense");
  const projSum = (list: Projection[]) => list.reduce((s, p) => s + Number(p.template.amount), 0);

  const received = live.filter(
    (t) => t.type === "income" && t.status === "paid" && monthOf(t.paid_date ?? refDate(t)) === month,
  );
  const expensesPaid = live.filter(
    (t) => t.type === "expense" && t.status === "paid" && monthOf(t.paid_date ?? refDate(t)) === month,
  );
  const overdue = income.filter((t) => effectiveTxStatus(t, today) === "overdue");
  const toReceive = income.filter((t) => effectiveTxStatus(t, today) === "open");
  const overdueBefore = live.filter(
    (t) =>
      t.type === "income" &&
      effectiveTxStatus(t, today) === "overdue" &&
      monthOf(refDate(t)) < month,
  );
  const billedClients = new Set(income.map((t) => t.client_id).filter(Boolean));

  const billed = sum(income) + projSum(projIncome);
  const expenses = sum(expense) + projSum(projExpense);
  const receivedTotal = sum(received);
  const expensesPaidTotal = sum(expensesPaid);
  return {
    month,
    billed,
    received: receivedTotal,
    toReceive: sum(toReceive) + projSum(projIncome),
    overdue: sum(overdue),
    overdueCount: overdue.length,
    overdueBefore: sum(overdueBefore),
    expenses,
    expensesPaid: expensesPaidTotal,
    expensesOpen: expenses - sum(expense.filter((t) => t.status === "paid")),
    /** Caixa do mês: o que entrou menos o que saiu. */
    profit: receivedTotal - expensesPaidTotal,
    /** Resultado previsto se tudo for recebido e pago. */
    expectedProfit: billed - expenses,
    averageTicket: billedClients.size ? sum(income) / billedClients.size : 0,
    billedClients: billedClients.size,
  };
}

/** Variação percentual; null quando não há base de comparação. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function byClient(
  month: MonthKey,
  txs: FinanceTransaction[],
  names: Map<string, string>,
  top = 8,
) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "income" || t.status === "cancelled" || monthOf(refDate(t)) !== month) continue;
    const key = t.client_id ? (names.get(t.client_id) ?? "Cliente") : "Sem cliente";
    map.set(key, (map.get(key) ?? 0) + Number(t.amount));
  }
  return groupTop(map, top);
}

export function byCategory(
  month: MonthKey,
  txs: FinanceTransaction[],
  projections: Projection[],
  top = 8,
) {
  const map = new Map<string, number>();
  const add = (category: string | null, amount: number) => {
    const key = category?.trim() || "Sem categoria";
    map.set(key, (map.get(key) ?? 0) + amount);
  };
  for (const t of txs)
    if (t.type === "expense" && t.status !== "cancelled" && monthOf(refDate(t)) === month)
      add(t.category, Number(t.amount));
  for (const p of projections)
    if (p.template.type === "expense") add(p.template.category, Number(p.template.amount));
  return groupTop(map, top);
}

function groupTop(map: Map<string, number>, top: number) {
  const rows = [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
  if (rows.length <= top) return rows;
  const rest = rows.slice(top - 1).reduce((s, r) => s + r.value, 0);
  return [...rows.slice(0, top - 1), { name: "Outros", value: Math.round(rest * 100) / 100 }];
}

export const EXPENSE_CATEGORIES = [
  "Equipe e freelancers",
  "Ferramentas e softwares",
  "Anúncios",
  "Impostos",
  "Contabilidade",
  "Escritório e internet",
  "Equipamentos",
  "Cursos e capacitação",
  "Outros",
];

export const INCOME_CATEGORIES = ["Social Media", "Tráfego Pago", "Projeto avulso", "Consultoria", "Outros"];
