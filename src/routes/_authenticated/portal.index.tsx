import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, MessageSquareWarning, Clock, Calendar, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { POST_STATUS, statusMeta, type Post } from "@/lib/posts";
import type { Database } from "@/integrations/supabase/types";

type Approval = Database["public"]["Tables"]["post_approvals"]["Row"];
type Decision = Database["public"]["Enums"]["approval_decision"];

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [
      { title: "Área do Cliente · Social Media Hub" },
      { name: "description", content: "Acompanhe e aprove suas publicações em um único lugar." },
    ],
  }),
  component: PortalPage,
});

const DECISION_META: Record<Decision, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pendente", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  approved: { label: "Aprovado", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", tone: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: XCircle },
  changes_requested: { label: "Alterações", tone: "bg-violet-500/10 text-violet-600 border-violet-500/20", icon: MessageSquareWarning },
};

function PortalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Decision | "all">("pending");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [feedback, setFeedback] = useState("");

  // Resolve client_id linked to this user
  const { data: client } = useQuery({
    queryKey: ["portal-client", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: posts = [], refetch: refetchPosts } = useQuery({
    queryKey: ["portal-posts", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("client_id", client!.id)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: approvals = [], refetch: refetchAppr } = useQuery({
    queryKey: ["portal-approvals", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_approvals")
        .select("*")
        .eq("client_id", client!.id);
      if (error) throw error;
      return data as Approval[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase
      .channel(`portal-${client.id}`)
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

  const decideMutation = useMutation({
    mutationFn: async (args: { post: Post; decision: Decision; feedback: string }) => {
      if (!client?.id) throw new Error("Cliente não vinculado");
      const existing = approvalByPost.get(args.post.id);
      if (existing) {
        const { error } = await supabase
          .from("post_approvals")
          .update({ decision: args.decision, feedback: args.feedback || null, decided_by: user?.id ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_approvals").insert({
          post_id: args.post.id,
          client_id: client.id,
          decision: args.decision,
          feedback: args.feedback || null,
          decided_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(`Decisão registrada: ${DECISION_META[vars.decision].label}`);
      qc.invalidateQueries({ queryKey: ["portal-approvals", client?.id] });
      setOpenPost(null);
      setFeedback("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredPosts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return posts.filter((p) => {
      const ap = approvalByPost.get(p.id);
      const decision: Decision = ap?.decision ?? "pending";
      if (tab !== "all" && decision !== tab) return false;
      if (!q) return true;
      return [p.title, p.headline, p.theme, p.social_network].some((v) => v?.toLowerCase().includes(q));
    });
  }, [posts, search, tab, approvalByPost]);

  const counts = useMemo(() => {
    const c: Record<Decision | "all", number> = { all: posts.length, pending: 0, approved: 0, rejected: 0, changes_requested: 0 };
    posts.forEach((p) => {
      const d = approvalByPost.get(p.id)?.decision ?? "pending";
      c[d] = (c[d] ?? 0) + 1;
    });
    return c;
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
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{client.name}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovações de Conteúdo</h1>
        <p className="text-sm text-muted-foreground">Revise as publicações preparadas pela equipe e deixe seu feedback.</p>
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
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${meta.tone}`}>
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
            <TabsTrigger value="changes_requested">Alterações ({counts.changes_requested})</TabsTrigger>
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
            const decision: Decision = ap?.decision ?? "pending";
            const dMeta = DECISION_META[decision];
            const sMeta = statusMeta(p.status);
            return (
              <Card
                key={p.id}
                role="button"
                onClick={() => { setOpenPost(p); setFeedback(ap?.feedback ?? ""); }}
                className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-base">{p.title}</CardTitle>
                    <Badge variant="outline" className={dMeta.tone}>{dMeta.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    {p.social_network && <span className="rounded bg-muted px-1.5 py-0.5">{p.social_network}</span>}
                    {p.format && <span className="rounded bg-muted px-1.5 py-0.5">{p.format}</span>}
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!openPost} onOpenChange={(o) => !o && setOpenPost(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {openPost && (() => {
            const ap = approvalByPost.get(openPost.id);
            const decision: Decision = ap?.decision ?? "pending";
            const dMeta = DECISION_META[decision];
            return (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={dMeta.tone}>{dMeta.label}</Badge>
                    {openPost.social_network && <Badge variant="secondary">{openPost.social_network}</Badge>}
                  </div>
                  <SheetTitle>{openPost.title}</SheetTitle>
                  {openPost.headline && <SheetDescription>{openPost.headline}</SheetDescription>}
                </SheetHeader>

                <ScrollArea className="mt-4 max-h-[55vh] pr-3">
                  <div className="space-y-4 text-sm">
                    {openPost.caption && (
                      <section>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Legenda</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/30 p-3" dangerouslySetInnerHTML={{ __html: openPost.caption }} />
                      </section>
                    )}
                    {openPost.cta && (
                      <section>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">CTA</p>
                        <p>{openPost.cta}</p>
                      </section>
                    )}
                    {openPost.hashtags && (
                      <section>
                        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Hashtags</p>
                        <p className="text-muted-foreground">{openPost.hashtags}</p>
                      </section>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {openPost.theme && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Tema</p>
                          <p>{openPost.theme}</p>
                        </div>
                      )}
                      {openPost.objective && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Objetivo</p>
                          <p>{openPost.objective}</p>
                        </div>
                      )}
                      {openPost.format && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Formato</p>
                          <p>{openPost.format}</p>
                        </div>
                      )}
                      {openPost.scheduled_date && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Agendado</p>
                          <p>{new Date(openPost.scheduled_date).toLocaleDateString("pt-BR")}{openPost.scheduled_time && ` · ${openPost.scheduled_time.slice(0,5)}`}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium uppercase text-muted-foreground">Seu feedback</label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Comentários, ajustes solicitados ou observações..."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ post: openPost, decision: "rejected", feedback })}
                    >
                      <XCircle className="mr-1 h-4 w-4" /> Rejeitar
                    </Button>
                    <Button
                      variant="outline"
                      className="border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
                      disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ post: openPost, decision: "changes_requested", feedback })}
                    >
                      <MessageSquareWarning className="mr-1 h-4 w-4" /> Ajustes
                    </Button>
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                      disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ post: openPost, decision: "approved", feedback })}
                    >
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

      {/* Reference unused exports to keep tree-shaking honest */}
      <div className="hidden"><TabsContent value="_" /></div>
      <div className="hidden">{POST_STATUS.length}</div>
    </div>
  );
}
