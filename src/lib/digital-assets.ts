import type { Database } from "@/integrations/supabase/types";

export type DigitalAsset = Database["public"]["Tables"]["client_digital_assets"]["Row"];

export const ASSET_STATUS: { value: string; label: string; tone: string }[] = [
  { value: "active", label: "Ativo", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "configuring", label: "Em configuração", tone: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  { value: "expired", label: "Expirado", tone: "bg-destructive/10 text-destructive border-destructive/20" },
  { value: "suspended", label: "Suspenso", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "inactive", label: "Inativo", tone: "bg-muted text-muted-foreground border-border" },
];

export function assetStatusMeta(value: string | null | undefined) {
  return ASSET_STATUS.find((s) => s.value === value) ?? ASSET_STATUS[0];
}

export const ASSET_LABELS: Record<string, string> = {
  domain: "Domínio",
  hosting: "Hospedagem",
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  gtm: "Google Tag Manager",
  search_console: "Search Console",
  google_business: "Google Business Profile",
  meta_business: "Meta Business",
  meta_ads: "Conta de Anúncios (Meta)",
  facebook_page: "Página do Facebook",
  instagram: "Instagram",
  meta_pixel: "Pixel",
  tool: "Ferramenta",
  link: "Link importante",
  other: "Outro ativo",
};

export function assetLabel(key: string) {
  return ASSET_LABELS[key] ?? key;
}

export const TOOL_CATEGORIES = [
  "Design",
  "Vídeo",
  "Marketing",
  "CRM",
  "E-mail",
  "Automação",
  "Hospedagem",
  "Outros",
];

export const LINK_CATEGORIES = [
  "Drive",
  "Canva",
  "Site",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Briefing",
  "Manual da marca",
  "Outros",
];

export const DOMAIN_TYPES = ["Principal", "Redirecionamento", "Subdomínio", "E-mail"];

/** Campos exibidos por seção (evita formulário genérico confuso). */
export type AssetField =
  | "provider"
  | "identifier"
  | "url"
  | "username"
  | "category"
  | "owner"
  | "expires_at";

export type AssetSectionConfig = {
  key: string;
  title: string;
  description: string;
  types: string[];
  fields: AssetField[];
  labels?: Partial<Record<AssetField, string>>;
  categories?: string[];
};

export const ASSET_SECTIONS: AssetSectionConfig[] = [
  {
    key: "domains",
    title: "Domínios",
    description: "Domínios do cliente, provedores e datas de vencimento.",
    types: ["domain"],
    fields: ["category", "provider", "url", "expires_at", "owner"],
    labels: { category: "Tipo", provider: "Provedor", expires_at: "Vencimento", url: "URL" },
    categories: DOMAIN_TYPES,
  },
  {
    key: "hosting",
    title: "Hospedagem",
    description: "Provedor, servidor e painel. Nunca registre senhas aqui.",
    types: ["hosting"],
    fields: ["provider", "identifier", "url", "owner"],
    labels: { provider: "Provedor", identifier: "Servidor / Painel", url: "URL de acesso" },
  },
  {
    key: "google",
    title: "Google",
    description: "Google Ads, Analytics, Tag Manager, Search Console e Business Profile.",
    types: ["google_ads", "ga4", "gtm", "search_console", "google_business"],
    fields: ["identifier", "url", "owner"],
    labels: { identifier: "ID / Propriedade" },
  },
  {
    key: "meta",
    title: "Meta",
    description: "Business Manager, contas de anúncios, páginas, Instagram e pixels.",
    types: ["meta_business", "meta_ads", "facebook_page", "instagram", "meta_pixel"],
    fields: ["identifier", "url", "owner"],
    labels: { identifier: "ID / Usuário" },
  },
  {
    key: "tools",
    title: "Ferramentas",
    description: "Ferramentas utilizadas pelo cliente (sem senhas).",
    types: ["tool"],
    fields: ["category", "url", "username", "owner"],
    labels: { category: "Categoria", username: "Usuário / e-mail de acesso" },
    categories: TOOL_CATEGORIES,
  },
  {
    key: "links",
    title: "Links importantes",
    description: "Atalhos usados no dia a dia da conta.",
    types: ["link"],
    fields: ["category", "url"],
    labels: { category: "Categoria" },
    categories: LINK_CATEGORIES,
  },
];

/** Meses completos que o serviço está ativo (mínimo 0). */
export function monthsActive(startDate: string | null | undefined, ref = new Date()): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  let months =
    (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
  if (ref.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function monthsActiveLabel(months: number | null): string {
  if (months == null) return "Sem data de início";
  if (months === 0) return "1º mês";
  return `${months + 1}º mês · ${months} ${months === 1 ? "mês" : "meses"} completos`;
}

export type DeliveryState = {
  used: number;
  quota: number;
  remaining: number;
  label: string;
  tone: string;
};

/** Entrega do mês para serviços medidos por quantidade de posts. */
export function deliveryState(used: number, quota: number): DeliveryState {
  const remaining = Math.max(0, quota - used);
  if (quota <= 0) {
    return {
      used,
      quota,
      remaining: 0,
      label: "Sem meta definida",
      tone: "bg-muted text-muted-foreground border-border",
    };
  }
  if (used >= quota) {
    return {
      used,
      quota,
      remaining: 0,
      label: `Entregue ${used}/${quota}`,
      tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    };
  }
  return {
    used,
    quota,
    remaining,
    label: `Faltam ${remaining} de ${quota}`,
    tone:
      used / quota >= 0.6
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-destructive/10 text-destructive border-destructive/20",
  };
}
