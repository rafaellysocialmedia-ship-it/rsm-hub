import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, MessageSquareWarning, Clock, Calendar, Sparkles, Search, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { POST_STATUS, statusMeta, postNetworks, type Post, type PostComment, type PostStatus } from "@/lib/posts";
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
  component: PortalRouter,
});

const DECISION_META: Record<Decision, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pendente", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  approved: { label: "Aprovado", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", tone: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: XCircle },
  changes_requested: { label: "Ajustes", tone: "bg-red-500/10 text-red-600 border-red-500/20", icon: MessageSquareWarning },
};

function PortalRouter() {
  const { hasRole, loading } = useAuth();
  if (loading) return <div className="flex flex-1 items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const isStaff = hasRole("administrator") || hasRole("team");
  return isStaff ? <StaffApprovals /> : <ClientPortal />;
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
        .from("posts").select("*")
        .in("status", ["review", "changes_requested", "approved", "to_schedule", "scheduled", "published", "rejected", "archived"])
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
    const ch = supabase.channel("staff-approvals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_approvals" }, () => {
        qc.invalidateQueries({ queryKey: ["staff-approvals"] });
        qc.invalidateQueries({ queryKey: ["staff-approvals-posts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const approvalByPost = useMemo(() => {
    const m = new Map<string, Approval>();
    approvals.forEach((a) => m.set(a.post_id, a));
    return m;
  }, [approvals]);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  function decisionOf(p: Post): Decision {
    const ap = approvalByPost.get(p.id);
    if (ap) return ap.decision;
    // Fallback derived from post status when there's no approval row
    if (p.status === "approved" || p.status === "to_schedule" || p.status === "scheduled" || p.status === "published") return "approved";
    if (p.status === "changes_requested") return "changes_requested";
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
    const c: Record<Decision | "all", number> = { all: posts.length, pending: 0, approved: 0, rejected: 0, changes_requested: 0 };
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
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aprovações</span>
        <h1 className="text-2xl font-semibold tracking-tight">Fila de aprovação dos clientes</h1>
        <p className="text-sm text-muted-foreground">
          Todos os posts em revisão ou aprovados. Você recebe notificação sempre que um cliente decide.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["pending","approved","changes_requested","rejected"] as Decision[]).map((d) => {
          const meta = DECISION_META[d]; const Icon = meta.icon;
          return (
            <Card key={d} className="border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div><p className="text-xs text-muted-foreground">{meta.label}</p><p className="text-2xl font-semibold">{counts[d]}</p></div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${meta.tone}`}><Icon className="h-4 w-4" /></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Decision | "all")}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="changes_requested">Ajustes ({counts.changes_requested})</TabsTrigger>
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
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8" />
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
                    <Badge variant="outline" className={dMeta.tone}>{dMeta.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    {clientName && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{clientName}</span>}
                    {postNetworks(p).map((n) => <span key={n} className="rounded bg-muted px-1.5 py-0.5">{n}</span>)}
                    <Badge variant="outline" className={sMeta.tone}>{sMeta.label}</Badge>
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
                  <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={p.status}
                      onValueChange={(v) => statusMutation.mutate({ postId: p.id, status: v as PostStatus })}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {POST_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditingPost(p)}>
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
        onOpenChange={(o) => { if (!o) setDetailPost(null); }}
        clientName={detailPost?.client_id ? clientMap.get(detailPost.client_id) ?? null : null}
        onEdit={(p) => { setDetailPost(null); setEditingPost(p); }}
      />

      <PostEditorSheet
        open={!!editingPost}
        onOpenChange={(o) => { if (!o) setEditingPost(null); }}
        post={editingPost}
        clients={clients}
      />
    </div>
  );
}

/* ---------------- CLIENT VIEW ---------------- */

function ClientPortal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Decision | "all">("pending");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [feedback, setFeedback] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  const { data: client } = useQuery({
    queryKey: ["portal-client", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });

  const { data: posts = [], refetch: refetchPosts } = useQuery({
    queryKey: ["portal-posts", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts").select("*")
        .eq("client_id", client!.id)
        .in("status", ["review", "changes_requested", "approved", "to_schedule", "scheduled", "published"])
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: approvals = [], refetch: refetchAppr } = useQuery({
    queryKey: ["portal-approvals", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("post_approvals").select("*").eq("client_id", client!.id);
      if (error) throw error;
      return data as Approval[];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["portal-post-comments", openPost?.id],
    enabled: !!openPost?.id,
    queryFn: async () => {
      if (!openPost?.id) return [] as PostComment[];
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", openPost.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PostComment[];
    },
  });

  const commentAuthorIds = Array.from(new Set(comments.map((c) => c.author_id).filter(Boolean)));
  const { data: commentAuthors = [] } = useQuery({
    queryKey: ["portal-comment-authors", openPost?.id, commentAuthorIds.join(",")],
    enabled: !!openPost?.id && commentAuthorIds.length > 0,
    queryFn: async () => {
      if (commentAuthorIds.length === 0) return [] as { id: string; name: string | null; avatar_url: string | null }[];
      const { data, error } = await supabase.from("profiles").select("id, name, avatar_url").in("id", commentAuthorIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase.channel(`portal-${client.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `client_id=eq.${client.id}` }, () => refetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_approvals", filter: `client_id=eq.${client.id}` }, () => refetchAppr())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [client?.id, refetchPosts, refetchAppr]);

  const approvalByPost = useMemo(() => {
    const m = new Map<string, Approval>();
    approvals.forEach((a) => m.set(a.post_id, a));
    return m;
  }, [approvals]);

  const commentAuthorMap = useMemo(() => new Map(commentAuthors.map((p) => [p.id, p])), [commentAuthors]);

  // Auto-open a post when ?open=<post_id> is in the URL (from a notification)
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const openFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const openId = params.get("open");
      if (!openId || posts.length === 0) return;
      const target = posts.find((p) => p.id === openId);
      if (!target) return;
      setOpenPost(target);
      setFeedback(approvalByPost.get(openId)?.feedback ?? "");
      setFocusedCommentId(params.get("comment"));
      const url = new URL(window.location.href);
      url.searchParams.delete("open");
      url.searchParams.delete("comment");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    };
    openFromUrl();
    window.addEventListener("notification:navigate", openFromUrl);
    return () => window.removeEventListener("notification:navigate", openFromUrl);
  }, [posts, approvalByPost]);

  useEffect(() => {
    if (!openPost || !focusedCommentId || comments.length === 0) return;
    window.setTimeout(() => {
      document.getElementById(`portal-comment-${focusedCommentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [openPost, focusedCommentId, comments.length]);

  const decideMutation = useMutation({
    mutationFn: async (args: { post: Post; decision: Decision; feedback: string }) => {
      if (!client?.id) throw new Error("Cliente não vinculado");
      const existing = approvalByPost.get(args.post.id);
      if (existing) {
        const { error } = await supabase.from("post_approvals")
          .update({ decision: args.decision, feedback: args.feedback || null, decided_by: user?.id ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_approvals").insert({
          post_id: args.post.id, client_id: client.id, decision: args.decision,
          feedback: args.feedback || null, decided_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(`${DECISION_META[vars.decision].label}${vars.post.title ? ` · ${vars.post.title}` : ""}`);
      qc.invalidateQueries({ queryKey: ["portal-approvals", client?.id] });
      if (openPost?.id === vars.post.id) { setOpenPost(null); setFeedback(""); }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendComment = async () => {
    if (!openPost?.id || !user?.id || !newComment.trim()) return;
    const { error } = await supabase.from("post_comments").insert({
      post_id: openPost.id,
      author_id: user.id,
      content: newComment.trim(),
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    qc.invalidateQueries({ queryKey: ["portal-post-comments", openPost.id] });
    toast.success("Comentário enviado");
  };

  const updateComment = async () => {
    if (!openPost?.id || !editingCommentId || !editingCommentContent.trim()) return;
    const { error } = await supabase
      .from("post_comments")
      .update({ content: editingCommentContent.trim() })
      .eq("id", editingCommentId);
    if (error) return toast.error(error.message);
    setEditingCommentId(null);
    setEditingCommentContent("");
    qc.invalidateQueries({ queryKey: ["portal-post-comments", openPost.id] });
    toast.success("Comentário atualizado");
  };

  const deleteComment = async (id: string) => {
    if (!openPost?.id) return;
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["portal-post-comments", openPost.id] });
    toast.success("Comentário excluído");
  };

  function clientDecisionOf(p: Post): Decision {
    const ap = approvalByPost.get(p.id);
    if (ap) return ap.decision;
    if (p.status === "approved" || p.status === "to_schedule" || p.status === "scheduled" || p.status === "published") return "approved";
    if (p.status === "changes_requested") return "changes_requested";
    if ((p.status as string) === "rejected" || p.status === "archived") return "rejected";
    return "pending";
  }

  const filteredPosts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return posts.filter((p) => {
      const d = clientDecisionOf(p);
      if (tab !== "all" && d !== tab) return false;
      if (!q) return true;
      return [p.title, p.headline, p.theme].some((v) => v?.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, search, tab, approvalByPost]);

  const counts = useMemo(() => {
    const c: Record<Decision | "all", number> = { all: posts.length, pending: 0, approved: 0, rejected: 0, changes_requested: 0 };
    posts.forEach((p) => { const d = clientDecisionOf(p); c[d] = (c[d] ?? 0) + 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, approvalByPost]);

  if (!client) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <CardTitle>Área do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um cliente. Solicite à equipe a associação do seu acesso.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Portal</span>
          <span className="text-xs text-muted-foreground">· {client.name}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovações de conteúdo</h1>
        <p className="text-sm text-muted-foreground">
          Aprove com 1 clique direto no card, ou abra para deixar feedback detalhado.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["pending","approved","changes_requested","rejected"] as Decision[]).map((d) => {
          const meta = DECISION_META[d]; const Icon = meta.icon;
          return (
            <Card key={d} className="border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div><p className="text-xs text-muted-foreground">{meta.label}</p><p className="text-2xl font-semibold">{counts[d]}</p></div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${meta.tone}`}><Icon className="h-4 w-4" /></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {updates.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atualizações da equipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {updates.map((u) => (
              <div key={u.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-medium">{u.title}</p>
                {u.detail && <p className="text-xs text-muted-foreground">{u.detail}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(u.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Decision | "all")}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="changes_requested">Ajustes ({counts.changes_requested})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conteúdo..." className="pl-8" />
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nada por aqui</p>
            <p className="text-xs text-muted-foreground">Quando a equipe publicar novos conteúdos, eles aparecerão neste painel.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((p) => {
            const ap = approvalByPost.get(p.id);
            const decision: Decision = clientDecisionOf(p);
            const dMeta = DECISION_META[decision];
            const isPending = decideMutation.isPending && decideMutation.variables?.post.id === p.id;

            return (
              <Card key={p.id} className="group flex flex-col transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex-1 cursor-pointer" onClick={() => { setOpenPost(p); setFeedback(ap?.feedback ?? ""); setFocusedCommentId(null); }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 text-base">{p.title}</CardTitle>
                      <Badge variant="outline" className={dMeta.tone}>{dMeta.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                      {postNetworks(p).map((n) => <span key={n} className="rounded bg-muted px-1.5 py-0.5">{n}</span>)}
                      {p.format && <span className="rounded bg-muted px-1.5 py-0.5">{p.format}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <PostCreativeThumb postId={p.id} />
                    {p.headline && <p className="line-clamp-2 text-sm">{p.headline}</p>}
                    {p.scheduled_date && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.scheduled_date).toLocaleDateString("pt-BR")}
                        {p.scheduled_time && ` · ${p.scheduled_time.slice(0, 5)}`}
                      </div>
                    )}
                  </CardContent>
                </div>
                <div className="grid grid-cols-3 gap-1.5 border-t border-border p-2">
                  <Button
                    size="sm" variant="ghost" disabled={isPending}
                    className="h-8 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={(e) => { e.stopPropagation(); decideMutation.mutate({ post: p, decision: "rejected", feedback: "" }); }}
                  ><XCircle className="mr-1 h-3.5 w-3.5" /> Rejeitar</Button>
                  <Button
                    size="sm" variant="ghost" disabled={isPending}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setOpenPost(p); setFeedback(ap?.feedback ?? ""); setFocusedCommentId(null); }}
                  ><MessageSquareWarning className="mr-1 h-3.5 w-3.5" /> Ajustes</Button>
                  <Button
                    size="sm" disabled={isPending}
                    className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-600/90"
                    onClick={(e) => { e.stopPropagation(); decideMutation.mutate({ post: p, decision: "approved", feedback: "" }); }}
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!openPost} onOpenChange={(o) => !o && setOpenPost(null)}>
        <SheetContent className="w-full overflow-y-auto overscroll-contain pb-10 sm:max-w-2xl">
          {openPost && (() => {
            const ap = approvalByPost.get(openPost.id);
            const decision: Decision = clientDecisionOf(openPost);
            const dMeta = DECISION_META[decision];
            return (
              <>
                <SheetHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={dMeta.tone}>{dMeta.label}</Badge>
                    {postNetworks(openPost).map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
                  </div>
                  <SheetTitle>{openPost.title}</SheetTitle>
                  {openPost.headline && <SheetDescription>{openPost.headline}</SheetDescription>}
                </SheetHeader>

                <div className="mt-4">
                  <div className="space-y-4 break-words text-sm">
                    <section>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Criativo</p>
                      <PostCreativeGallery postId={openPost.id} previewOnly />
                    </section>
                    {(() => {
                      const p = openPost as unknown as { subheadline?: string | null; slides?: unknown; script?: string | null };
                      const slides = Array.isArray(p.slides) ? (p.slides as unknown[]).filter((s): s is string => typeof s === "string") : [];
                      return (
                        <>
                          {p.subheadline && (
                            <section>
                              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Subheadline</p>
                              <p>{p.subheadline}</p>
                            </section>
                          )}
                          {slides.length > 0 && (
                            <section>
                              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Slides ({slides.length})</p>
                              <ol className="space-y-2">
                                {slides.map((s, i) => (
                                  <li key={i} className="rounded-md border bg-muted/30 p-2">
                                    <span className="mr-2 text-[10px] font-semibold text-muted-foreground">SLIDE {i + 1}</span>
                                    <span className="whitespace-pre-wrap">{s}</span>
                                  </li>
                                ))}
                              </ol>
                            </section>
                          )}
                          {p.script && (
                            <section>
                              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Roteiro</p>
                              <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3">{p.script}</div>
                            </section>
                          )}
                        </>
                      );
                    })()}
                    {openPost.caption && (
                      <section>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Legenda</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(openPost.caption) }} />
                      </section>
                    )}
                    {openPost.cta && <section><p className="mb-1 text-xs font-medium uppercase text-muted-foreground">CTA</p><p>{openPost.cta}</p></section>}
                    {openPost.hashtags && <section><p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Hashtags</p><p className="break-words text-muted-foreground">{openPost.hashtags}</p></section>}
                    <div className="grid grid-cols-2 gap-3">
                      {openPost.theme && <div><p className="text-xs uppercase text-muted-foreground">Tema</p><p>{openPost.theme}</p></div>}
                      {openPost.objective && <div><p className="text-xs uppercase text-muted-foreground">Objetivo</p><p>{openPost.objective}</p></div>}
                      {openPost.format && <div><p className="text-xs uppercase text-muted-foreground">Formato</p><p>{openPost.format}</p></div>}
                      {openPost.scheduled_date && (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Agendado</p>
                          <p>{new Date(openPost.scheduled_date).toLocaleDateString("pt-BR")}{openPost.scheduled_time && ` · ${openPost.scheduled_time.slice(0,5)}`}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <section id="comments" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Comentários ({comments.length})</p>
                  </div>
                  <div className="space-y-2">
                    {comments.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        Nenhum comentário ainda
                      </p>
                    ) : (
                      comments.map((comment) => {
                        const author = commentAuthorMap.get(comment.author_id);
                        const isEditing = editingCommentId === comment.id;
                        const canManage = comment.author_id === user?.id;
                        return (
                          <div
                            key={comment.id}
                            id={`portal-comment-${comment.id}`}
                            className={`rounded-md bg-muted/50 px-3 py-2 transition-shadow ${focusedCommentId === comment.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium">{author?.name ?? "Cliente"}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(comment.created_at).toLocaleString("pt-BR")}
                                </span>
                              </div>
                              {canManage && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => deleteComment(comment.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  rows={2}
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  className="resize-none text-sm"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>Cancelar</Button>
                                  <Button type="button" size="sm" onClick={updateComment} disabled={!editingCommentContent.trim()}>Salvar</Button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea
                      rows={2}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Adicionar comentário..."
                      className="resize-none text-sm"
                    />
                    <Button type="button" size="sm" onClick={sendComment} disabled={!newComment.trim()}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </section>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium uppercase text-muted-foreground">Seu feedback</label>
                    <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comentários, ajustes solicitados ou observações..." rows={4} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10" disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ post: openPost, decision: "rejected", feedback })}>
                      <XCircle className="mr-1 h-4 w-4" /> Rejeitar
                    </Button>
                    <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ post: openPost, decision: "changes_requested", feedback })}>
                      <MessageSquareWarning className="mr-1 h-4 w-4" /> Ajustes
                    </Button>
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ post: openPost, decision: "approved", feedback })}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
                    </Button>
                  </div>
                  {ap?.decided_by && (
                    <p className="text-xs text-muted-foreground">
                      Última decisão registrada em {new Date(ap.updated_at).toLocaleString("pt-BR")}.
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* eslint no-unused-vars silencer */}
      <div className="hidden"><Avatar><AvatarFallback>x</AvatarFallback></Avatar></div>
    </div>
  );
}
