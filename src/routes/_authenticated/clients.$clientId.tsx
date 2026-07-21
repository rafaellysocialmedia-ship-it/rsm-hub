import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MessageCircle,
  Building2,
  Calendar,
  Tag,
  User,
  FileText,
  Hash,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Client } from "@/lib/clients";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientLogo } from "@/components/clients/client-logo";
import { StatusBadge } from "@/components/clients/status-badge";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { PortalSettingsCard } from "@/components/clients/portal-settings-card";
import { JourneyCard } from "@/components/clients/journey-card";
import { ContractsCard } from "@/components/clients/contracts-card";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Cliente · Social Media Hub" }] }),
  component: ClientDetailPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">Erro ao carregar cliente</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/clients">Voltar</Link>
      </Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">Cliente não encontrado</h2>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/clients">Voltar para clientes</Link>
      </Button>
    </div>
  ),
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { hasRole } = useAuth();
  const canManage = hasRole("administrator") || hasRole("team");
  const canDelete = hasRole("administrator");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido");
      navigate({ to: "/clients" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!client) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">Cliente não encontrado</h2>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/clients">Voltar</Link>
        </Button>
      </div>
    );
  }

  function copyId() {
    navigator.clipboard.writeText(client!.id);
    toast.success("ID copiado");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Clientes
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ClientLogo path={client.logo_url} name={client.name} className="h-16 w-16" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              <StatusBadge status={client.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {client.legal_name ?? "Sem razão social"} · {client.segment ?? "Sem segmento"}
            </p>
            <button
              onClick={copyId}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted"
            >
              <Hash className="h-3 w-3" />
              {client.id}
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info icon={Building2} label="Razão Social" value={client.legal_name} />
            <Info icon={FileText} label="CNPJ" value={client.cnpj} />
            <Info icon={User} label="Responsável" value={client.responsible} />
            <Info icon={Tag} label="Segmento" value={client.segment} />
            <Info icon={Mail} label="Email" value={client.email} />
            <Info icon={Phone} label="Telefone" value={client.phone} />
            <Info icon={MessageCircle} label="WhatsApp" value={client.whatsapp} />
            <Info icon={Tag} label="Plano" value={client.plan} />
            <Info
              icon={Calendar}
              label="Data de início"
              value={
                client.start_date
                  ? new Date(client.start_date).toLocaleDateString("pt-BR")
                  : null
              }
            />
            <Info
              icon={Calendar}
              label="Cadastrado em"
              value={new Date(client.created_at).toLocaleDateString("pt-BR")}
            />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            {client.notes ? (
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{client.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
            )}
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              Use o ID acima para relacionar este cliente em outros módulos do sistema.
            </p>
          </CardContent>
        </Card>

        {canManage && <PortalSettingsCard clientId={client.id} />}
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. {client.name} será removido junto com seus dados
              associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}
