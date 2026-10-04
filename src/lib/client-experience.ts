export type OnboardingStep = {
  client_id: string;
  step_key: string;
  status: "todo" | "progress" | "done" | "not_applicable";
  owner_scope: "rsm" | "client";
  due_date: string | null;
  shared_note: string;
  responses: Record<string,string>;
  updated_at: string;
};
export type ReportDraft = {
  client_id: string;
  report_month: string;
  analysis: string;
  learnings: string;
  next_steps: string;
  updated_at: string;
};
export type ReportMetrics = {
  published_posts: number;
  posts_with_metrics: number;
  reach: number | null;
  impressions: number | null;
  video_views: number | null;
  followers_gained: number | null;
  interactions: number | null;
  engagement_rate: number | null;
  latest_collection: string | null;
  captured_at: string;
  top_posts: {
    id: string;
    title: string;
    scheduled_date: string;
    reach: number;
    interactions: number;
  }[];
};
export type MonthlyReport = {
  id: string;
  client_id: string;
  report_month: string;
  analysis: string;
  learnings: string;
  next_steps: string;
  metrics: ReportMetrics;
  published_at: string;
  published_by: string | null;
};
export const ONBOARDING_STEPS = [
  {key:"account",label:"Dados da conta",description:"Contato e informações iniciais."},
  {key:"approvers",label:"Aprovadores",description:"Validar a indicação e vincular o acesso autorizado."},
  { key: "contract", label: "Contrato", description: "Assinatura e condições confirmadas." },
  { key: "payment", label: "Pagamento inicial", description: "Confirmação do início do serviço." },
  { key: "briefing", label: "Briefing", description: "Informações e objetivos da sua marca." },
  { key: "access", label: "Acessos", description: "Permissões necessárias para a operação." },
  {
    key: "identity",
    label: "Identidade visual",
    description: "Logo, cores e materiais de referência.",
  },
  {
    key: "kickoff",
    label: "Reunião inicial",
    description: "Alinhamento da operação e das expectativas.",
  },
  {
    key: "strategy",
    label: "Estratégia",
    description: "Direção editorial e prioridades da conta.",
  },
  {
    key: "calendar",
    label: "Primeiro calendário",
    description: "Organização das primeiras publicações.",
  },
];
export const ONBOARDING_STATUS = {
  todo: "Pendente",
  progress: "Em andamento",
  done: "Concluído",
  not_applicable: "Não se aplica",
};
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month.slice(0, 7) + "-01T12:00:00Z"));
}
export function metricLabel(value: number | null | undefined, suffix = "") {
  return value == null
    ? "Sem dados"
    : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}
export function onboardingProgress(steps: OnboardingStep[]) {
  const applicable = steps.filter((s) => s.status !== "not_applicable");
  const done = applicable.filter((s) => s.status === "done").length;
  return {
    done,
    total: applicable.length,
    percent: applicable.length ? Math.round((done / applicable.length) * 100) : steps.length ? 100 : 0,
  };
}
