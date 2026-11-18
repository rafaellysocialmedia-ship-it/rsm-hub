/**
 * Avisos financeiros calculados a partir das cobranças. Funciona tanto com as
 * cobranças completas (equipe) quanto com o resumo enviado ao portal do cliente.
 */
export type ChargeLike = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  paid_date?: string | null;
  amount_received?: number | null;
  service_label?: string | null;
  description?: string | null;
  client_id?: string;
};

/** Situação exibida, com mais detalhe que o status salvo no banco. */
export type ChargeState = "paid" | "overdue" | "due_today" | "due_soon" | "open" | "cancelled";

export const DUE_SOON_DAYS = 7;

export function todayLocalISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function chargeState(charge: ChargeLike, today = todayLocalISO()): ChargeState {
  if (charge.status === "paid") return "paid";
  if (charge.status === "cancelled") return "cancelled";
  const days = daysBetween(today, charge.due_date);
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= DUE_SOON_DAYS) return "due_soon";
  return "open";
}

/** Texto curto de prazo: "venceu há 13 dias", "vence hoje", "vence em 3 dias". */
export function dueText(charge: ChargeLike, today = todayLocalISO()): string {
  const days = daysBetween(today, charge.due_date);
  if (charge.status === "paid" || charge.status === "cancelled") return "";
  if (days < 0) return `venceu há ${-days} dia${days === -1 ? "" : "s"}`;
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  return `vence em ${days} dias`;
}

export function isRenegotiated(charge: ChargeLike): boolean {
  return /renegociad/i.test(charge.description ?? "");
}

const sum = (list: ChargeLike[]) => list.reduce((s, c) => s + Number(c.amount ?? 0), 0);

export function financeSummary(charges: ChargeLike[], today = todayLocalISO()) {
  const open = charges.filter((c) => c.status !== "paid" && c.status !== "cancelled");
  const overdue = open
    .filter((c) => chargeState(c, today) === "overdue")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueToday = open.filter((c) => chargeState(c, today) === "due_today");
  const dueSoon = open
    .filter((c) => chargeState(c, today) === "due_soon")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = open
    .filter((c) => c.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paid = charges
    .filter((c) => c.status === "paid")
    .sort((a, b) => (b.paid_date ?? b.due_date).localeCompare(a.paid_date ?? a.due_date));
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const received = (list: ChargeLike[]) =>
    list.reduce((s, c) => s + Number(c.amount_received ?? c.amount ?? 0), 0);
  return {
    open,
    overdue,
    overdueTotal: sum(overdue),
    oldestOverdueDays: overdue[0] ? -daysBetween(today, overdue[0].due_date) : 0,
    dueToday,
    dueSoon,
    dueSoonTotal: sum([...dueToday, ...dueSoon]),
    next: upcoming[0] ?? null,
    paid,
    lastPaid: paid[0] ?? null,
    paidThisMonth: received(paid.filter((c) => (c.paid_date ?? "").startsWith(month))),
    paidThisYear: received(paid.filter((c) => (c.paid_date ?? "").startsWith(year))),
  };
}

/** Pedidos do cliente identificados pelo assunto (o tipo do pedido é "suporte"). */
export const RENEGOTIATION_PREFIX = "[Renegociação]";
export const SERVICE_CLOSE_PREFIX = "[Encerrar serviço]";

export function requestKind(title: string): "renegotiation" | "service_close" | null {
  if (title.startsWith(RENEGOTIATION_PREFIX)) return "renegotiation";
  if (title.startsWith(SERVICE_CLOSE_PREFIX)) return "service_close";
  return null;
}
