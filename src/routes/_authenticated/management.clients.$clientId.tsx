import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Client } from "@/lib/clients";

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
import { TimelineTab } from "@/components/management/timeline-tab";
import { InternalChatTab } from "@/components/management/internal-chat-tab";
import { ClientFinanceTab } from "@/components/finance/client-finance-tab";

export const Route = createFileRoute("/_authenticated/management/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Cadastro do cliente · Gerência" },
      {
        name: "description",
        content:
          "Cadastro mestre do cliente: informações, serviços, equipe, documentos, acessos e histórico.",
      },
      { property: "og:title", content: "Cadastro do cliente · Gerência" },
      { property: "og:description", content: "Cadastro mestre completo do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const canEdit = hasRole("administrator") || hasRole("team");

  const { data: client, isLoading } = useQuery({
    queryKey: ["clients", clientId],
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
    (client as unknown as { journey_stage?: "closing" | "kickoff" | "onboarding" | "ongoing" | "renewal" | "offboarded" })
      .journey_stage ?? "closing";

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        to="/management/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Central de Clientes
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <ClientLogo path={client.logo_url} name={client.name} className="h-16 w-16" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro mestre · {client.segment || "Sem segmento"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="accounts">Acessos</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="chat">Chat Interno</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <OverviewTab client={client} />
          <JourneyCard clientId={client.id} currentStage={journeyStage} />
        </TabsContent>
        <TabsContent value="info" className="mt-6">
          <InfoTab client={client} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="services" className="mt-6">
          <ServicesTab clientId={client.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <TeamTab clientId={client.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-6">
          <AccountsTab clientId={client.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="finance" className="mt-6">
          <ClientFinanceTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <TimelineTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="chat" className="mt-6">
          <InternalChatTab clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
