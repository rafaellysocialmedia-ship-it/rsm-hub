export type RetentionAccount = {
  finance_available: boolean;
  overdue_payments: number;
  revisions: number;
  cancelled_meetings: number;
  days_without_meeting: number;
  complaints: number;
  awaiting_response: number;
  late_materials: number;
  no_scheduled: boolean;
  no_production: boolean;
  approvals_pending: number;
  onboarding_pending: number;
  engagement_drop: boolean;
  client_id: string;
  name: string;
  logo_url: string | null;
  account_manager_id: string | null;
  risk_level: "normal" | "attention" | "high";
  risk_reason: string;
  checkin_days: number;
  automation_enabled: boolean;
  today: string;
  tracking_start: string;
  last_contact: string | null;
  days_without_contact: number;
  late_posts: number;
  stale_approvals: number;
  late_tasks: number;
  post_count: number;
  task_count: number;
  renewal_at: string | null;
  score: number | null;
  health: "unknown" | "critical" | "attention" | "healthy";
  signals: string[];
};
export type RetentionAction = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  due_date: string;
  assignee_id: string | null;
  status: "open" | "done" | "cancelled";
  outcome: string;
  auto_key: string | null;
  created_at: string;
  closed_at: string | null;
};
export type RetentionSettings = {
  client_id: string;
  risk_level: "normal" | "attention" | "high";
  risk_reason: string;
  checkin_days: number;
  automation_enabled: boolean;
  updated_at: string;
};
export type ContactLog = {
  id: string;
  client_id: string;
  contact_date: string;
  channel: string;
  summary: string;
  created_by: string | null;
  created_at: string;
};
export const HEALTH = {
  critical: {
    label: "Em risco",
    tone: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  attention: {
    label: "Atenção",
    tone: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  healthy: {
    label: "Saudável",
    tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  unknown: { label: "Sem base suficiente", tone: "border-border bg-muted text-muted-foreground" },
};
export const SIGNALS: Record<string, string> = {
  late_posts: "Entregas atrasadas",
  stale_approvals: "Aprovações sem atualização há 7 dias",
  late_tasks: "Demandas atrasadas",
  no_contact: "Contato de acompanhamento pendente",
  manual_risk: "Risco sinalizado pela equipe",
  renewal: "Contrato a renovar",
  overdue_payment: "Mensalidade em atraso",
  many_revisions: "Três ou mais pedidos de alteração nos últimos 30 dias",
  cancelled_meetings: "Reunião cancelada nos últimos 30 dias",
  no_meeting: "Reunião de acompanhamento pendente",
  complaint: "Reclamação aberta",
  late_materials: "Envio de materiais em atraso",
  engagement_drop: "Queda superior a 30% no engajamento dos relatórios mensais",
};
export const CHANNELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  meeting: "Reunião",
  email: "E-mail",
  phone: "Telefone",
  other: "Outro",
};
export const retentionToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function dateLabel(value?: string | null) {
  return value ? value.slice(0, 10).split("-").reverse().join("/") : "Sem registro";
}
