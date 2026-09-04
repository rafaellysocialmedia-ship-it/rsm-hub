import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, KanbanSquare, List as ListIcon, GanttChart, Table2, Plus, Search, Filter, X, Download, Send, CheckSquare,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  POST_STATUS, SOCIAL_NETWORKS, type Post, type PostStatus,
} from "@/lib/posts";
import type { Client } from "@/lib/clients";

// Visualizações carregam sob demanda — só a que o usuário abre entra no bundle.
const KanbanView = lazy(() => import("@/components/posts/views/kanban-view").then((m) => ({ default: m.KanbanView })));
const CalendarView = lazy(() => import("@/components/posts/views/calendar-view").then((m) => ({ default: m.CalendarView })));
const ListView = lazy(() => import("@/components/posts/views/list-view").then((m) => ({ default: m.ListView })));
const TableView = lazy(() => import("@/components/posts/views/table-view").then((m) => ({ default: m.TableView })));
const TimelineView = lazy(() => import("@/components/posts/views/timeline-view").then((m) => ({ default: m.TimelineView })));

import { PostEditorSheet } from "@/components/posts/post-editor-sheet";
const PostDetailSheet = lazy(() => import("@/components/posts/post-detail-sheet").then((m) => ({ default: m.PostDetailSheet })));
import { formatMonth } from "@/lib/post-quota";
import { exportCalendarXlsx } from "@/lib/export-calendar";
import { CalendarSkeleton, ListSkeleton, TableSkeleton } from "@/components/skeletons";
import { useStickyState } from "@/hooks/use-sticky-state";


export const Route = createFileRoute("/_authenticated/posts/")({
  head: () => ({
    meta: [
      { title: "Calendário Editorial · Social Media Hub" },
      { name: "description", content: "Planeje, organize e publique seu conteúdo em todas as redes." },
    ],
  }),
  component: PostsPage,
});

type ViewMode = "calendar" | "list" | "kanban" | "timeline" | "table";

