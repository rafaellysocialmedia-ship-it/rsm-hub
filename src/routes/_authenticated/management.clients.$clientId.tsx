import { ClientSwitcher } from "@/components/navigation/client-switcher";
import { Deliveries } from "@/components/workspace/deliveries";
import { toast } from "sonner";
import { GroupedNavigation, profileGroups } from "@/components/workspace/grouped-navigation";
import { ClientCalendarPage } from "@/components/workspace/client-calendar";
import { ClientPortal } from "@/components/workspace/client-approvals";
import { AccountHeaderFacts } from "@/components/workspace/account-header-facts";
import { useFinanceAccess } from "@/hooks/use-finance";
import { ExitDetails } from "@/components/clients/exit-details";
import { ClientRequests } from "@/components/workspace/client-requests";
import { ClientOnboarding } from "@/components/workspace/client-onboarding";
import { FeedPreview } from "@/components/workspace/feed-preview";
import { MonthlyReports } from "@/components/workspace/monthly-reports";
import { RetentionWorkspace } from "@/components/retention/retention-workspace";
import { AccountActivity } from "@/components/workspace/account-activity";
import { ContractsCard } from "@/components/clients/contracts-card";
import { ChurnCard } from "@/components/clients/churn-card";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Video, MoreHorizontal, FilePlus2, CreditCard, Send, Copy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Client } from "@/lib/clients";

import { AccountOverview } from "@/components/workspace/account-overview";
import {
  AccountContents,
  AccountMeetings,
  AccountFiles,
  QueryState,
} from "@/components/workspace/account-panels";
import { AccountStrategy } from "@/components/workspace/account-strategy";
import { useAccountSync } from "@/hooks/use-account-workspace";
import { PortalSettingsCard } from "@/components/clients/portal-settings-card";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { PostEditorSheet } from "@/components/posts/post-editor-sheet";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClientLogo } from "@/components/clients/client-logo";
import { StatusBadge } from "@/components/clients/status-badge";
import { JourneyCard } from "@/components/clients/journey-card";
import { OverviewTab } from "@/components/management/overview-tab";
import { InfoTab } from "@/components/management/info-tab";
import { ServicesTab } from "@/components/management/services-tab";
import { TeamTab } from "@/components/management/team-tab";
import { DocumentsTab } from "@/components/management/documents-tab";
import { AccountsTab } from "@/components/management/accounts-tab";
import { IntegrationsTab } from "@/components/management/integrations-tab";
import { DigitalAssetsTab } from "@/components/management/digital-assets-tab";
import { TimelineTab } from "@/components/management/timeline-tab";
import { InternalChatTab } from "@/components/management/internal-chat-tab";
import { ClientBriefingsTab } from "@/components/management/client-briefings-tab";
import { ClientFinanceTab } from "@/components/finance/client-finance-tab";

export const Route = createFileRoute("/_authenticated/management/clients/$clientId")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cliente · RSM Gestão de Marketing" },
      {
        name: "description",
        content:
          "Cadastro mestre do cliente: informações, serviços, briefings, equipe, documentos, acessos e histórico.",
      },
    ],
  }),
  component: ClientMasterRoute,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">
      Cliente não encontrado
    </div>
  ),
});

