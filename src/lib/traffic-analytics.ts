import { money, num, pct, type MetricTotals } from "@/lib/traffic";

export type PeriodKey =
  | "today"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "90d"
  | "custom";

export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Intervalo (YYYY-MM-DD) do período selecionado. */
export function periodRange(
  period: PeriodKey,
  custom?: { from: string; to: string },
): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  const shift = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return iso(d);
  };
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: shift(6), to: today };
    case "30d":
      return { from: shift(29), to: today };
    case "90d":
      return { from: shift(89), to: today };
    case "this_month":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(first), to: iso(last) };
    }
    case "custom":
      return {
        from: custom?.from || shift(29),
        to: custom?.to || today,
      };
  }
}

/** Formatação tolerante: sem dados suficientes → "N/A". */
export const NA = "N/A";

export function moneyOr(value: number, enough: boolean) {
  return enough ? money(value) : NA;
}
export function pctOr(value: number, enough: boolean) {
  return enough ? pct(value) : NA;
}
export function numOr(value: number, enough = true) {
  return enough ? num(value) : NA;
}

/** KPIs formatados a partir dos totais, respeitando divisões por zero. */
export function kpiItems(t: MetricTotals, opts?: { simplified?: boolean }) {
  const base = [
    { label: "Investimento", value: money(t.spend) },
    { label: "Impressões", value: num(t.impressions) },
    { label: "Alcance", value: num(t.reach) },
    { label: "Cliques", value: num(t.clicks) },
    { label: "CTR", value: pctOr(t.ctr, t.impressions > 0) },
    { label: "CPC", value: moneyOr(t.cpc, t.clicks > 0) },
    { label: "CPM", value: moneyOr(t.cpm, t.impressions > 0) },
    { label: "Leads", value: num(t.leads) },
    { label: "Conversões", value: num(t.conversions) },
    { label: "CPA", value: moneyOr(t.cpa, (t.conversions || t.leads) > 0) },
    { label: "Receita", value: t.revenue > 0 ? money(t.revenue) : NA },
    { label: "ROAS", value: t.revenue > 0 && t.spend > 0 ? `${t.roas.toFixed(2)}x` : NA },
  ];
  if (!opts?.simplified) return base;
  const keep = ["Investimento", "Leads", "Conversões", "CPC", "CPM", "CTR", "CPA", "ROAS"];
  return base.filter((k) => keep.includes(k.label));
}

export function roasLabel(revenue: number, spend: number, roas: number) {
  return revenue > 0 && spend > 0 ? `${roas.toFixed(2)}x` : NA;
}

export function dayLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