function PostsPage() {
  const qc = useQueryClient();
  // Filtros e visualização são preservados ao sair e voltar para a tela.
  const [view, setView] = useStickyState<ViewMode>("posts:view", "calendar");
  const [search, setSearch] = useStickyState<string>("posts:search", "");
  const [statusFilter, setStatusFilter] = useStickyState<PostStatus | "all">("posts:status", "all");
  const [clientFilter, setClientFilter] = useStickyState<string>("posts:client", "all");
  const [networkFilter, setNetworkFilter] = useStickyState<string>("posts:network", "all");
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  // Saldo mensal (inclui o que ficou faltando do mês anterior)

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("posts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () =>
        qc.invalidateQueries({ queryKey: ["posts"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
          } catch { /* ignore malformed payload */ }
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
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (networkFilter !== "all") {
        const nets = ((p as { social_networks?: string[] | null }).social_networks ?? []);
        const all = nets.length ? nets : (p.social_network ? [p.social_network] : []);
        if (!all.includes(networkFilter)) return false;
      }
      if (q) {
        const hay = [p.title, p.headline, p.caption, p.theme, p.pillar, p.hashtags, p.cta]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, search, statusFilter, clientFilter, networkFilter]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PostStatus }) => {
      const { error } = await supabase.from("posts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueryData<Post[]>(["posts"]);
      qc.setQueryData<Post[]>(["posts"], (old) => (old ?? []).map((p) => p.id === id ? { ...p, status } : p));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev); toast.error("Falha ao mover"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const bulkReview = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("posts").update({ status: "review" as PostStatus }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} publicaç${ids.length === 1 ? "ão enviada" : "ões enviadas"} para revisão`);
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
      qc.setQueryData<Post[]>(["posts"], (old) => (old ?? []).map((p) => p.id === id ? { ...p, scheduled_date } : p));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev); toast.error("Falha ao mover"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  const openNew = (init?: Partial<Post>) => {
    setEditing(null);
    setInitial(init);
    setFocusedCommentId(null);
    setEditorOpen(true);
  };
  const openExisting = (p: Post) => {
    setDetailPost(p);
    setFocusedCommentId(null);
    setDetailOpen(true);
  };
  const editFromDetail = (p: Post) => {
    setDetailOpen(false);
    setEditing(p);
    setInitial(undefined);
    setEditorOpen(true);
  };

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) + (clientFilter !== "all" ? 1 : 0) + (networkFilter !== "all" ? 1 : 0);

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
              const clientName = clientFilter !== "all" ? clientMap.get(clientFilter) ?? "cliente" : "todos-clientes";
              const stamp = new Date().toISOString().slice(0, 10);
              exportCalendarXlsx(filtered, clientMap, `calendario-${clientName}-${stamp}`);
              toast.success(`${filtered.length} publicações exportadas`);
            }}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
          <Button onClick={() => openNew()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova publicação
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-soft lg:flex-row lg:items-center">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList className="h-9">
            <TabsTrigger value="calendar" className="gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" />Calendário</TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 text-xs"><ListIcon className="h-3.5 w-3.5" />Lista</TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5 text-xs"><KanbanSquare className="h-3.5 w-3.5" />Kanban</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs"><GanttChart className="h-3.5 w-3.5" />Timeline</TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5 text-xs"><Table2 className="h-3.5 w-3.5" />Tabela</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar publicações..."
              className="h-9 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PostStatus | "all")}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {POST_STATUS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos clientes</SelectItem>
              {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Rede" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas redes</SelectItem>
              {SOCIAL_NETWORKS.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 gap-1 text-xs"
              onClick={() => { setStatusFilter("all"); setClientFilter("all"); setNetworkFilter("all"); }}
            >
              <X className="h-3 w-3" /> Limpar
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{activeFilters}</Badge>
            </Button>
          )}
        </div>
      </div>





      {/* Result count + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          {isLoading ? "Carregando..." : `${filtered.length} publicação${filtered.length === 1 ? "" : "ões"}`}
        </div>
        {view === "list" && selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 shadow-soft">
            <span className="flex items-center gap-1.5 pl-1 text-xs font-medium">
              <CheckSquare className="h-3.5 w-3.5" /> {selected.size} selecionada{selected.size === 1 ? "" : "s"}
            </span>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => bulkReview.mutate(Array.from(selected))}
              disabled={bulkReview.isPending}
            >
              <Send className="h-3 w-3" /> Enviar para revisão
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={clearSelection}>
              <X className="h-3 w-3" /> Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Views */}
      <div>
        {isLoading ? (
          view === "calendar" ? <CalendarSkeleton /> : view === "table" ? <TableSkeleton /> : <ListSkeleton rows={7} />
        ) : (
          <Suspense
            fallback={
              view === "calendar" ? <CalendarSkeleton /> : view === "table" ? <TableSkeleton /> : <ListSkeleton rows={7} />
            }
          >
            {view === "calendar" && (
              <CalendarView
                posts={filtered}
                clientMap={clientMap}
                onOpen={openExisting}
                onAddOn={(iso) => openNew({ scheduled_date: iso })}
                onMove={(id, iso) => updateDate.mutate({ id, scheduled_date: iso })}
                onMonthChange={handleMonthChange}
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
            {view === "timeline" && <TimelineView posts={filtered} clientMap={clientMap} onOpen={openExisting} />}
            {view === "table" && <TableView posts={filtered} clientMap={clientMap} onOpen={openExisting} />}
          </Suspense>
        )}
      </div>


      <Suspense fallback={null}>
        {detailPost && (
          <PostDetailSheet
            post={detailPost}
            open={detailOpen}
            onOpenChange={(o) => { setDetailOpen(o); if (!o) setFocusedCommentId(null); }}
            clientName={detailPost.client_id ? clientMap.get(detailPost.client_id) ?? null : null}
            onEdit={editFromDetail}
            focusedCommentId={focusedCommentId}
          />
        )}
      </Suspense>

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
