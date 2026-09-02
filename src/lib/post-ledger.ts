/**
 * Monthly post balance ("saldo mensal de posts").
 *
 * Uses the SAME usage rule already applied across the app (see post-quota.ts):
 * a post consumes quota when it has a scheduled_date inside the reference month
 * and its status is not `archived` / `rejected`. No new counting concept is
 * introduced, so no content is counted twice.
 */

export type PostLedgerRow = {
  id: string;
  client_id: string;
  year: number;
  month: number;
  contracted: number;
  used: number;
  previous_balance: number;
  balance: number;
  closed_at: string | null;
  notes: string | null;
};

export type UsagePost = {
  client_id: string | null;
  status: string | null;
  scheduled_date: string | null;
};

export function ymOf(ref: Date = new Date()): { year: number; month: number } {
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
}

export function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function labelMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/** Counts posts that consume the monthly quota for a client + month. */
export function usedInMonth(
  posts: UsagePost[],
  clientId: string,
  year: number,
  month: number,
): number {
  return posts.filter((p) => {
    if (p.client_id !== clientId) return false;
    if (!p.scheduled_date) return false;
    const s = p.status ?? "";
    if (s === "archived" || s === "rejected") return false;
    const d = new Date(p.scheduled_date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  }).length;
}

/** Earliest month (index) with a scheduled post for the client. */
function firstPostMonth(posts: UsagePost[], clientId: string): number | null {
  let min: number | null = null;
  for (const p of posts) {
    if (p.client_id !== clientId || !p.scheduled_date) continue;
    const d = new Date(p.scheduled_date + "T00:00:00");
    const idx = monthIndex(d.getFullYear(), d.getMonth() + 1);
    if (min === null || idx < min) min = idx;
  }
  return min;
}

/**
 * Balance carried into (year, month).
 *
 * Starts from the most recent CLOSED month and, for every month after it that
 * was never closed by the monthly routine, accumulates `contracted - used`
 * from the live posts. Without this, months that were never closed silently
 * dropped their leftover posts.
 */
export function previousBalanceOf(
  rows: PostLedgerRow[],
  clientId: string,
  year: number,
  month: number,
  opts?: { posts?: UsagePost[]; contracted?: number; since?: string | null },
): number {
  const target = monthIndex(year, month);
  const prior = rows
    .filter((r) => r.client_id === clientId && monthIndex(r.year, r.month) < target)
    .sort((a, b) => monthIndex(b.year, b.month) - monthIndex(a.year, a.month));

  let balance = prior[0]?.balance ?? 0;
  const posts = opts?.posts;
  const contracted = opts?.contracted ?? 0;
  if (!posts || contracted <= 0) return balance;

  // First month that still needs to be accounted for from live data.
  let from: number | null = prior[0] ? monthIndex(prior[0].year, prior[0].month) + 1 : null;
  if (from === null && opts?.since) {
    const d = new Date(opts.since + "T00:00:00");
    if (!Number.isNaN(d.getTime())) from = monthIndex(d.getFullYear(), d.getMonth() + 1);
  }
  if (from === null) from = firstPostMonth(posts, clientId);
  if (from === null || from >= target) return balance;

  // Guard against absurd ranges (max 24 months back).
  from = Math.max(from, target - 24);

  for (let idx = from; idx < target; idx++) {
    const y = Math.floor((idx - 1) / 12);
    const m = idx - y * 12;
    const closed = rows.find((r) => r.client_id === clientId && r.year === y && r.month === m && r.closed_at);
    if (closed) continue; // already reflected in the closed balance chain
    balance += contracted - usedInMonth(posts, clientId, y, m);
  }
  return balance;
}


export type MonthSummary = {
  year: number;
  month: number;
  contracted: number;
  previous: number;
  /** contracted + previous (may be lower than contracted when there is a debt) */
  available: number;
  used: number;
  /** available - used: positive = saldo, negative = débito */
  balance: number;
  closed: boolean;
};

export function summarizeMonth(args: {
  year: number;
  month: number;
  contracted: number;
  previous: number;
  used: number;
  closed?: boolean;
}): MonthSummary {
  const available = args.contracted + args.previous;
  return {
    year: args.year,
    month: args.month,
    contracted: args.contracted,
    previous: args.previous,
    available,
    used: args.used,
    balance: available - args.used,
    closed: args.closed ?? false,
  };
}

/** Builds the summary of an open (not yet closed) month from live posts. */
export function openMonthSummary(args: {
  clientId: string;
  contracted: number;
  ledger: PostLedgerRow[];
  posts: UsagePost[];
  ref?: Date;
}): MonthSummary {
  const { year, month } = ymOf(args.ref ?? new Date());
  const closedRow = args.ledger.find(
    (r) => r.client_id === args.clientId && r.year === year && r.month === month && r.closed_at,
  );
  if (closedRow) {
    return summarizeMonth({
      year,
      month,
      contracted: closedRow.contracted,
      previous: closedRow.previous_balance,
      used: closedRow.used,
      closed: true,
    });
  }
  return summarizeMonth({
    year,
    month,
    contracted: args.contracted,
    previous: previousBalanceOf(args.ledger, args.clientId, year, month),
    used: usedInMonth(args.posts, args.clientId, year, month),
  });
}

export function balanceLabel(balance: number): string {
  if (balance > 0) return `+${balance}`;
  return String(balance);
}

export function balanceTone(balance: number): string {
  if (balance < 0) return "text-rose-600 dark:text-rose-400";
  if (balance === 0) return "text-muted-foreground";
  return "text-emerald-600 dark:text-emerald-400";
}
