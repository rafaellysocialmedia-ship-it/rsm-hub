import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/empty-state";
import { CardsSkeleton, GridSkeleton, ListSkeleton, TableSkeleton } from "@/components/skeletons";
import { MeetingRecap } from "./meeting-recap";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Plus, ExternalLink, FileText, Layers, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccountFiles, useAccountMeetings } from "@/hooks/use-account-workspace";
import { localDate, safeExternalUrl } from "@/lib/account-workspace";
import { formatMoney } from "@/lib/client-master";
import { formatBytes, LIBRARY_BUCKET } from "@/lib/library";
import { postNetworks, statusMeta, POST_STATUS, matchesStageFilter, type Post } from "@/lib/posts";
import { PostBadges, useChangeReasons } from "@/components/posts/post-badges";
import type { Client } from "@/lib/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PostCreativeThumb } from "@/components/posts/post-creative-viewer";
import { PostDetailSheet } from "@/components/posts/post-detail-sheet";
import { PostEditorSheet } from "@/components/posts/post-editor-sheet";
import { MeetingDialog, type Meeting } from "@/components/meetings/meeting-dialog";

export function QueryState({
  loading,
  error,
  empty,
  skeleton = "list",
  emptyState,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  /** Formato do esqueleto enquanto carrega (igual ao da tela). */
  skeleton?: "list" | "cards" | "table" | "grid" | "block";
  /** O que mostrar quando não há itens; sem isso, um aviso genérico. */
  emptyState?: Parameters<typeof EmptyState>[0];
  children: React.ReactNode;
}) {
  if (loading)
    return (
      <div role="status" aria-label="Carregando">
        {skeleton === "cards" ? (
          <CardsSkeleton count={3} />
        ) : skeleton === "table" ? (
          <TableSkeleton rows={5} />
        ) : skeleton === "grid" ? (
          <GridSkeleton count={6} />
        ) : skeleton === "block" ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/70" />
        ) : (
          <ListSkeleton rows={4} />
        )}
      </div>
    );
  if (error)
    return (
      <p role="alert" className="rounded-xl border p-6 text-sm text-destructive">
        Não foi possível carregar estas informações. Atualize a página para tentar de novo.
      </p>
    );
  if (empty)
    return (
      <EmptyState
        compact
        {...(emptyState ?? {
          title: "Nada por aqui ainda",
          description: "Os itens aparecem aqui assim que forem cadastrados.",
        })}
      />
    );
  return <>{children}</>;
}
export function MetricCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold tracking-tight">{value}</strong>
    </>
  );
  return (
    <Card>
      {onClick ? (
        <button
          onClick={onClick}
          className="w-full p-5 text-left transition-colors hover:bg-primary/5"
        >
          {content}
        </button>
      ) : (
        <CardContent className="p-5">{content}</CardContent>
      )}
    </Card>
  );
}
export function useInternalPosts(clientId: string) {
  return useQuery({
    queryKey: ["posts", "client", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("client_id", clientId)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function AccountContents({
  client,
  approvalOnly = false,
  calendar = false,
  canEdit = false,
}: {
  client: Client;
  approvalOnly?: boolean;
  calendar?: boolean;
  canEdit?: boolean;
}) {
  const query = useInternalPosts(client.id);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [contentFormat, setContentFormat] = useState("all");
  const [network, setNetwork] = useState("all");
  const [detail, setDetail] = useState<Post | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const reasons = useChangeReasons();
  const posts = (query.data ?? []).filter(
    (p) =>
      (!approvalOnly || p.status === "review") &&
      (!month || p.scheduled_date?.startsWith(month)) &&
      matchesStageFilter(p.status, status) &&
      (contentFormat === "all" || p.format === contentFormat) &&
      (network === "all" || postNetworks(p).includes(network)) &&
      p.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-sm" htmlFor="content-search">
            Buscar conteúdo
          </label>
          <Input
            id="content-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Título"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="content-month">
            Mês
          </label>
          <Input
            id="content-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        {month && (
          <Button variant="ghost" onClick={() => setMonth("")}>
            Todos os meses
          </Button>
        )}
        <select
          aria-label="Etapa do conteúdo"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 max-w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todas as etapas</option>
          {POST_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Formato do conteúdo"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={contentFormat}
          onChange={(e) => setContentFormat(e.target.value)}
        >
          <option value="all">Todos os formatos</option>
          {[
            ...new Set((query.data ?? []).map((p) => p.format).filter((f): f is string => !!f)),
          ].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          aria-label="Plataforma do conteúdo"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
        >
          <option value="all">Todas as plataformas</option>
          {[...new Set((query.data ?? []).flatMap((p) => postNetworks(p)))].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar conteúdo
          </Button>
        )}
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={!posts.length}
        emptyState={{
          icon: Layers,
          title: "Nenhum conteúdo nesta conta",
          description: "As publicações planejadas para o cliente aparecem aqui.",
          actions: canEdit
            ? [{ label: "Adicionar conteúdo", onClick: () => { setEditing(null); setEditorOpen(true); } }]
            : [],
        }}
      >
        <div className={calendar ? "space-y-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
          {posts.map((p) => (
            <button
              key={p.id}
              className={`rounded-xl border bg-card text-left transition-colors hover:border-primary/50 ${calendar ? "flex flex-wrap items-center gap-4 p-4" : "overflow-hidden"}`}
              onClick={() => setDetail(p)}
            >
              {!calendar && <PostCreativeThumb postId={p.id} />}
              <div className={calendar ? "min-w-0 flex-1" : "space-y-3 p-4"}>
                <p className="font-medium">{p.title}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>
                    {p.scheduled_date
                      ? new Date(p.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")
                      : "Data a definir"}
                    {p.scheduled_time && ` · ${p.scheduled_time.slice(0, 5)}`}
                  </span>
                  <span>{postNetworks(p).join(" · ")}</span>
                  <span>{p.format}</span>
                </div>
                <Badge variant="outline" className={`mt-2 ${statusMeta(p.status).tone}`}>
                  {p.status === "review" ? "Aguardando aprovação" : statusMeta(p.status).label}
                </Badge>
                <PostBadges post={p} reason={reasons.data?.get(p.id)} showReason className="mt-2" />
              </div>
            </button>
          ))}
        </div>
      </QueryState>
      <PostDetailSheet
        post={detail}
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        clientName={client.name}
        onEdit={
          canEdit
            ? (p) => {
                setDetail(null);
                setEditing(p);
                setEditorOpen(true);
              }
            : undefined
        }
      />
      {canEdit && (
        <PostEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          post={editing}
          initial={{ client_id: client.id }}
          clients={[client]}
        />
      )}
    </div>
  );
}
export function AccountMeetings({
  clientId,
  clientName,
  canEdit = false,
}: {
  clientId: string;
  clientName: string;
  canEdit?: boolean;
}) {
  const query = useAccountMeetings(clientId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const meetings = [...(query.data ?? [])].sort((a, b) => {
    const upcomingA = a.status === "scheduled" && a.meeting_date >= localDate();
    const upcomingB = b.status === "scheduled" && b.meeting_date >= localDate();
    return upcomingA !== upcomingB
      ? upcomingA
        ? -1
        : 1
      : upcomingA
        ? a.meeting_date.localeCompare(b.meeting_date)
        : b.meeting_date.localeCompare(a.meeting_date);
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reuniões</h2>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agendar reunião
          </Button>
        )}
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={!meetings.length}
        emptyState={{
          icon: Calendar,
          title: "Nenhuma reunião registrada",
          description: "Reuniões agendadas e as já feitas com o cliente aparecem aqui.",
          actions: canEdit
            ? [{ label: "Agendar reunião", onClick: () => { setEditing(null); setOpen(true); } }]
            : [],
        }}
      >
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Video className="h-4 w-4 text-primary" />
                    {m.title}
                  </h3>
                  <Badge variant="secondary">
                    {{ scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada" }[
                      m.status
                    ] ?? m.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(m.meeting_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  {m.meeting_time && ` · ${m.meeting_time.slice(0, 5)}`} · {m.duration_minutes} min
                </p>
                {m.status === "completed" && <MeetingRecap meetingId={m.id} canEdit={canEdit} />}
                {m.description && <p className="whitespace-pre-wrap text-sm">{m.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {safeExternalUrl(m.meeting_url) && m.status === "scheduled" && (
                    <Button asChild variant="outline">
                      <a
                        href={safeExternalUrl(m.meeting_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Acessar reunião
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(m as Meeting);
                        setOpen(true);
                      }}
                    >
                      Editar / registrar resumo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>
      {canEdit && (
        <MeetingDialog
          open={open}
          onOpenChange={setOpen}
          meeting={editing}
          clients={[{ id: clientId, name: clientName }]}
          defaultClientId={clientId}
        />
      )}
    </div>
  );
}
export function AccountFiles({
  clientId,
  reportsOnly = false,
}: {
  clientId: string;
  reportsOnly?: boolean;
}) {
  const query = useAccountFiles(clientId);
  const { hasRole } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const files = (query.data ?? []).filter((f) => !reportsOnly || f.category === "relatorios");
  const [downloading, setDownloading] = useState<string | null>(null);
  async function download(path: string, id: string) {
    setDownloading(id);
    try {
      const { data, error } = await supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    } finally {
      setDownloading(null);
    }
  }
  return (
    <QueryState
      loading={query.isLoading}
      error={query.error}
      empty={!files.length}
      emptyState={{
        icon: FileText,
        title: reportsOnly ? "Nenhum arquivo de relatório" : "Nenhum arquivo enviado",
        description: reportsOnly
          ? "Relatórios em PDF enviados para o cliente aparecem aqui."
          : "Contratos, logos e materiais do cliente aparecem aqui.",
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {files.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                {staff && (
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={f.is_shared}
                      onChange={async (e) => {
                        const { error } = await supabase
                          .from("files")
                          .update({ is_shared: e.target.checked })
                          .eq("id", f.id);
                        if (error) toast.error("Não foi possível alterar a visibilidade.");
                        else {
                          void query.refetch();
                          toast.success("Visibilidade atualizada");
                        }
                      }}
                    />
                    Visível no portal
                  </label>
                )}
                <p className="text-sm text-muted-foreground">
                  {formatBytes(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={downloading === f.id}
                onClick={() => void download(f.storage_path, f.id)}
              >
                Abrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </QueryState>
  );
}
