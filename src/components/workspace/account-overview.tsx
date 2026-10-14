import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertCircle, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccountMeetings } from "@/hooks/use-account-workspace";
import { useFinanceAccess, useCharges, useContracts } from "@/hooks/use-finance";
import { accountContentSummary, localDate } from "@/lib/account-workspace";
import { money, effectiveStatus } from "@/lib/finance-core";
import { type Client } from "@/lib/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard, QueryState, useInternalPosts } from "./account-panels";

export function AccountOverview({
  client,
  onTab,
}: {
  client: Client;
  onTab: (tab: string) => void;
}) {
  const posts = useInternalPosts(client.id);
  const meetings = useAccountMeetings(client.id);
  const finance = useFinanceAccess();
  const charges = useCharges(client.id);
  const contracts = useContracts(client.id);
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
  const today = localDate();
  const nextMeeting = (meetings.data ?? [])
    .filter((m) => m.status === "scheduled" && m.meeting_date >= today)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))[0];
  const nextCharge = (charges.data ?? [])
    .filter((c) => ["pending", "overdue"].includes(effectiveStatus(c)))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const activeContracts = (contracts.data ?? []).filter((c) => c.status === "active");
  const monthlyAmount = activeContracts
    .filter((c) => c.periodicity === "monthly")
    .reduce((sum, c) => sum + Number(c.amount), 0);
  return (
    <div className="space-y-5">
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
      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4.5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Atenção e próximos passos</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Pendências deste cliente, organizadas por prioridade.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {client.churned ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <Clock3 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              Conta encerrada. O histórico continua disponível.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {summary.late > 0 && (
                <Attention
                  kind="urgent"
                  title="Publicações atrasadas"
                  text={`${summary.late} conteúdo(s) passaram da data prevista.`}
                  action="Ver calendário"
                  onClick={() => onTab("calendar")}
                />
              )}
              {finance.canView && nextCharge && effectiveStatus(nextCharge) === "overdue" && (
                <Attention
                  kind="urgent"
                  title="Cobrança em atraso"
                  text="Há cobrança vencida nesta conta."
                  action="Ver financeiro"
                  onClick={() => onTab("finance")}
                />
              )}
              {summary.changes > 0 && (
                <Attention
                  kind="warning"
                  title="Ajustes solicitados"
                  text={`${summary.changes} conteúdo(s) precisam de ajustes.`}
                  action="Ver ajustes"
                  onClick={() => onTab("approvals")}
                />
              )}
              {summary.pending > 0 && (
                <Attention
                  kind="pending"
                  title="Aguardando aprovação"
                  text={`${summary.pending} conteúdo(s) aguardam aprovação do cliente.`}
                  action="Ver aprovações"
                  onClick={() => onTab("approvals")}
                />
              )}
              {!posts.isLoading && !posts.error && !summary.scheduled && (
                <Attention
                  kind="pending"
                  title="Calendário sem publicações"
                  text="Nenhuma publicação programada para este mês."
                  action="Planejar conteúdo"
                  onClick={() => onTab("contents")}
                />
              )}
              {!summary.pending && !summary.changes && !summary.late && summary.scheduled > 0 &&
                !(finance.canView && nextCharge && effectiveStatus(nextCharge) === "overdue") && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-800 dark:text-emerald-200 md:col-span-2">
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                  Nenhuma pendência de conteúdo identificada.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
                loading={charges.isLoading || contracts.isLoading}
                error={charges.error || contracts.error}
              >
                <div>
                  <p className="text-muted-foreground">Mensalidade contratada</p>
                  <p className="mt-1 text-xl font-semibold">
                    {activeContracts.some((c) => c.periodicity === "monthly")
                      ? money(monthlyAmount)
                      : "Não cadastrada"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Próxima cobrança pendente</p>
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
type AttentionKind = "urgent" | "warning" | "pending";
const attentionStyle: Record<AttentionKind, { border: string; icon: typeof AlertTriangle }> = {
  urgent: {
    border: "border-rose-500/20 bg-rose-500/[0.04]",
    icon: AlertTriangle,
  },
  warning: {
    border: "border-amber-500/25 bg-amber-500/[0.05]",
    icon: AlertCircle,
  },
  pending: {
    border: "border-primary/15 bg-primary/[0.035]",
    icon: CalendarClock,
  },
};
function Attention({
  title,
  text,
  action,
  kind,
  onClick,
}: {
  title: string;
  text: string;
  action: string;
  kind: AttentionKind;
  onClick: () => void;
}) {
  const style = attentionStyle[kind];
  const Icon = style.icon;
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-3 rounded-xl border p-3.5 ${style.border}`}>
      <div className="flex items-start gap-2.5">
        <div className="rounded-lg bg-background/80 p-2 text-foreground" aria-hidden>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-8 self-start gap-1.5 bg-background text-xs" onClick={onClick}>
        {action}
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
