import type { Database } from "@/integrations/supabase/types";

export type ClientService = Database["public"]["Tables"]["client_services"]["Row"];
export type ClientTeamMember = Database["public"]["Tables"]["client_team_members"]["Row"];
export type ClientAccount = Database["public"]["Tables"]["client_accounts"]["Row"];
export type ClientIntegration = Database["public"]["Tables"]["client_integrations"]["Row"];
export type ClientTimelineEvent = Database["public"]["Tables"]["client_timeline"]["Row"];
export type ClientInternalMessage =
  Database["public"]["Tables"]["client_internal_messages"]["Row"];

/** Serviços que a agência pode contratar por cliente. */
export const SERVICE_CATALOG: { key: string; label: string }[] = [
  { key: "social_media", label: "Social Media" },
  { key: "paid_traffic", label: "Tráfego Pago" },
  { key: "landing_page", label: "Landing Page" },
  { key: "filming", label: "Filmagem" },
  { key: "branding", label: "Branding" },
  { key: "academy", label: "Academy" },
  { key: "other", label: "Outros serviços" },
];

export const SERVICE_SITUATIONS: { value: string; label: string; tone: string }[] = [
  { value: "active", label: "Ativo", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "onboarding", label: "Em implantação", tone: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  { value: "paused", label: "Pausado", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "cancelled", label: "Cancelado", tone: "bg-destructive/10 text-destructive border-destructive/20" },
];

export function situationMeta(value: string) {
  return SERVICE_SITUATIONS.find((s) => s.value === value) ?? SERVICE_SITUATIONS[0];
}

/** Funções internas que podem ser vinculadas a um cliente. */
export const TEAM_ROLE_LABELS = [
  "Atendimento",
  "Social Media",
  "Designer",
  "Editor de Vídeo",
  "Gestor de Tráfego",
  "Copywriter",
  "Gerência",
  "Financeiro",
  "Comercial",
];

/** Categorias e plataformas de acessos/contas (armazenamos apenas dados, sem senhas). */
export const ACCOUNT_CATALOG: { category: string; platforms: string[] }[] = [
  {
    category: "Redes Sociais",
    platforms: ["Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "Pinterest", "Threads", "X"],
  },
  {
    category: "Google",
    platforms: [
      "Google Business Profile",
      "Google Ads",
      "Google Analytics 4",
      "Google Tag Manager",
      "Google Search Console",
      "Google Drive",
    ],
  },
  {
    category: "Meta",
    platforms: ["Meta Business", "Conta de Anúncios", "Pixel", "Catálogo", "WhatsApp Business"],
  },
  { category: "Domínio", platforms: ["Domínio", "Hospedagem", "Servidor", "Cloudflare"] },
  { category: "Outros", platforms: ["Canva", "CapCut", "Email Marketing", "Ferramentas utilizadas"] },
];

export const INTEGRATION_PROVIDERS: { key: string; label: string; description: string }[] = [
  { key: "meta", label: "Meta", description: "Insights de páginas e contas de anúncios" },
  { key: "google", label: "Google", description: "Ads, Analytics 4 e Search Console" },
  { key: "asaas", label: "Asaas", description: "Cobranças e conciliação financeira" },
  { key: "whatsapp", label: "WhatsApp", description: "Mensagens e atendimento" },
  { key: "openai", label: "OpenAI", description: "Geração assistida de conteúdo" },
  { key: "other", label: "Outras integrações", description: "Conexões adicionais da operação" },
];

/** Setores usados no controle de visualização (configuração vem depois). */
export const SECTORS = [
  "administrator",
  "gerencia",
  "financeiro",
  "comercial",
  "social_media",
  "trafego",
];

export const SECTOR_LABELS: Record<string, string> = {
  administrator: "Administrador",
  gerencia: "Gerência",
  financeiro: "Financeiro",
  comercial: "Comercial",
  social_media: "Social Media",
  trafego: "Tráfego",
};

export const COMPANY_SIZES = ["MEI", "Microempresa", "Pequeno porte", "Médio porte", "Grande porte"];

export const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const TIMELINE_LABELS: Record<string, string> = {
  client_created: "Cliente criado",
  status_changed: "Status alterado",
  owner_changed: "Responsável alterado",
  service_updated: "Serviço",
  team_updated: "Equipe",
  document_uploaded: "Documento",
  team_update: "Atualização da equipe",
};

export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
