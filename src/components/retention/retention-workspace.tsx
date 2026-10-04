import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Plus, MessageSquare, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useRetention,
  useRetentionActions,
  useRetentionMutation,
  useRetentionTeam,
} from "@/hooks/use-retention";
import {
  HEALTH,
  SIGNALS,
  CHANNELS,
  retentionToday,
  dateLabel,
  type RetentionAccount,
  type RetentionAction,
} from "@/lib/retention";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
function ErrorBox({ retry }: { retry: () => unknown }) {
  return (
    <div role="alert" className="rounded-xl border p-5 text-sm">
      Não foi possível carregar o acompanhamento.{" "}
      <Button variant="outline" className="ml-3" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
export function HealthBadge({ account }: { account: RetentionAccount }) {
  const h = HEALTH[account.health];
  return (
    <Badge className={h.tone} variant="outline">
      {h.label}
      {account.score !== null ? ` · ${account.score}/100` : ""}
    </Badge>
  );
}
export function RetentionDashboardCard() {
  const q = useRetention();
  if (q.isLoading)
    return <p className="text-sm text-muted-foreground">Carregando saúde das contas…</p>;
  if (q.error) return <ErrorBox retry={q.refetch} />;
  const risk = (q.data ?? []).filter((a) => a.health === "critical").length,
    attention = (q.data ?? []).filter((a) => a.health === "attention").length;
  return (
    <Card className="border-primary/20">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex gap-3">
          <Activity className="mt-1 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Saúde e retenção</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {risk} em risco · {attention} em atenção · {q.data?.length ?? 0} contas ativas
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/retention">Abrir Central de Retenção</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
export function RetentionWorkspace({ clientId }: { clientId?: string }) {
  const { hasRole } = useAuth();
  const allowed = hasRole("administrator") || hasRole("team");
  const q = useRetention();
  const actions = useRetentionActions(clientId);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<RetentionAccount | null>(null),
    [actionClient, setActionClient] = useState<RetentionAccount | null>(null),
    [editAction, setEditAction] = useState<RetentionAction | null>(null);
  const refresh = useRetentionMutation(async () => {
    const { error } = await supabase.rpc("refresh_retention_queue");
    if (error) throw error;
  }, "Alertas revisados e fila atualizada");
  if (!allowed)
    return (
      <p className="p-8 text-sm text-muted-foreground">Esta área é exclusiva da equipe RSM.</p>
    );
  if (q.isLoading || actions.isLoading)
    return <p className="p-5 text-sm text-muted-foreground">Carregando saúde e acompanhamento…</p>;
  if (q.error || actions.error)
    return (
      <ErrorBox
        retry={() => {
          void q.refetch();
          void actions.refetch();
        }}
      />
    );
  const all = (q.data ?? []).filter((a) => !clientId || a.client_id === clientId),
    today = retentionToday();
  const accounts = all.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || a.health === filter),
  );
  const names = new Map((q.data ?? []).map((a) => [a.client_id, a.name]));
  const open = (actions.data ?? []).filter((a) => a.status === "open" && names.has(a.client_id));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={clientId ? "text-xl font-semibold" : "text-2xl font-semibold tracking-tight"}
          >
            {clientId ? "Saúde e acompanhamento" : "Central de Retenção"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sinais da operação, contatos e próximos passos. Uso interno da RSM.
          </p>
        </div>
        <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {refresh.isPending ? "Atualizando…" : "Atualizar alertas"}
        </Button>
      </div>
      {!clientId && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Contas ativas", all.length],
            ["Em risco", all.filter((a) => a.health === "critical").length],
            ["Em atenção", all.filter((a) => a.health === "attention").length],
            ["Ações vencidas", open.filter((a) => a.due_date < today).length],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Tabs defaultValue="accounts">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="accounts">Saúde das contas</TabsTrigger>
          <TabsTrigger value="actions">Acompanhamento ({open.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4 space-y-4">
          {!clientId && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Buscar cliente"
                placeholder="Buscar cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filtrar saúde"
                className={selectClass + " sm:w-56"}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Todas as situações</option>
                {Object.entries(HEALTH).map(([key, h]) => (
                  <option key={key} value={key}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {accounts.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {clientId
                  ? "Esta conta está fora da operação ativa. O histórico de acompanhamento permanece disponível."
                  : "Nenhuma conta encontrada para este filtro."}
              </CardContent>
            </Card>
          )}
          <div className={clientId ? "space-y-4" : "grid gap-4 xl:grid-cols-2"}>
            {accounts.map((a) => (
              <Card key={a.client_id} className="overflow-hidden">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg">{a.name}</CardTitle>
                    <HealthBadge account={a} />
                  </div>
                  {a.score !== null && (
                    <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${a.score}%` }}
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {[
                      ["Entregas atrasadas", a.late_posts],
                      ["Aprovações paradas", a.stale_approvals],
                      ["Demandas atrasadas", a.late_tasks],
                    ].map(([label, n]) => (
                      <div key={label} className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xl font-semibold">{n}</p>
                        <p className="mt-1 text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      Último contato registrado: <strong>{dateLabel(a.last_contact)}</strong>
                    </p>
                    <p className="text-muted-foreground">
                      {a.days_without_contact} dias{" "}
                      {a.last_contact ? "desde o contato" : "desde o início do acompanhamento"} ·
                      revisão a cada {a.checkin_days} dias
                    </p>
                    {a.renewal_at && (
                      <p>
                        Vencimento do contrato: <strong>{dateLabel(a.renewal_at)}</strong>
                      </p>
                    )}
                  </div>
                  {a.signals.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {a.signals.map((s) => (
                        <li key={s} className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          {SIGNALS[s]}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {a.score === null
                        ? "Ainda não há dados suficientes para pontuar esta conta."
                        : "Sem alertas operacionais pelas regras atuais."}
                    </p>
                  )}
                  {a.risk_reason && (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                      {a.risk_reason}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setSelected(a)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Acompanhar conta
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActionClient(a)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova ação
                    </Button>
                    {!clientId && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/management/clients/$clientId" params={{ clientId: a.client_id }}>
                          Perfil 360º
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <details className="rounded-xl border p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Como a saúde da conta é calculada
            </summary>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>
                O Health Score começa em 100: cada entrega atrasada reduz 10 pontos (máximo 30);
                cada aprovação em revisão sem atualização há 7 dias reduz 5 (máximo 20); cada
                demanda vencida reduz 5 (máximo 20). Contato fora do intervalo reduz 15. Risco
                manual de atenção reduz 15 e risco alto reduz 35.
              </p>
              <p>
                Saudável: 80 a 100. Atenção: 50 a 79 ou sinalização manual. Em risco: abaixo de 50
                ou risco manual alto. Contas novas sem registros ficam sem pontuação. Este é um
                indicador operacional, não uma previsão de cancelamento.
              </p>
              <p>
                Renovações geram alertas a partir de 30 dias antes do vencimento. Reuniões
                concluídas e contatos registrados contam como acompanhamento. Dados financeiros não
                compõem esta pontuação.
              </p>
            </div>
          </details>
          <p className="flex gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Revisão automática diária às 9h (Fortaleza). Lembretes internos, sem envio de mensagens.
            A mesma pendência concluída só pode gerar novo lembrete após 7 dias.
          </p>
        </TabsContent>
        <TabsContent value="actions" className="mt-4 space-y-3">
          {open.length === 0 ? (
            <p className="rounded-xl border p-6 text-sm text-muted-foreground">
              Nenhuma ação aberta. Use “Atualizar alertas” ou crie uma ação no cartão da conta.
            </p>
          ) : (
            open.map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                name={names.get(a.client_id)}
                onEdit={() => setEditAction(a)}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4">
          <ContactHistory clientId={clientId} />
          <h3 className="font-medium">Ações encerradas</h3>
          {(actions.data ?? [])
            .filter((a) => a.status !== "open")
            .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""))
            .map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                name={names.get(a.client_id)}
                onEdit={() => setEditAction(a)}
              />
            ))}
          {!(actions.data ?? []).some((a) => a.status !== "open") && (
            <p className="text-sm text-muted-foreground">Nenhuma ação encerrada.</p>
          )}
          {!clientId && <ChurnHistory />}
        </TabsContent>
      </Tabs>
      {selected && <AccountFollowup account={selected} onClose={() => setSelected(null)} />}
      {actionClient && (
        <ActionDialog account={actionClient} onClose={() => setActionClient(null)} />
      )}
      {editAction && <ActionDialog action={editAction} onClose={() => setEditAction(null)} />}
    </div>
  );
}
function ActionRow({
  action: a,
  name,
  onEdit,
}: {
  action: RetentionAction;
  name?: string;
  onEdit: () => void;
}) {
  const team = useRetentionTeam();
  const overdue = a.status === "open" && a.due_date < retentionToday();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <h4 className="font-medium">{a.title}</h4>
            <Badge variant="outline">
              {a.status === "open"
                ? overdue
                  ? "Atrasada"
                  : "Aberta"
                : a.status === "done"
                  ? "Concluída"
                  : "Encerrada"}
            </Badge>
            {a.auto_key && <Badge variant="secondary">Automática</Badge>}
          </div>
          <p className={"mt-2 text-sm " + (overdue ? "text-destructive" : "text-muted-foreground")}>
            {name ?? "Conta arquivada"} · {dateLabel(a.due_date)} ·{" "}
            {team.data?.find((p) => p.id === a.assignee_id)?.name ?? "Sem responsável"}
          </p>
          {a.description && <p className="mt-2 text-sm whitespace-pre-wrap">{a.description}</p>}
          {a.outcome && <p className="mt-2 text-sm whitespace-pre-wrap">Resultado: {a.outcome}</p>}
        </div>
        {a.status === "open" && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Atualizar ação
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
function ActionDialog({
  account,
  action,
  onClose,
}: {
  account?: RetentionAccount;
  action?: RetentionAction;
  onClose: () => void;
}) {
  const team = useRetentionTeam();
  const [title, setTitle] = useState(action?.title ?? ""),
    [description, setDescription] = useState(action?.description ?? ""),
    [due, setDue] = useState(action?.due_date ?? retentionToday()),
    [assignee, setAssignee] = useState(action?.assignee_id ?? account?.account_manager_id ?? ""),
    [status, setStatus] = useState<RetentionAction["status"]>(action?.status ?? "open"),
    [outcome, setOutcome] = useState(action?.outcome ?? "");
  const save = useRetentionMutation(async () => {
    if (!title.trim() || !due) throw new Error("Informe o título e o prazo.");
    if (status !== "open" && !outcome.trim())
      throw new Error("Registre o resultado antes de encerrar.");
    const fields = {
      title: title.trim(),
      description: description.trim(),
      due_date: due,
      assignee_id: assignee || null,
      status,
      outcome: outcome.trim(),
    };
    const result = action
      ? await supabase
          .from("retention_actions")
          .update(fields)
          .eq("id", action.id)
          .select("id")
          .single()
      : await supabase
          .from("retention_actions")
          .insert({ ...fields, client_id: account!.client_id })
          .select("id")
          .single();
    if (result.error) throw result.error;
    onClose();
  }, "Ação salva");
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {action ? "Atualizar acompanhamento" : `Nova ação · ${account?.name}`}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label htmlFor="ra-title">Próximo passo</Label>
            <Input
              id="ra-title"
              required
              maxLength={180}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ra-desc">Detalhes internos</Label>
            <Textarea
              id="ra-desc"
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ra-date">Prazo</Label>
              <Input
                id="ra-date"
                type="date"
                required
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ra-owner">Responsável</Label>
              <select
                id="ra-owner"
                className={selectClass}
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Sem responsável</option>
                {team.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {team.error && (
                <p className="text-sm text-destructive">Não foi possível carregar responsáveis.</p>
              )}
            </div>
          </div>
          {action && (
            <>
              <div>
                <Label htmlFor="ra-status">Situação</Label>
                <select
                  id="ra-status"
                  className={selectClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RetentionAction["status"])}
                >
                  <option value="open">Em acompanhamento</option>
                  <option value="done">Concluída</option>
                  <option value="cancelled">Encerrada sem execução</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ra-outcome">Resultado do acompanhamento</Label>
                <Textarea
                  id="ra-outcome"
                  required={status !== "open"}
                  maxLength={2000}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar ação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function AccountFollowup({
  account: a,
  onClose,
}: {
  account: RetentionAccount;
  onClose: () => void;
}) {
  const [risk, setRisk] = useState(a.risk_level),
    [reason, setReason] = useState(a.risk_reason),
    [days, setDays] = useState(a.checkin_days),
    [auto, setAuto] = useState(a.automation_enabled),
    [date, setDate] = useState(retentionToday()),
    [channel, setChannel] = useState("whatsapp"),
    [summary, setSummary] = useState("");
  const contact = useRetentionMutation(async () => {
    if (!summary.trim()) throw new Error("Descreva o contato realizado.");
    const { error } = await supabase
      .from("client_contact_log")
      .insert({ client_id: a.client_id, contact_date: date, channel, summary: summary.trim() });
    if (error) throw error;
    setSummary("");
  }, "Contato registrado");
  const settings = useRetentionMutation(async () => {
    if (risk !== "normal" && !reason.trim()) throw new Error("Informe o motivo do risco.");
    const { error } = await supabase
      .from("client_retention_settings")
      .upsert({
        client_id: a.client_id,
        risk_level: risk,
        risk_reason: reason.trim(),
        checkin_days: days,
        automation_enabled: auto,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }, "Configurações salvas");
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !contact.isPending && !settings.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Acompanhar · {a.name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="contact">
          <TabsList>
            <TabsTrigger value="contact">Registrar contato</TabsTrigger>
            <TabsTrigger value="risk">Risco e automação</TabsTrigger>
          </TabsList>
          <TabsContent value="contact">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                contact.mutate();
              }}
            >
              <p className="text-sm text-muted-foreground">
                Registre uma conversa que já aconteceu. Este formulário não envia mensagens.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="rc-date">Data</Label>
                  <Input
                    id="rc-date"
                    type="date"
                    required
                    max={retentionToday()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rc-channel">Canal</Label>
                  <select
                    id="rc-channel"
                    className={selectClass}
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {Object.entries(CHANNELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="rc-summary">Resumo e combinados</Label>
                <Textarea
                  id="rc-summary"
                  rows={4}
                  required
                  maxLength={2000}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
              <Button disabled={contact.isPending || !summary.trim()}>
                {contact.isPending ? "Salvando…" : "Registrar contato"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="risk">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                settings.mutate();
              }}
            >
              <div>
                <Label htmlFor="rc-risk">Avaliação da equipe</Label>
                <select
                  id="rc-risk"
                  className={selectClass}
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as typeof risk)}
                >
                  <option value="normal">Sem risco adicional</option>
                  <option value="attention">Atenção</option>
                  <option value="high">Risco alto</option>
                </select>
              </div>
              <div>
                <Label htmlFor="rc-reason">Motivo e contexto</Label>
                <Textarea
                  id="rc-reason"
                  required={risk !== "normal"}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rc-days">Intervalo entre contatos (7 a 90 dias)</Label>
                <Input
                  id="rc-days"
                  type="number"
                  min={7}
                  max={90}
                  required
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="rc-auto" checked={auto} onCheckedChange={setAuto} />
                <Label htmlFor="rc-auto">Criar lembretes automáticos para esta conta</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Desativar impede novos lembretes automáticos. Ações existentes continuam
                disponíveis.
              </p>
              <Button disabled={settings.isPending}>
                {settings.isPending ? "Salvando…" : "Salvar configurações"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
function ContactHistory({ clientId }: { clientId?: string }) {
  const q = useQuery({
    queryKey: ["retention", "contacts", clientId],
    queryFn: async () => {
      let req = supabase
        .from("client_contact_log")
        .select("*")
        .order("contact_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (clientId) req = req.eq("client_id", clientId);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });
  const clients = useQuery({
    queryKey: ["retention", "client-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <h3 className="font-medium">Últimos contatos registrados</h3>
      {q.isLoading ? (
        <p className="text-sm">Carregando contatos…</p>
      ) : q.error ? (
        <ErrorBox retry={q.refetch} />
      ) : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contato registrado aqui. Reuniões concluídas também entram no indicador.
        </p>
      ) : (
        q.data.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <p className="text-sm font-medium">
                {!clientId &&
                  `${clients.data?.find((x) => x.id === c.client_id)?.name ?? "Cliente"} · `}
                {dateLabel(c.contact_date)} · {CHANNELS[c.channel]}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.summary}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
function ChurnHistory() {
  const q = useQuery({
    queryKey: ["retention", "churn"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,churn_date,churn_reason")
        .eq("churned", true)
        .order("churn_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3 border-t pt-5">
      <h3 className="font-medium">Contas encerradas por churn</h3>
      {q.error ? (
        <ErrorBox retry={q.refetch} />
      ) : q.isLoading ? (
        <p className="text-sm">Carregando…</p>
      ) : q.data?.length ? (
        q.data.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap justify-between gap-3 rounded-xl border p-4 text-sm"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-muted-foreground">
                {dateLabel(c.churn_date)} · {c.churn_reason || "Motivo não registrado"}
              </p>
            </div>
            <Link
              className="text-primary underline"
              to="/management/clients/$clientId"
              params={{ clientId: c.id }}
            >
              Ver histórico da conta
            </Link>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum churn registrado.</p>
      )}
    </div>
  );
}