function ClientMasterRoute() {
  const { clientId } = Route.useParams();
  return <ClientMasterPage key={clientId} />;
}
function ClientMasterPage() {
  const { clientId } = Route.useParams();
  const { hasRole } = useAuth();
  const financeAccess = useFinanceAccess();
  const canEdit = hasRole("administrator") || hasRole("team");
  const { tab: requestedTab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = requestedTab || "overview";
  const setTab = (value: string) => {
    void navigate({ search: { tab: value }, replace: true });
  };
  const [editOpen, setEditOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("info");
  useAccountSync(canEdit ? clientId : undefined);

  const { data: client, isLoading } = useQuery({
    queryKey: ["clients", clientId],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });

  if (!canEdit)
    return (
      <div className="p-8 text-sm text-muted-foreground">Esta área é exclusiva da equipe RSM.</div>
    );

  if (isLoading) {
    return <div className="px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!client) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/management/clients">Voltar</Link>
        </Button>
      </div>
    );
  }

  const journeyStage =
    (
      client as unknown as {
        journey_stage?: "closing" | "kickoff" | "onboarding" | "ongoing" | "renewal" | "offboarded";
      }
    ).journey_stage ?? "closing";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
      <Link
        to="/management/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Clientes
      </Link>

      <ClientSwitcher id={client.id} name={client.name} tab={tab} />
      <div className="mt-3 flex items-center gap-3">
        <ClientLogo path={client.logo_url} name={client.name} className="h-12 w-12 sm:h-14 sm:w-14" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.plan || "Plano a definir"} · {client.segment || "Sem segmento"}
          </p>
        </div>
      </div>

      <AccountHeaderFacts client={client} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!client.churned && (
          <>
            <Button size="sm" onClick={() => setPostOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar conteúdo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
              Nova demanda
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" aria-label="Abrir outras ações do cliente">
              <MoreHorizontal className="mr-2 h-4 w-4" />
              Mais ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {!client.churned && (
              <>
                {financeAccess.canEdit && (
                  <DropdownMenuItem onSelect={() => setTab("finance")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Registrar pagamento
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setTab("documents")}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Adicionar arquivo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("contents")}>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para aprovação
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMeetingOpen(true)}>
                  <Video className="mr-2 h-4 w-4" />
                  Agendar reunião
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/portal`).then(
                  () => toast.success("Link do portal copiado. O cliente deve entrar com seu próprio acesso."),
                  () => toast.error("Não foi possível copiar o link."),
                );
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar acesso ao portal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <GroupedNavigation
          groups={profileGroups.map((group) => ({
            ...group,
            items: group.items.filter(([value]) => financeAccess.canView || !["finance", "contract"].includes(value)),
          }))}
          tab={tab}
          onTab={setTab}
        />
        <TabsContent value="overview" className="mt-5 space-y-4">
          <AccountOverview client={client} onTab={setTab} />
          <Deliveries clientId={client.id} canEdit={canEdit && !client.churned} />
          <OverviewTab client={client} />
          <JourneyCard clientId={client.id} currentStage={journeyStage} />
        </TabsContent>
        <TabsContent value="support" className="mt-5">
          <ClientRequests clientId={client.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="retention" className="mt-5">
          <RetentionWorkspace clientId={client.id} />
        </TabsContent>
        <TabsContent value="strategy" className="mt-5 space-y-4">
          <AccountStrategy clientId={client.id} canEdit={canEdit} />
          <ClientBriefingsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="contents" className="mt-5">
          <AccountContents client={client} canEdit={!client.churned} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-5">
          <ClientCalendarPage clientId={client.id} />
        </TabsContent>
        <TabsContent value="feed" className="mt-5">
          <FeedPreview clientId={client.id} name={client.name} logo={client.logo_url} />
        </TabsContent>
        <TabsContent value="onboarding" className="mt-5">
          <ClientOnboarding clientId={client.id} canEdit={canEdit && !client.churned} />
        </TabsContent>
        <TabsContent value="approvals" className="mt-5">
          <ClientPortal clientId={client.id} />
        </TabsContent>
        <TabsContent value="demands" className="mt-5">
          <AccountDemands client={client} />
        </TabsContent>
        <TabsContent value="finance" className="mt-5">
          <ClientFinanceTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="contract" className="mt-5">
          <ContractsCard clientId={client.id} />
        </TabsContent>
        <TabsContent value="reports" className="mt-5 space-y-5">
          <MonthlyReports
            clientId={client.id}
            clientName={client.name}
            canEdit={canEdit && !client.churned}
          />
          <h3 className="text-base font-medium">Arquivos de relatórios</h3>
          <AccountFiles clientId={client.id} reportsOnly />
        </TabsContent>
        <TabsContent value="meetings" className="mt-5">
          <AccountMeetings
            clientId={client.id}
            clientName={client.name}
            canEdit={!client.churned}
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-5 space-y-4">
          <AccountFiles clientId={client.id} />
          <DocumentsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="history" className="mt-5 space-y-5">
          <AccountActivity clientId={client.id} />
          <TimelineTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Tabs value={settingsTab} onValueChange={setSettingsTab}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
              <label htmlFor="rsm-client-settings" className="text-sm font-medium">
                Configurações da conta
              </label>
              <select
                id="rsm-client-settings"
                aria-label="Selecione a configuração do cliente"
                value={settingsTab}
                onChange={(event) => setSettingsTab(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
              >
                <option value="info">Informações</option>
                <option value="services">Serviços</option>
                <option value="team">Equipe</option>
                <option value="accounts">Acessos</option>
                <option value="assets">Ativos digitais</option>
                <option value="integrations">Integrações</option>
                <option value="portal">Painel do cliente</option>
                <option value="chat">Chat interno</option>
              </select>
            </div>
            <TabsContent value="info">
              <ChurnCard clientId={client.id} />
              <ExitDetails clientId={client.id} />
              <InfoTab client={client} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="services">
              <ServicesTab clientId={client.id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="team">
              <TeamTab clientId={client.id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="accounts">
              <AccountsTab clientId={client.id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="assets">
              <DigitalAssetsTab clientId={client.id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsTab clientId={client.id} />
            </TabsContent>
            <TabsContent value="portal">
              <PortalSettingsCard clientId={client.id} />
            </TabsContent>
            <TabsContent value="chat">
              <InternalChatTab clientId={client.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      <ClientFormDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
      <PostEditorSheet
        clients={[client]}
        post={null}
        initial={{ client_id: client.id }}
        open={postOpen}
        onOpenChange={setPostOpen}
      />
      <MeetingDialog
        clients={[{ id: client.id, name: client.name }]}
        meeting={null}
        defaultClientId={client.id}
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
      />
      <TaskDialog
        clients={[client]}
        task={null}
        defaultClientId={client.id}
        open={taskOpen}
        onOpenChange={setTaskOpen}
      />
    </div>
  );
}

function AccountDemands({ client }: { client: Client }) {
  const [editing, setEditing] = useState<Task | null>(null);
  const query = useQuery({
    queryKey: ["tasks", "client", client.id, "all"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("client_id", client.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
  return (
    <>
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length}>
        <div className="space-y-3">
          {query.data?.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {
                      {
                        todo: "A fazer",
                        production: "Produção",
                        waiting_client: "Aguardando cliente",
                        review: "Revisão",
                        done: "Concluída",
                      }[task.status]
                    }{" "}
                    ·{" "}
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString("pt-BR")
                      : "Prazo a definir"}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setEditing(task)}>
                  Abrir demanda
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>
      <TaskDialog
        clients={[client]}
        task={editing}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
