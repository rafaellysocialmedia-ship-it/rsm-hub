import { ClientWorkspace } from "@/components/workspace/client-workspace";
import { ClientPortal } from "@/components/workspace/client-approvals";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  Clock,
  Calendar,
  Sparkles,
  Search,
  Loader2,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  POST_STATUS,
  statusMeta,
  postNetworks,
  type Post,
  type PostComment,
  type PostStatus,
} from "@/lib/posts";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Database } from "@/integrations/supabase/types";
import { PostEditorSheet } from "@/components/posts/post-editor-sheet";
import type { Client as ClientData } from "@/lib/clients";
import { PostCreativeThumb, PostCreativeGallery } from "@/components/posts/post-creative-viewer";
import { GridSkeleton } from "@/components/skeletons";
import { PostDetailSheet } from "@/components/posts/post-detail-sheet";

type Approval = Database["public"]["Tables"]["post_approvals"]["Row"];
type Decision = Database["public"]["Enums"]["approval_decision"];
type Client = Database["public"]["Tables"]["clients"]["Row"];

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [
      { title: "Aprovações · Social Media Hub" },
      { name: "description", content: "Acompanhe e aprove suas publicações em um único lugar." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tab?: string; request?: string } => ({
    ...s,
    request: s.request === "content" ? "content" : undefined,
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  component: PortalRouter,
});

const DECISION_META: Record<Decision, { label: string; tone: string; icon: typeof CheckCircle2 }> =
  {
    pending: {
      label: "Pendente",
      tone: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      icon: Clock,
    },
    approved: {
      label: "Aprovado",
      tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      icon: CheckCircle2,
    },
    rejected: {
      label: "Rejeitado",
      tone: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      icon: XCircle,
    },
    changes_requested: {
      label: "Ajustes",
      tone: "bg-red-500/10 text-red-600 border-red-500/20",
      icon: MessageSquareWarning,
    },
  };

function PortalRouter() {
  const { hasRole, loading } = useAuth();
  if (loading)
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  const isStaff = hasRole("administrator") || hasRole("team");
  return isStaff ? (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <ClientPortal />
    </div>
  ) : (
    <ClientWorkspace />
  );
}

/* ---------------- STAFF VIEW ---------------- */

function StaffApprovals() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Decision | "all">("pending");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["staff-approvals-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .in("status", [
          "review",
          "changes_requested",
          "approved",
          "to_schedule",
          "scheduled",
          "published",
          "rejected",
          "archived",
        ])
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["staff-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("post_approvals").select("*");
      if (error) throw error;
      return data as Approval[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as ClientData[];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: PostStatus }) => {
      const { error } = await supabase.from("posts").update({ status }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["staff-approvals-posts"] });
      qc.invalidateQueries({ queryKey: ["staff-approvals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const ch = supabase
      .channel("staff-approvals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_approvals" }, () => {
        qc.invalidateQueries({ queryKey: ["staff-approvals"] });
        qc.invalidateQueries({ queryKey: ["staff-approvals-posts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const approvalByPost = useMemo(() => {
    const m = new Map<string, Approval>();
    approvals.forEach((a) => m.set(a.post_id, a));
    return m;
  }, [approvals]);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  function decisionOf(p: Post): Decision {
    if (p.status === "review") return "pending";
    if (p.status === "changes_requested") return "changes_requested";
    const ap = approvalByPost.get(p.id);
    if (ap) return ap.decision;
    // Fallback derived from post status when there's no approval row
    if (
      p.status === "approved" ||
      p.status === "to_schedule" ||
      p.status === "scheduled" ||
      p.status === "published"
    )
      return "approved";

    if ((p.status as string) === "rejected" || p.status === "archived") return "rejected";
    return "pending";
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return posts.filter((p) => {
      const d = decisionOf(p);
      if (tab !== "all" && d !== tab) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (!q) return true;
      return [p.title, p.headline, p.theme].some((v) => v?.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, search, tab, clientFilter, approvalByPost]);

  const counts = useMemo(() => {
    const c: Record<Decision | "all", number> = {
      all: posts.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      changes_requested: 0,
    };
    posts.forEach((p) => {
      const d = decisionOf(p);
      c[d] = (c[d] ?? 0) + 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, approvalByPost]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Aprovações
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Fila de aprovação dos clientes</h1>
        <p className="text-sm text-muted-foreground">
          Todos os posts em revisão ou aprovados. Você recebe notificação sempre que um cliente
          decide.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["pending", "approved", "changes_requested", "rejected"] as Decision[]).map((d) => {
          const meta = DECISION_META[d];
          const Icon = meta.icon;
          return (
            <Card key={d} className="border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-2xl font-semibold">{counts[d]}</p>
                </div>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-md border ${meta.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Decision | "all")}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="changes_requested">
              Ajustes ({counts.changes_requested})
            </TabsTrigger>
            <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">Todos clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {postsLoading ? (
        <GridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum post nessa fila</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const ap = approvalByPost.get(p.id);
            const decision: Decision = decisionOf(p);
            const dMeta = DECISION_META[decision];
            const sMeta = statusMeta(p.status);
            const clientName = p.client_id ? clientMap.get(p.client_id) : null;
            return (
              <Card
                key={p.id}
                onClick={() => setDetailPost(p)}
                className="cursor-pointer border-border/60 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-base">{p.title}</CardTitle>
                    <Badge variant="outline" className={dMeta.tone}>
                      {dMeta.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    {clientName && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        {clientName}
                      </span>
                    )}
                    {postNetworks(p).map((n) => (
                      <span key={n} className="rounded bg-muted px-1.5 py-0.5">
                        {n}
                      </span>
                    ))}
                    <Badge variant="outline" className={sMeta.tone}>
                      {sMeta.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {p.headline && <p className="line-clamp-2 text-sm">{p.headline}</p>}
                  {p.scheduled_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(p.scheduled_date).toLocaleDateString("pt-BR")}
                      {p.scheduled_time && ` · ${p.scheduled_time.slice(0, 5)}`}
                    </div>
                  )}
                  {ap?.feedback && (
                    <div className="rounded-md border bg-muted/30 p-2 text-xs">
                      <p className="mb-0.5 font-medium">Feedback do cliente</p>
                      <p className="text-muted-foreground">{ap.feedback}</p>
                    </div>
                  )}
                  <div
                    className="flex items-center gap-2 pt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={p.status}
                      onValueChange={(v) =>
                        statusMutation.mutate({ postId: p.id, status: v as PostStatus })
                      }
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POST_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => setEditingPost(p)}
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PostDetailSheet
        post={detailPost}
        open={!!detailPost}
        onOpenChange={(o) => {
          if (!o) setDetailPost(null);
        }}
        clientName={detailPost?.client_id ? (clientMap.get(detailPost.client_id) ?? null) : null}
        onEdit={(p) => {
          setDetailPost(null);
          setEditingPost(p);
        }}
      />

      <PostEditorSheet
        open={!!editingPost}
        onOpenChange={(o) => {
          if (!o) setEditingPost(null);
        }}
        post={editingPost}
        clients={clients}
      />
    </div>
  );
}
