import type { RetentionAccount } from "@/lib/retention";

export type AlertLevel = "urgent" | "warning" | "info";

/** One alert of a client account, pointing to the tab where it is resolved. */
export type ClientAlert = {
  key: string;
  level: AlertLevel;
  /** Short text used in chips, e.g. "2 cobranças vencidas". */
  label: string;
  /** Longer explanation used in the account overview. */
  detail: string;
  /** Tab of the client page where the alert is handled. */
  tab: string;
  /** Label of the action button in the account overview. */
  action: string;
};

const LEVEL_ORDER: Record<AlertLevel, number> = { urgent: 0, warning: 1, info: 2 };

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Builds the alert list of a client from the retention overview (the same
 * source used by "Sua atenção hoje" and "Saúde da conta") plus the monthly
 * publication balance. Returns the most serious alerts first.
 */
export function buildClientAlerts(
  account: RetentionAccount | undefined,
  options: { quotaExtras?: number } = {},
): ClientAlert[] {
  const alerts: ClientAlert[] = [];
  const add = (alert: ClientAlert) => alerts.push(alert);

  if (account) {
    if (account.finance_available && account.overdue_payments > 0)
      add({
        key: "overdue_payments",
        level: "urgent",
        label: n(account.overdue_payments, "cobrança vencida", "cobranças vencidas"),
        detail: "Há cobrança vencida e ainda não recebida nesta conta.",
        tab: "finance",
        action: "Ver cobranças",
      });
    if (account.late_posts > 0)
      add({
        key: "late_posts",
        level: "urgent",
        label: n(account.late_posts, "publicação atrasada", "publicações atrasadas"),
        detail: "Conteúdos que passaram da data prevista sem serem publicados.",
        tab: "calendar",
        action: "Ver calendário",
      });
    if (account.late_tasks > 0)
      add({
        key: "late_tasks",
        level: "urgent",
        label: n(account.late_tasks, "tarefa atrasada", "tarefas atrasadas"),
        detail: "Demandas com prazo vencido.",
        tab: "demands",
        action: "Ver tarefas",
      });
    if (account.complaints > 0)
      add({
        key: "complaints",
        level: "urgent",
        label: n(account.complaints, "reclamação aberta", "reclamações abertas"),
        detail: "Reclamações do cliente ainda sem conclusão.",
        tab: "support",
        action: "Ver solicitações",
      });
    if (account.stale_approvals > 0)
      add({
        key: "stale_approvals",
        level: "warning",
        label: n(account.stale_approvals, "aprovação parada", "aprovações paradas"),
        detail: "Conteúdos enviados ao cliente que estão há dias sem resposta.",
        tab: "approvals",
        action: "Ver aprovações",
      });
    else if (account.approvals_pending > 0)
      add({
        key: "approvals_pending",
        level: "info",
        label: n(account.approvals_pending, "aguardando aprovação", "aguardando aprovação"),
        detail: "Conteúdos aguardando a aprovação do cliente.",
        tab: "approvals",
        action: "Ver aprovações",
      });
    if (account.awaiting_response > 0)
      add({
        key: "awaiting_response",
        level: "warning",
        label: n(account.awaiting_response, "solicitação sem resposta", "solicitações sem resposta"),
        detail: "Solicitações do cliente aguardando retorno da equipe.",
        tab: "support",
        action: "Responder",
      });
    if (account.late_materials > 0)
      add({
        key: "late_materials",
        level: "warning",
        label: n(account.late_materials, "material atrasado", "materiais atrasados"),
        detail: "Materiais pedidos ao cliente que passaram do prazo.",
        tab: "support",
        action: "Ver materiais",
      });
    if (account.renewal_at) {
      const days = Math.round(
        (new Date(account.renewal_at).getTime() - new Date(account.today + "T00:00:00").getTime()) /
          86_400_000,
      );
      if (days <= 30)
        add({
          key: "renewal",
          level: "warning",
          label: days < 0 ? "Contrato vencido" : days === 0 ? "Contrato vence hoje" : `Contrato vence em ${days} d`,
          detail:
            days < 0
              ? "A vigência do contrato terminou. Renove ou renegocie para manter o cadastro em dia."
              : "A vigência do contrato termina em breve. Combine a renovação com o cliente.",
          tab: "contract",
          action: "Ver contrato",
        });
    }
    if (account.engagement_drop)
      add({
        key: "engagement_drop",
        level: "warning",
        label: "Queda de engajamento",
        detail: "O engajamento do último relatório caiu mais de 30% em relação ao mês anterior.",
        tab: "reports",
        action: "Ver relatórios",
      });
    if (account.revisions >= 3)
      add({
        key: "many_revisions",
        level: "warning",
        label: n(account.revisions, "pedido de ajuste em 30 dias", "pedidos de ajuste em 30 dias"),
        detail: "O cliente pediu muitos ajustes nos últimos 30 dias.",
        tab: "approvals",
        action: "Ver aprovações",
      });
    if (account.days_without_meeting >= account.checkin_days)
      add({
        key: "no_meeting",
        level: "info",
        label: "Reunião de acompanhamento pendente",
        detail: `Sem reunião concluída há ${account.days_without_meeting} dias.`,
        tab: "meetings",
        action: "Agendar reunião",
      });
    if (account.onboarding_pending > 0)
      add({
        key: "onboarding",
        level: "info",
        label: n(account.onboarding_pending, "etapa de onboarding pendente", "etapas de onboarding pendentes"),
        detail: "O onboarding desta conta ainda não foi concluído.",
        tab: "onboarding",
        action: "Ver onboarding",
      });
    if (account.no_scheduled)
      add({
        key: "no_scheduled",
        level: "info",
        label: "Sem publicações agendadas",
        detail: "Nenhuma publicação aprovada ou agendada para os próximos 30 dias.",
        tab: "calendar",
        action: "Planejar conteúdo",
      });
  }

  const extras = options.quotaExtras ?? 0;
  if (extras > 0)
    add({
      key: "quota_excess",
      level: "warning",
      label: `${n(extras, "publicação", "publicações")} acima do plano no mês`,
      detail: "O calendário deste mês passou do total a entregar. Avalie cobrar como extra ou ajustar o saldo.",
      tab: "calendar",
      action: "Ver calendário",
    });

  return alerts.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** Most serious level among the alerts, or null when there is none. */
export function worstLevel(alerts: ClientAlert[]): AlertLevel | null {
  return alerts.length ? alerts[0].level : null;
}
