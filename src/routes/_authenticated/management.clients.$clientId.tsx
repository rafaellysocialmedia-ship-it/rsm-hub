import {Deliveries} from "@/components/workspace/deliveries";
import {toast} from "sonner";
import {GroupedNavigation,profileGroups} from "@/components/workspace/grouped-navigation";
import {ClientCalendarPage} from "@/components/workspace/client-calendar";
import {ClientPortal} from "@/components/workspace/client-approvals";
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
import { ArrowLeft, Plus, Pencil, Video } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      { title: "Perfil 360º · RSM Gestão de Marketing" },
      {
        name: "description",
        content:
          "Cadastro mestre do cliente: informações, serviços, briefings, equipe, documentos, acessos e histórico.",
      },
    ],
  }),
  component: ClientMasterPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">
      Cliente não encontrado
    </div>
  ),
});

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
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        to="/management/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Clientes
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <ClientLogo path={client.logo_url} name={client.name} className="h-16 w-16" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Perfil 360º · {client.plan || "Plano a definir"} · {client.segment || "Sem segmento"}
          </p>
        </div>
      </div>

      <AccountHeaderFacts client={client} />
      <div className="mt-6 flex flex-wrap gap-2">
        {!client.churned && (
          <>
            <Button onClick={() => setPostOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar conteúdo
            </Button>
            <Button variant="outline" onClick={() => setTaskOpen(true)}>
              Nova demanda
            </Button>
            {financeAccess.canEdit && (
              <Button variant="outline" onClick={() => setTab("finance")}>
                Registrar pagamento
              </Button>
            )}
            <Button variant="outline" onClick={() => setTab("documents")}>
              Adicionar arquivo
            </Button>
            <Button variant="outline" onClick={() => setTab("contents")}>
              Enviar para aprovação
            </Button>
            <Button variant="outline" onClick={() => setMeetingOpen(true)}>
              <Video className="mr-2 h-4 w-4" />
              Agendar reunião
            </Button>
          </>
        )}
        <Button variant="outline" onClick={()=>{void navigator.clipboard.writeText(`${window.location.origin}/portal`).then(()=>toast.success("Link do portal copiado. O cliente deve entrar com seu próprio acesso."),()=>toast.error("Não foi possível copiar o link."));}}>Copiar acesso ao portal</Button>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar cliente
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <GroupedNavigation groups={profileGroups.filter(g=>g.title!=="Financeiro"||financeAccess.canView)} tab={tab} onTab={setTab}/>
        <TabsContent value="overview" className="mt-5 space-y-4">
          <AccountOverview client={client} onTab={setTab} /><Deliveries clientId={client.id} canEdit={canEdit&&!client.churned}/>
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
        <TabsContent value="settings" className="mt-5">
          <Tabs defaultValue="info">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
              <TabsTrigger value="team">Equipe</TabsTrigger>
              <TabsTrigger value="accounts">Acessos</TabsTrigger>
              <TabsTrigger value="assets">Ativos digitais</TabsTrigger>
              <TabsTrigger value="integrations">Integrações</TabsTrigger>
              <TabsTrigger value="portal">Painel do cliente</TabsTrigger>
              <TabsTrigger value="chat">Chat interno</TabsTrigger>
            </TabsList>
            <TabsContent value="info">
              <ChurnCard clientId={client.id} /><ExitDetails clientId={client.id} />
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
