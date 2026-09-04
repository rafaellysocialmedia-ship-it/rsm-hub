/**
 * Saúde operacional da campanha: sinaliza campanhas sem saldo, fora de
 * vigência, pausadas ou paradas (sem lançamento de métrica recente).
 * Puramente derivado dos dados já carregados — não altera regras de negócio.
 */
import type { TrafficCampaign } from "@/lib/traffic";

export type CampaignHealth = {
  key: "no_budget" | "budget_low" | "expired" | "paused" | "ended" | "stalled" | "ok";
  label: string;
  tone: string;
  /** true quando exige atenção da equipe (aparece no bloco de alertas) */
  alert: boolean;
  detail?: string;
};

const TONE = {
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  warn: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  muted: "bg-muted text-muted-foreground border-border",
  ok: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};

/** Dias desde o último lançamento de métrica (null quando nunca houve). */
export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export function campaignHealth(
  campaign: Pick<TrafficCampaign, "status" | "total_budget" | "daily_budget" | "end_date">,
  spend: number,
  lastMetricAt?: string | null,
): CampaignHealth {
  const budget = Number(campaign.total_budget ?? 0);
  const today = new Date().toISOString().slice(0, 10);

  if (budget > 0 && spend >= budget) {
    return {
      key: "no_budget",
      label: "Sem saldo",
      tone: TONE.danger,
      alert: true,
      detail: "Investimento atingiu o orçamento total da campanha.",
    };
  }

  if (campaign.status === "active" && campaign.end_date && campaign.end_date < today) {
    return {
      key: "expired",
      label: "Vigência encerrada",
      tone: TONE.danger,
      alert: true,
      detail: "A data final da campanha já passou, mas ela segue marcada como ativa.",
    };
  }

  if (campaign.status === "paused") {
    return {
      key: "paused",
      label: "Pausada",
      tone: TONE.warn,
      alert: true,
      detail: "Campanha pausada — nenhuma veiculação em andamento.",
    };
  }

  if (campaign.status === "ended") {
    return { key: "ended", label: "Encerrada", tone: TONE.muted, alert: false };
  }

  if (budget > 0 && spend >= budget * 0.85) {
    return {
      key: "budget_low",
      label: "Saldo baixo",
      tone: TONE.warn,
      alert: true,
      detail: `Já foram investidos ${Math.round((spend / budget) * 100)}% do orçamento total.`,
    };
  }

  if (campaign.status === "active") {
    const idle = daysSince(lastMetricAt);
    if (idle === null) {
      return {
        key: "stalled",
        label: "Sem métricas",
        tone: TONE.warn,
        alert: true,
        detail: "Campanha ativa sem nenhum lançamento de métrica.",
      };
    }
    if (idle >= 3) {
      return {
        key: "stalled",
        label: "Sem atualização",
        tone: TONE.warn,
        alert: true,
        detail: `Última métrica há ${idle} dias — verifique se a campanha está veiculando.`,
      };
    }
  }

  return { key: "ok", label: "Em veiculação", tone: TONE.ok, alert: false };
}

