import { matchesClients, selectedClients } from "@/lib/calendar-period";
import { usePostWorkspace } from "@/components/posts/post-workspace";
import { ContentFilters } from "@/components/posts/content-filters";
import { ClientCalendarPage } from "@/components/workspace/client-calendar";
import { isActiveClient, belongsToActiveClient } from "@/lib/active-clients";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  KanbanSquare,
  List as ListIcon,
  GanttChart,
  Table2,
  Plus,
  Filter,
  X,
  Download,
  Send,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { POST_STATUS, SOCIAL_NETWORKS, type Post, type PostStatus } from "@/lib/posts";
import type { Client } from "@/lib/clients";
import { useAuth } from "@/hooks/use-auth";

// Visualizações carregam sob demanda — só a que o usuário abre entra no bundle.
const KanbanView = lazy(() =>
  import("@/components/posts/views/kanban-view").then((m) => ({ default: m.KanbanView })),
);
const CalendarView = lazy(() =>
  import("@/components/posts/views/calendar-view").then((m) => ({ default: m.CalendarView })),
);
const ListView = lazy(() =>
  import("@/components/posts/views/list-view").then((m) => ({ default: m.ListView })),
);
const TableView = lazy(() =>
  import("@/components/posts/views/table-view").then((m) => ({ default: m.TableView })),
);
const TimelineView = lazy(() =>
  import("@/components/posts/views/timeline-view").then((m) => ({ default: m.TimelineView })),
);

import { PostEditorSheet } from "@/components/posts/post-editor-sheet";
import { PostDetailSheet } from "@/components/posts/post-detail-sheet";
import { PostBalanceControlBar } from "@/components/posts/post-balance-control-bar";
import { formatMonth } from "@/lib/post-quota";
import { exportCalendarXlsx } from "@/lib/export-calendar";
import { CalendarSkeleton, ListSkeleton, TableSkeleton } from "@/components/skeletons";
import { useStickyState } from "@/hooks/use-sticky-state";

export const Route = createFileRoute("/_authenticated/posts/")({
  validateSearch: (s: Record<string, unknown>) => ({
    ...s,
    view: ["calendar", "list", "kanban", "timeline", "table"].includes(String(s.view))
      ? String(s.view)
      : "calendar",
  }),
  head: () => ({
    meta: [
      { title: "Calendário Editorial · RSM Gestão de Marketing" },
      {
        name: "description",
        content: "Planeje, organize e publique seu conteúdo em todas as redes.",
      },
    ],
  }),
  component: PostsPage,
});

type ViewMode = "calendar" | "list" | "kanban" | "timeline" | "table";

function PostsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const workspace = usePostWorkspace();
  // Filtros e visualização são preservados ao sair e voltar para a tela.
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setView = (value: ViewMode) =>
    void navigate({ search: (old) => ({ ...old, view: value }), replace: true });
  const [search, setSearch] = useStickyState<string>(`posts:${user?.id}:search`, "");
  const [statusFilter, setStatusFilter] = useStickyState<PostStatus | "all">(
    `posts:${user?.id}:status`,
    "all",
  );
  const [clientFilter, setClientFilter] = useStickyState<string>(`posts:${user?.id}:client`, "all");
  const [networkFilter, setNetworkFilter] = useStickyState<string>(
    `posts:${user?.id}:network`,
    "all",
  );
  const [formatFilter, setFormatFilter] = useStickyState<string>(`posts:${user?.id}:format`, "all");
  const [ownerFilter, setOwnerFilter] = useStickyState<string>(`posts:${user?.id}:owner`, "all");
  const owners = useQuery({
    queryKey: ["post-responsibles"],
    queryFn: async () => {
      const [tasks, people] = await Promise.all([
        supabase.from("tasks").select("source_post_id,assignee_id"),
        supabase.from("profiles").select("id,name"),
      ]);
      if (tasks.error) throw tasks.error;
      if (people.error) throw people.error;
      return { tasks: tasks.data, people: people.data };
    },
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [initial, setInitial] = useState<Partial<Post> | undefined>(undefined);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  // Visualização completa (leitura) — abre antes do editor
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Mês exibido no calendário — a contagem de cota acompanha esse mês
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const handleMonthChange = useCallback((m: Date) => setCalendarMonth(m), []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const clients = useMemo(() => allClients.filter(isActiveClient), [allClients]);
  const activeIds = useMemo(() => new Set(clients.map((c) => c.id)), [clients]);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  // Saldo mensal (inclui o que ficou faltando do mês anterior)

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("posts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () =>
        qc.invalidateQueries({ queryKey: ["clients"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () =>
        qc.invalidateQueries({ queryKey: ["posts"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Auto-open editor when ?open=<post_id> is in URL or when a notification
  // stored a pending post in sessionStorage (survives client-side navigation).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const openFromUrl = () => {
      if (posts.length === 0) return;
      const params = new URLSearchParams(window.location.search);
      let openId = params.get("open");
      let commentId = params.get("comment") ?? (params.get("comments") ? "last" : null);

      if (!openId) {
        const pending = sessionStorage.getItem("pending-open-post");
        if (pending) {
          try {
            const parsed = JSON.parse(pending) as { id: string; comment: string | null };
            openId = parsed.id;
            commentId = parsed.comment ?? null;
          } catch {
            /* ignore malformed payload */
          }
        }
      }
      if (!openId) return;
      sessionStorage.removeItem("pending-open-post");
      const target = posts.find((p) => p.id === openId);
      if (!target) return;
      setDetailPost(target);
      setFocusedCommentId(commentId);
      setDetailOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("open");
      url.searchParams.delete("comment");
      url.searchParams.delete("comments");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    };
    openFromUrl();
    window.addEventListener("notification:navigate", openFromUrl);
    return () => window.removeEventListener("notification:navigate", openFromUrl);
  }, [posts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (!belongsToActiveClient(p, activeIds)) return false;
      if (formatFilter !== "all" && p.format !== formatFilter) return false;
      if (
        ownerFilter !== "all" &&
        !owners.data?.tasks.some((t) => t.source_post_id === p.id && t.assignee_id === ownerFilter)
      )
        return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!matchesClients(clientFilter, p.client_id)) return false;
      if (networkFilter !== "all") {
        const nets = (p as { social_networks?: string[] | null }).social_networks ?? [];
        const all = nets.length ? nets : p.social_network ? [p.social_network] : [];
        if (!all.includes(networkFilter)) return false;
      }
      if (q) {
        const hay = [p.title, p.headline, p.caption, p.theme, p.pillar, p.hashtags, p.cta]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    posts,
    search,
    statusFilter,
    clientFilter,
    networkFilter,
    activeIds,
    formatFilter,
    ownerFilter,
    owners.data,
  ]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PostStatus }) => {
      const { error } = await supabase.from("posts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueryData<Post[]>(["posts"]);
      qc.setQueryData<Post[]>(["posts"], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, status } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
      toast.error("Falha ao mover");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const bulkReview = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("posts")
        .update({ status: "review" as PostStatus })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(
        `${ids.length} publicaç${ids.length === 1 ? "ão enviada" : "ões enviadas"} para revisão`,
      );
      clearSelection();
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => toast.error("Falha ao enviar para revisão"),
  });

  const updateDate = useMutation({
    mutationFn: async ({ id, scheduled_date }: { id: string; scheduled_date: string }) => {
      const { error } = await supabase.from("posts").update({ scheduled_date }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, scheduled_date }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueryData<Post[]>(["posts"]);
      qc.setQueryData<Post[]>(["posts"], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, scheduled_date } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
      toast.error("Falha ao mover");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const openNew = (init?: Partial<Post>) =>
    workspace.createPost({
      client_id: selectedClients(clientFilter).length === 1 ? clientFilter : null,
      ...init,
    });
  const openExisting = (p: Post) => {
    setDetailPost(p);
    setFocusedCommentId(null);
    setDetailOpen(true);
  };
  const editFromDetail = (p: Post) => {
    setDetailOpen(false);
    workspace.openPost(p);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendário editorial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planeje, produza e publique em todas as redes — atualizado em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const clientName =
                clientFilter !== "all"
                  ? (clientMap.get(clientFilter) ?? "cliente")
                  : "todos-clientes";
              const stamp = new Date().toISOString().slice(0, 10);
              exportCalendarXlsx(filtered, clientMap, `calendario-${clientName}-${stamp}`);
              toast.success(`${filtered.length} publicações exportadas`);
            }}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
          <Button disabled={!workspace.canCreate} onClick={() => openNew()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova publicação
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
        <Tabs
          className="border-b border-border/50 pb-2"
          value={view}
          onValueChange={(v) => setView(v as ViewMode)}
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
            <TabsTrigger value="calendar" className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 text-xs">
              <ListIcon className="h-3.5 w-3.5" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5 text-xs">
              <KanbanSquare className="h-3.5 w-3.5" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs">
              <GanttChart className="h-3.5 w-3.5" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5 text-xs">
              <Table2 className="h-3.5 w-3.5" />
              Tabela
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ContentFilters
          search={search}
          onSearch={setSearch}
          filters={[
            {
              key: "client",
              label: "Clientes",
              multiple: true,
              value: clientFilter,
              empty: "all",
              primary: true,
              onChange: setClientFilter,
              options: clients.map((c) => ({ value: c.id, label: c.name })),
            },
            {
              key: "status",
              label: "Status",
              value: statusFilter,
              empty: "all",
              primary: true,
              onChange: (v) => setStatusFilter(v as PostStatus | "all"),
              options: POST_STATUS.map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: "channel",
              label: "Canal",
              value: networkFilter,
              empty: "all",
              onChange: setNetworkFilter,
              options: SOCIAL_NETWORKS.map((n) => ({ value: n, label: n })),
            },
            {
              key: "format",
              label: "Formato",
              value: formatFilter,
              empty: "all",
              onChange: setFormatFilter,
              options: [...new Set(posts.map((p) => p.format).filter((f): f is string => !!f))].map(
                (f) => ({ value: f, label: f }),
              ),
            },
            {
              key: "owner",
              label: "Responsável",
              value: ownerFilter,
              empty: "all",
              onChange: setOwnerFilter,
              loading: owners.isLoading,
              error: !!owners.error,
              options:
                owners.data?.people
                  .filter((p) => owners.data.tasks.some((t) => t.assignee_id === p.id))
                  .map((p) => ({ value: p.id, label: p.name ?? "Sem nome" })) ?? [],
            },
          ]}
        />
      </div>

      {/* Calendar balance control bar — tied to the displayed month and selected client */}
      {view === "calendar" && selectedClients(clientFilter).length === 1 && (
        <PostBalanceControlBar clientId={clientFilter} ref={calendarMonth} />
      )}

      {/* Result count + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          {isLoading
            ? "Carregando..."
            : `${filtered.length} publicação${filtered.length === 1 ? "" : "ões"}`}
        </div>
        {view === "list" && selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 shadow-soft">
            <span className="flex items-center gap-1.5 pl-1 text-xs font-medium">
              <CheckSquare className="h-3.5 w-3.5" /> {selected.size} selecionada
              {selected.size === 1 ? "" : "s"}
            </span>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => bulkReview.mutate(Array.from(selected))}
              disabled={bulkReview.isPending}
            >
              <Send className="h-3 w-3" /> Enviar para revisão
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={clearSelection}
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Views */}
      <div>
        {isLoading ? (
          view === "calendar" ? (
            <CalendarSkeleton />
          ) : view === "table" ? (
            <TableSkeleton />
          ) : (
            <ListSkeleton rows={7} />
          )
        ) : (
          <Suspense
            fallback={
              view === "calendar" ? (
                <CalendarSkeleton />
              ) : view === "table" ? (
                <TableSkeleton />
              ) : (
                <ListSkeleton rows={7} />
              )
            }
          >
            {view === "calendar" && (
              <ClientCalendarPage
                providedPosts={filtered}
                onMonthChange={handleMonthChange}
                defaultClientId={
                  selectedClients(clientFilter).length === 1 ? clientFilter : undefined
                }
              />
            )}
            {view === "list" && (
              <ListView
                posts={filtered}
                clientMap={clientMap}
                onOpen={openExisting}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            )}
            {view === "kanban" && (
              <KanbanView
                posts={filtered}
                clientMap={clientMap}
                onOpen={openExisting}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                onAdd={(status) => openNew({ status })}
              />
            )}
            {view === "timeline" && (
              <TimelineView posts={filtered} clientMap={clientMap} onOpen={openExisting} />
            )}
            {view === "table" && (
              <TableView posts={filtered} clientMap={clientMap} onOpen={openExisting} />
            )}
          </Suspense>
        )}
      </div>

      {detailPost && (
        <PostDetailSheet
          post={detailPost}
          open={detailOpen}
          onOpenChange={(o) => {
            setDetailOpen(o);
            if (!o) setFocusedCommentId(null);
          }}
          clientName={detailPost.client_id ? (clientMap.get(detailPost.client_id) ?? null) : null}
          onEdit={editFromDetail}
          focusedCommentId={focusedCommentId}
        />
      )}

      <PostEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        post={editing}
        initial={initial}
        clients={clients}
        focusedCommentId={null}
      />
    </div>
  );
}
