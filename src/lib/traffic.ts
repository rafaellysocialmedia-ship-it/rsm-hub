import type { Database } from "@/integrations/supabase/types";

export type TrafficCampaign = Database["public"]["Tables"]["traffic_campaigns"]["Row"];
export type TrafficMetric = Database["public"]["Tables"]["traffic_metrics"]["Row"];
export type TrafficLead = Database["public"]["Tables"]["traffic_leads"]["Row"];
export type LandingPage = Database["public"]["Tables"]["landing_pages"]["Row"];
export type DigitalAsset = Database["public"]["Tables"]["client_digital_assets"]["Row"];

export type TrafficPlatform = Database["public"]["Enums"]["traffic_platform"];
export type TrafficObjective = Database["public"]["Enums"]["traffic_objective"];
export type TrafficCampaignStatus = Database["public"]["Enums"]["traffic_campaign_status"];
export type TrafficLeadStage = Database["public"]["Enums"]["traffic_lead_stage"];
export type LandingPageStatus = Database["public"]["Enums"]["landing_page_status"];

export const PLATFORMS: { value: TrafficPlatform; label: string }[] = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "linkedin_ads", label: "LinkedIn Ads" },
  { value: "other", label: "Outra plataforma" },
];

export const OBJECTIVES: { value: TrafficObjective; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "conversions", label: "Conversões" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messages", label: "Mensagens" },
  { value: "traffic", label: "Tráfego" },
  { value: "awareness", label: "Reconhecimento" },
  { value: "sales", label: "Vendas" },
];

export const CAMPAIGN_STATUS: { value: TrafficCampaignStatus; label: string; tone: string }[] = [
  { value: "active", label: "Ativa", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "paused", label: "Pausada", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "setup", label: "Em configuração", tone: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  { value: "ended", label: "Encerrada", tone: "bg-muted text-muted-foreground border-border" },
];

export const LEAD_STAGES: { value: TrafficLeadStage; label: string; tone: string }[] = [
  { value: "new", label: "Novo Lead", tone: "bg-sky-500/10 text-sky-500" },
  { value: "first_contact", label: "Primeiro Contato", tone: "bg-indigo-500/10 text-indigo-500" },
  { value: "in_service", label: "Em Atendimento", tone: "bg-violet-500/10 text-violet-500" },
  { value: "proposal", label: "Proposta", tone: "bg-amber-500/10 text-amber-500" },
  { value: "client", label: "Cliente", tone: "bg-emerald-500/10 text-emerald-500" },
  { value: "lost", label: "Perdido", tone: "bg-destructive/10 text-destructive" },
];

export const LP_STATUS: { value: LandingPageStatus; label: string; tone: string }[] = [
  { value: "planning", label: "Em planejamento", tone: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  { value: "development", label: "Em desenvolvimento", tone: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  { value: "review", label: "Revisão", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "published", label: "Publicada", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "paused", label: "Pausada", tone: "bg-muted text-muted-foreground border-border" },
  { value: "ended", label: "Encerrada", tone: "bg-destructive/10 text-destructive border-destructive/20" },
];

export const LP_BUILDERS = ["Lovable", "WordPress", "HTML", "Wix", "Webflow", "Outra"];

/** Catálogo de ativos digitais do cliente (aba "Ativos Digitais"). */
export const DIGITAL_ASSET_TYPES: { key: string; label: string }[] = [
  { key: "landing_page", label: "Landing Page" },
  { key: "domain", label: "Domínio" },
  { key: "hosting", label: "Hospedagem" },
  { key: "ga4", label: "Google Analytics 4" },
  { key: "gtm", label: "Google Tag Manager" },
  { key: "meta_pixel", label: "Meta Pixel" },
  { key: "google_ads", label: "Google Ads" },
  { key: "meta_ads", label: "Meta Ads" },
  { key: "google_business", label: "Google Business Profile" },
  { key: "search_console", label: "Search Console" },
  { key: "api", label: "APIs e integrações" },
  { key: "other", label: "Outro ativo" },
];

export function assetTypeLabel(key: string) {
  return DIGITAL_ASSET_TYPES.find((a) => a.key === key)?.label ?? key;
}

export function platformLabel(value: TrafficPlatform | null | undefined) {
  return PLATFORMS.find((p) => p.value === value)?.label ?? "—";
}

export function objectiveLabel(value: TrafficObjective | null | undefined) {
  return OBJECTIVES.find((p) => p.value === value)?.label ?? "—";
}

export function campaignStatusMeta(value: TrafficCampaignStatus) {
  return CAMPAIGN_STATUS.find((s) => s.value === value) ?? CAMPAIGN_STATUS[0];
}

export function lpStatusMeta(value: LandingPageStatus) {
  return LP_STATUS.find((s) => s.value === value) ?? LP_STATUS[0];
}

export type MetricTotals = {
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads: number;
  conversions: number;
  revenue: number;
  cpc: number;
  cpm: number;
  ctr: number;
  cpa: number;
  roas: number;
};

export function sumMetrics(rows: Pick<TrafficMetric, "spend" | "clicks" | "impressions" | "reach" | "leads" | "conversions" | "revenue">[]): MetricTotals {
  const t = rows.reduce<{
    spend: number;
    clicks: number;
    impressions: number;
    reach: number;
    leads: number;
    conversions: number;
    revenue: number;
  }>(

    (acc, r) => ({
      spend: acc.spend + Number(r.spend ?? 0),
      clicks: acc.clicks + (r.clicks ?? 0),
      impressions: acc.impressions + (r.impressions ?? 0),
      reach: acc.reach + (r.reach ?? 0),
      leads: acc.leads + (r.leads ?? 0),
      conversions: acc.conversions + (r.conversions ?? 0),
      revenue: acc.revenue + Number(r.revenue ?? 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, reach: 0, leads: 0, conversions: 0, revenue: 0 },
  );
  const div = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    ...t,
    cpc: div(t.spend, t.clicks),
    cpm: div(t.spend, t.impressions) * 1000,
    ctr: div(t.clicks, t.impressions) * 100,
    cpa: div(t.spend, t.conversions || t.leads),
    roas: div(t.revenue, t.spend),
  };
}

export function money(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function pct(value: number | null | undefined) {
  return `${(value ?? 0).toFixed(2)}%`;
}
