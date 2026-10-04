import { Deliveries } from "./deliveries";
import { GroupedNavigation, portalGroups } from "./grouped-navigation";
import { MaterialUpload } from "./material-upload";
import { ClientRequests, ClientRequestAttention } from "./client-requests";
import { ClientOnboarding } from "./client-onboarding";
import { FeedPreview } from "./feed-preview";
import { MonthlyReports } from "./monthly-reports";
import { useMonthlyReports } from "@/hooks/use-client-experience";
import { monthLabel } from "@/lib/client-experience";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CheckCircle2, ExternalLink, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useAccountSync,
  usePortalAccount,
  useAccountMeetings,
  useAccountFiles,
} from "@/hooks/use-account-workspace";
import {
  accountContentSummary,
  localDate,
  safeExternalUrl,
  type PortalAccount,
} from "@/lib/account-workspace";
import { money, dateBR } from "@/lib/finance-core";
import { ClientLogo } from "@/components/clients/client-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountFiles, AccountMeetings, MetricCard, QueryState } from "./account-panels";
import { ClientCalendarPage } from "./client-calendar";
import { ClientPortal } from "./client-approvals";

export function ClientWorkspace() {
  const { profile, user, loading } = useAuth();
  const query = usePortalAccount(!loading && !!user);
  useAccountSync(query.data?.id);
  const [tab, setTab] = useState("home");
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <QueryState loading={loading || query.isLoading} error={query.error}>
        {!query.data ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Seu acesso ainda não está vinculado a uma conta. Entre em contato com a RSM.
            </CardContent>
          </Card>
        ) : (
          <>
            <header className="flex items-center gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-7">
              <ClientLogo
                path={query.data.logo_url}
                name={query.data.name}
                className="h-14 w-14 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">RSM · Painel do cliente</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Olá, {profile?.name?.split(" ")[0] || query.data.name}.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {query.data.name}
                  {query.data.plan && ` · ${query.data.plan}`}
                </p>
              </div>
            </header>
            <Tabs value={tab} onValueChange={setTab} className="mt-6">
              <GroupedNavigation
                groups={portalGroups.filter(
                  (g) => g.title !== "Financeiro" || query.data?.can_view_finance,
                )}
                tab={tab}
                onTab={setTab}
              />
              <TabsContent value="support" className="mt-5">
                <ClientRequests clientId={query.data.id} />
              </TabsContent>
              <TabsContent value="home" className="mt-5">
                <ClientHome account={query.data} onTab={setTab} />
              </TabsContent>
              <TabsContent value="contents" className="mt-5">
                <ClientPortal key="contents" defaultTab="all" />
              </TabsContent>
              <TabsContent value="approvals" className="mt-5">
                <ClientPortal key="approvals" />
              </TabsContent>
              <TabsContent value="calendar" className="mt-5">
                <ClientCalendarPage />
              </TabsContent>
              <TabsContent value="feed" className="mt-5">
                <FeedPreview
                  clientId={query.data.id}
                  name={query.data.name}
                  logo={query.data.logo_url}
                />
              </TabsContent>
              <TabsContent value="onboarding" className="mt-5">
                <ClientOnboarding clientId={query.data.id} />
              </TabsContent>
              <TabsContent value="meetings" className="mt-5">
                <AccountMeetings clientId={query.data.id} clientName={query.data.name} />
              </TabsContent>
              <TabsContent value="reports" className="mt-5 space-y-4">
                <MonthlyReports clientId={query.data.id} clientName={query.data.name} />
                <h3 className="text-base font-medium">Arquivos de relatórios</h3>
                <AccountFiles clientId={query.data.id} reportsOnly />
              </TabsContent>
              <TabsContent value="files" className="mt-5">
                <MaterialUpload clientId={query.data.id} />
                <AccountFiles clientId={query.data.id} />
              </TabsContent>
              <TabsContent value="contract" className="mt-5">
                <ClientContracts account={query.data} />
              </TabsContent>
              <TabsContent value="finance" className="mt-5">
                {query.data.can_view_finance && <ClientFinance account={query.data} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </QueryState>
    </div>
  );
}
function ClientHome({ account, onTab }: { account: PortalAccount; onTab: (tab: string) => void }) {
  const posts = useQuery({
    queryKey: ["portal-home-posts", account.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_posts")
        .select("id,title,status,scheduled_date,scheduled_time")
        .eq("client_id", account.id)
        .in("status", [
          "review",
          "changes_requested",
          "approved",
          "to_schedule",
          "scheduled",
          "published",
        ])
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const meetings = useAccountMeetings(account.id);
  const files = useAccountFiles(account.id);
  const updates = useQuery({
    queryKey: ["portal-timeline", account.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_timeline")
        .select("id,title,detail,created_at")
        .eq("client_id", account.id)
        .eq("visibility", "client")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });
  const summary = accountContentSummary(posts.data ?? []);
  const nextMeeting = (meetings.data ?? [])
    .filter((m) => m.status === "scheduled" && m.meeting_date >= localDate())
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))[0];
  const nextPosts = (posts.data ?? [])
    .filter(
      (p) =>
        p.scheduled_date &&
        p.scheduled_date >= localDate() &&
        ["approved", "to_schedule", "scheduled"].includes(p.status),
    )
    .slice(0, 4);
  const monthlyReports = useMonthlyReports(account.id);
  const report = files.data?.find((f) => f.category === "relatorios");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => onTab("approvals")}>Revisar conteúdos</Button>
        <Button variant="outline" onClick={() => onTab("files")}>
          Enviar materiais
        </Button>
        <Button variant="outline" onClick={() => onTab("calendar")}>
          Ver calendário
        </Button>
      </div>
      <ClientRequestAttention clientId={account.id} onOpen={() => onTab("support")} />
      <ClientOnboarding clientId={account.id} compact onOpen={() => onTab("onboarding")} />
      <QueryState loading={posts.isLoading} error={posts.error}>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Aguardando sua aprovação"
            value={summary.pending}
            onClick={() => onTab("approvals")}
          />
          <MetricCard
            label="Publicados neste mês"
            value={summary.published}
            onClick={() => onTab("contents")}
          />
          <MetricCard
            label="Programados neste mês"
            value={summary.scheduled}
            onClick={() => onTab("contents")}
          />
        </div>
      </QueryState>
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">O que precisa de você</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.pending > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">{summary.pending} conteúdo(s) aguardam sua aprovação.</p>
              <Button onClick={() => onTab("approvals")}>Revisar conteúdos</Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Nenhuma aprovação pendente.
            </p>
          )}
          {nextMeeting && (
            <p className="text-sm">
              Sua próxima reunião: {dateBR(nextMeeting.meeting_date)}
              {nextMeeting.meeting_time && ` às ${nextMeeting.meeting_time.slice(0, 5)}`}.
            </p>
          )}
        </CardContent>
      </Card>
      <Deliveries clientId={account.id} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Próximas publicações</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/portal/calendar">Ver calendário</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <QueryState loading={posts.isLoading} error={posts.error} empty={!nextPosts.length}>
              <ul className="divide-y">
                {nextPosts.map((p) => (
                  <li key={p.id} className="py-3">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dateBR(p.scheduled_date)}
                      {p.scheduled_time && ` · ${p.scheduled_time.slice(0, 5)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </QueryState>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sua conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Próxima reunião</p>
              <button
                className="mt-1 text-left font-medium hover:underline"
                onClick={() => onTab("meetings")}
              >
                {meetings.error ? "Indisponível" : nextMeeting?.title || "Nenhuma reunião agendada"}
              </button>
            </div>
            <div>
              <p className="text-muted-foreground">Último relatório</p>
              <button
                className="mt-1 text-left font-medium hover:underline"
                onClick={() => onTab("reports")}
              >
                {monthlyReports.data?.[0]
                  ? monthLabel(monthlyReports.data[0].report_month)
                  : monthlyReports.error || files.error
                    ? "Indisponível"
                    : report?.name || "Ainda não disponível"}
              </button>
            </div>
            <div>
              <p className="text-muted-foreground">Contrato</p>
              <button
                className="mt-1 text-left font-medium hover:underline"
                onClick={() => onTab("contract")}
              >
                {account.signed_contracts.some((c) => c.status === "signed")
                  ? "Contrato assinado disponível"
                  : "Acompanhar contrato"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <QueryState loading={updates.isLoading} error={updates.error}>
        {!!updates.data?.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atualizações da RSM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {updates.data.map((u) => (
                <div key={u.id} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-sm font-medium">{u.title}</p>
                  {u.detail && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {u.detail}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
function ClientFinance({ account }: { account: PortalAccount }) {
  const pending = account.charges
    .filter((c) => c.status === "pending" || c.status === "overdue")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const monthly = account.contracts.filter(
    (c) => c.status === "active" && c.periodicity === "monthly",
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Plano" value={account.plan || "A definir"} />
        <MetricCard
          label="Mensalidade"
          value={
            monthly.length
              ? money(monthly.reduce((sum, c) => sum + Number(c.amount), 0))
              : "A definir"
          }
        />
        <MetricCard
          label="Próximo vencimento pendente"
          value={pending[0] ? dateBR(pending[0].due_date) : "Nenhum"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState empty={!account.charges.length}>
            <ul className="divide-y">
              {account.charges.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">{c.service_label || "Mensalidade"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vencimento: {dateBR(c.due_date)}
                      {c.paid_date && ` · Pago em ${dateBR(c.paid_date)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{money(c.amount)}</span>
                    {safeExternalUrl(c.payment_url) &&
                      c.status !== "paid" &&
                      c.status !== "cancelled" && (
                        <Button asChild size="sm">
                          <a
                            href={safeExternalUrl(c.payment_url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Pagar
                          </a>
                        </Button>
                      )}
                    <Badge variant="outline">
                      {(
                        {
                          paid: "Pago",
                          pending: "Pendente",
                          overdue: "Atrasado",
                          cancelled: "Cancelado",
                        } as Record<string, string>
                      )[c.status] || c.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
function ClientContracts({ account }: { account: PortalAccount }) {
  async function openStored(path: string) {
    try {
      const { data, error } = await supabase.storage
        .from("client-contracts")
        .createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível abrir o contrato.");
    }
  }
  return (
    <div className="space-y-4">
      {account.contracts.map((c) => (
        <Card key={c.id}>
          <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Serviço</p>
              <p className="mt-1 font-medium">
                {c.service_label || account.plan || "Serviço contratado"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Vigência</p>
              <p className="mt-1">
                {dateBR(c.start_date)} até {dateBR(c.end_date)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="mt-1">
                {(
                  {
                    active: "Ativo",
                    pending: "Pendente",
                    ended: "Encerrado",
                    cancelled: "Cancelado",
                  } as Record<string, string>
                )[c.status] || c.status}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
      <QueryState empty={!account.signed_contracts.length}>
        {account.signed_contracts.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <FileSignature className="h-4 w-4 text-primary" />
                  {c.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {(
                    {
                      signed: "Assinado",
                      pending: "Pendente",
                      expired: "Expirado",
                      cancelled: "Cancelado",
                    } as Record<string, string>
                  )[c.status] || c.status}
                  {c.signature_provider &&
                    ` · ${({ zapsign: "ZapSign", autentique: "Autentique", other: "Outra plataforma" } as Record<string, string>)[c.signature_provider] || c.signature_provider}`}
                </p>
              </div>
              {safeExternalUrl(c.signed_url) ? (
                <Button asChild variant="outline">
                  <a
                    href={safeExternalUrl(c.signed_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver contrato assinado
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : c.storage_path ? (
                <Button variant="outline" onClick={() => void openStored(c.storage_path!)}>
                  Ver contrato
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Documento ainda não disponível
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </QueryState>
    </div>
  );
}
