import { ListSkeleton } from "@/components/skeletons";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccountMeetings } from "@/hooks/use-account-workspace";
import { useFinanceAccess, useCharges, useContracts, useClientServices } from "@/hooks/use-finance";
import { monthlyServiceSummary } from "@/lib/monthly-service-summary";
import { accountContentSummary, localDate } from "@/lib/account-workspace";
import { money, effectiveStatus } from "@/lib/finance-core";
import { type Client } from "@/lib/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard, QueryState, useInternalPosts } from "./account-panels";
import { ClientAlertList } from "@/components/clients/client-alerts";
import { noticeLabel, parseNotice } from "@/lib/notice-period";
import { useClientAlerts } from "@/hooks/use-client-alerts";

export function AccountOverview({
  client,
  onTab,
  onConfigureBilling,
}: {
  client: Client;
  onTab: (tab: string) => void;
  onConfigureBilling: () => void;
}) {
  const posts = useInternalPosts(client.id);
  const meetings = useAccountMeetings(client.id);
  const finance = useFinanceAccess();
  const charges = useCharges(client.id);
  const contracts = useContracts(client.id);
  const services = useClientServices(finance.canView ? client.id : null);
  const tasks = useQuery({
    queryKey: ["tasks", "client", client.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,status,due_date")
        .eq("client_id", client.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const timeline = useQuery({
    queryKey: ["client-timeline", client.id, "latest"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_timeline")
        .select("title,created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const summary = accountContentSummary(posts.data ?? []);
  const alerts = useClientAlerts(client.id);
  const accountAlerts = alerts.byClient.get(client.id)?.alerts ?? [];
  const today = localDate();
  const nextMeeting = (meetings.data ?? [])
    .filter((m) => m.status === "scheduled" && m.meeting_date >= today)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))[0];
  const nextCharge = (charges.data ?? [])
    .filter((c) => ["pending", "overdue"].includes(effectiveStatus(c)))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const activeContracts = (contracts.data ?? []).filter((c) => c.status === "active");
  const monthly = monthlyServiceSummary(services.data ?? [], activeContracts);
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4.5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">
                Alertas e próximos passos
                {!client.churned && accountAlerts.length > 0 && (
                  <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {accountAlerts.length}
                  </span>
                )}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tudo o que pede atenção nesta conta, do mais urgente ao menos urgente.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {client.churned ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <Clock3 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Conta encerrada. O histórico continua disponível.
                {noticeLabel(parseNotice(client.churn_notes)) && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {noticeLabel(parseNotice(client.churn_notes))}
                  </span>
                )}
              </span>
            </div>
          ) : alerts.isLoading ? (
            <ListSkeleton rows={2} />
          ) : alerts.error ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar os alertas desta conta.
            </p>
          ) : accountAlerts.length > 0 ? (
            <ClientAlertList alerts={accountAlerts} onTab={onTab} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
              Nenhuma pendência identificada nesta conta.
            </div>
          )}
        </CardContent>
      </Card>
      <QueryState loading={posts.isLoading} error={posts.error}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Publicados neste mês"
            value={summary.published}
            onClick={() => onTab("contents")}
          />
          <MetricCard
            label="Programados neste mês"
            value={summary.scheduled}
            onClick={() => onTab("calendar")}
          />
          <MetricCard
            label="Aguardando aprovação"
            value={summary.pending}
            onClick={() => onTab("approvals")}
          />
          <MetricCard
            label="Demandas abertas"
            value={tasks.isLoading ? "…" : tasks.error ? "Indisponível" : (tasks.data?.length ?? 0)}
            onClick={() => onTab("demands")}
          />
        </div>
      </QueryState>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relacionamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Próxima reunião</p>
              <p className="mt-1 font-medium">
                {meetings.error
                  ? "Indisponível"
                  : nextMeeting
                    ? `${nextMeeting.title} · ${new Date(nextMeeting.meeting_date + "T00:00:00").toLocaleDateString("pt-BR")} ${nextMeeting.meeting_time?.slice(0, 5) ?? ""}`
                    : "Nenhuma reunião agendada"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Última atividade registrada</p>
              <p className="mt-1">
                {timeline.data
                  ? `${timeline.data.title} · ${new Date(timeline.data.created_at).toLocaleDateString("pt-BR")}`
                  : "Sem registro"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Tempo como cliente</p>
              <p className="mt-1">
                {Math.max(
                  0,
                  differenceInCalendarDays(
                    new Date(),
                    new Date((client.start_date || client.created_at).slice(0, 10) + "T00:00:00"),
                  ),
                )}{" "}
                dias
              </p>
            </div>
            <Button variant="outline" onClick={() => onTab("meetings")}>
              Ver reuniões
            </Button>
          </CardContent>
        </Card>
        {finance.canView && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contrato e financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <QueryState
                loading={charges.isLoading || contracts.isLoading || services.isLoading}
                error={charges.error || contracts.error || services.error}
              >
                <div>
                  <p className="text-muted-foreground">Mensalidade contratada</p>
                  <p className="mt-1 text-xl font-semibold">
                    {monthly.hasMonthly ? money(monthly.amount) : "Não cadastrada"}
                  </p>
                </div>
                {monthly.missingBillingDay && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Dia de vencimento pendente em um ou mais serviços ativos.
                    </p>
                    <Button size="sm" variant="outline" onClick={onConfigureBilling}>
                      Configurar vencimento
                    </Button>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Cobrança pendente mais antiga</p>
                  <p className="mt-1">
                    {nextCharge
                      ? `${money(nextCharge.amount)} · ${new Date(nextCharge.due_date + "T00:00:00").toLocaleDateString("pt-BR")}`
                      : "Nenhuma cobrança pendente"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contratos ativos</p>
                  <p className="mt-1">{activeContracts.length}</p>
                </div>
              </QueryState>
              <Button variant="outline" onClick={() => onTab("finance")}>
                Ver financeiro
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
