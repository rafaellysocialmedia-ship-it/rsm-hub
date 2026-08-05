import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar, Clock, Users, Lock, MessageSquare, History, FileText, Pencil, Send,
  Trash2, Reply, CheckCircle2, XCircle, MessageSquareWarning, Loader2, Save, EyeOff,
} from "lucide-react";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { statusMeta, postNetworks, POST_STATUS, type Post, type PostComment } from "@/lib/posts";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { PostCreativeGallery } from "@/components/posts/post-creative-viewer";

type Extra = { subheadline?: string | null; slides?: unknown; script?: string | null; internal_notes?: string | null };
type CommentRow = PostComment & { parent_id?: string | null; is_internal?: boolean };
type ActivityRow = {
  id: string;
  action: string;
  detail: string | null;
  actor_id: string | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  approval_approved: "Cliente aprovou",
  approval_rejected: "Cliente reprovou",
  approval_changes_requested: "Cliente solicitou ajustes",
  approval_pending: "Aprovação pendente",
};

const APPROVAL_META: Record<string, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Aguardando cliente", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  approved: { label: "Aprovado pelo cliente", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "Reprovado pelo cliente", tone: "bg-rose-500/10 text-rose-600 border-rose-500/30", icon: XCircle },
  changes_requested: { label: "Ajustes solicitados", tone: "bg-red-500/10 text-red-600 border-red-500/30", icon: MessageSquareWarning },
};

/** Ordered pipeline used by the status stepper. */
const PIPELINE = ["idea", "production", "review", "approved", "scheduled", "published"] as const;

function slidesOf(post: Post): string[] {
  const raw = (post as unknown as Extra).slides;
  return Array.isArray(raw) ? (raw as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];
}

function initials(name: string | null | undefined) {
  return (name ?? "?").trim().slice(0, 2).toUpperCase();
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}

export function PostDetailSheet({
  post, open, onOpenChange, clientName, onEdit, focusedCommentId,
}: {
  post: Post | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName?: string | null;
  onEdit?: (p: Post) => void;
  focusedCommentId?: string | null;
}) {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const isStaff = hasRole("administrator") || hasRole("team");

  const [tab, setTab] = useState("content");
  const [newComment, setNewComment] = useState("");
  const [asInternal, setAsInternal] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab(focusedCommentId ? "comments" : "content");
    setNewComment(""); setReplyTo(null); setEditingId(null); setAsInternal(false);
    setNotes((post as unknown as Extra | null)?.internal_notes ?? "");
  }, [open, post, focusedCommentId]);

  const postId = post?.id;

  const { data: comments = [] } = useQuery({
    queryKey: ["post-detail-comments", postId],
    enabled: !!postId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("post_comments").select("*").eq("post_id", postId!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["post-detail-activity", postId],
    enabled: !!postId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_activity_log").select("id,action,detail,actor_id,created_at")
        .eq("post_id", postId!).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const { data: approval } = useQuery({
    queryKey: ["post-detail-approval", postId],
    enabled: !!postId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("post_approvals").select("*").eq("post_id", postId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const peopleIds = useMemo(() => {
    const s = new Set<string>();
    comments.forEach((c) => c.author_id && s.add(c.author_id));
    activity.forEach((a) => a.actor_id && s.add(a.actor_id));
    if (post?.created_by) s.add(post.created_by);
    return Array.from(s);
  }, [comments, activity, post?.created_by]);

  const { data: people = [] } = useQuery({
    queryKey: ["post-detail-people", postId, peopleIds.join(",")],
    enabled: open && peopleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").in("id", peopleIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const nameOf = (id: string | null | undefined) =>
    (id ? people.find((p) => p.id === id)?.name : null) ?? "—";

  const visibleComments = useMemo(
    () => comments.filter((c) => isStaff || !c.is_internal),
    [comments, isStaff],
  );
  const roots = visibleComments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => visibleComments.filter((c) => c.parent_id === id);

  useEffect(() => {
    if (!open || !focusedCommentId || comments.length === 0) return;
    const id = focusedCommentId === "last" ? comments[comments.length - 1]?.id : focusedCommentId;
    if (!id) return;
    window.setTimeout(() => {
      document.getElementById(`detail-comment-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, [open, focusedCommentId, comments]);

  const invalidateComments = () => qc.invalidateQueries({ queryKey: ["post-detail-comments", postId] });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!postId || !user?.id || !newComment.trim()) throw new Error("Comentário vazio");
      const payload: Record<string, unknown> = {
        post_id: postId, author_id: user.id, content: newComment.trim(),
        is_internal: isStaff ? asInternal : false,
        parent_id: replyTo?.id ?? null,
      };
      const { error } = await supabase.from("post_comments").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => { setNewComment(""); setReplyTo(null); invalidateComments(); toast.success("Comentário publicado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editComment = useMutation({
    mutationFn: async () => {
      if (!editingId || !editingContent.trim()) throw new Error("Conteúdo vazio");
      const { error } = await supabase.from("post_comments").update({ content: editingContent.trim() }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); setEditingContent(""); invalidateComments(); toast.success("Comentário atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateComments(); toast.success("Comentário excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!postId) return;
      const { error } = await supabase.from("posts").update({ internal_notes: notes || null } as never).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["posts"] }); toast.success("Observações internas salvas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!post) return null;

  const meta = statusMeta(post.status);
  const extra = post as unknown as Extra;
  const slides = slidesOf(post);
  const fmt = (post.format ?? "").toLowerCase();
  const isCarousel = fmt.includes("carrossel") || slides.length > 0;
  const isVideo = fmt.includes("reels") || fmt.includes("vídeo") || fmt.includes("video") || fmt.includes("story");
  const aMeta = approval ? APPROVAL_META[approval.decision] : null;
  const currentStep = PIPELINE.indexOf(post.status as (typeof PIPELINE)[number]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-2 border-b border-border p-5 pb-4 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px]", meta.tone)}>{meta.label}</Badge>
            {postNetworks(post).map((n) => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
            {post.format && <Badge variant="secondary" className="text-[10px]">{post.format}</Badge>}
            {aMeta && <Badge variant="outline" className={cn("text-[10px]", aMeta.tone)}>{aMeta.label}</Badge>}
          </div>
          <SheetTitle className="pr-8 text-lg leading-snug">{post.title}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {clientName && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{clientName}</span>}
            {post.scheduled_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(new Date(post.scheduled_date + "T00:00:00"), "dd MMM yyyy", { locale: ptBR })}
                {post.scheduled_time ? ` · ${post.scheduled_time.slice(0, 5)}` : ""}
              </span>
            )}
            {isStaff && post.created_by && <span>Responsável: {nameOf(post.created_by)}</span>}
          </SheetDescription>

          {/* Status stepper */}
          <div className="flex items-center gap-1 pt-1">
            {PIPELINE.map((s, i) => {
              const m = POST_STATUS.find((x) => x.value === s)!;
              const done = currentStep >= 0 && i <= currentStep;
              return (
                <div key={s} className="flex flex-1 flex-col gap-1" title={m.label}>
                  <span className={cn("h-1 rounded-full", done ? m.dot : "bg-muted")} />
                  <span className={cn("truncate text-[9px]", done ? "text-foreground" : "text-muted-foreground")}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-3">
            <TabsList className="h-9">
              <TabsTrigger value="content" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Conteúdo</TabsTrigger>
              <TabsTrigger value="comments" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />Comentários
                {visibleComments.length > 0 && <span className="ml-0.5 rounded bg-muted px-1 text-[10px]">{visibleComments.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" />Histórico</TabsTrigger>
              {isStaff && <TabsTrigger value="internal" className="gap-1.5 text-xs"><Lock className="h-3.5 w-3.5" />Interno</TabsTrigger>}
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-5">
              {/* -------- CONTEÚDO -------- */}
              <TabsContent value="content" className="mt-0 space-y-5">
                <Block label="Criativo">
                  <PostCreativeGallery postId={post.id} previewOnly />
                </Block>

                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-3">
                  <Info label="Objetivo" value={post.objective} />
                  <Info label="Tema" value={post.theme} />
                  <Info label="Pilar / funil" value={post.pillar} />
                  <Info label="Formato" value={post.format} />
                  <Info label="Redes" value={postNetworks(post).join(", ") || null} />
                  <Info label="Criado em" value={formatDate(new Date(post.created_at), "dd/MM/yyyy", { locale: ptBR })} />
                </div>

                {post.headline && (
                  <Block label={isVideo ? "Título / gancho" : "Headline"}>
                    <p className="text-base font-medium leading-snug">{post.headline}</p>
                  </Block>
                )}
                {extra.subheadline && (
                  <Block label="Subheadline">
                    <p className="text-sm text-muted-foreground">{extra.subheadline}</p>
                  </Block>
                )}

                {isCarousel && slides.length > 0 && (
                  <Block label={`Slides (${slides.length})`}>
                    <ol className="space-y-2">
                      {slides.map((s, i) => (
                        <li key={i} className="rounded-lg border border-border bg-card p-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Slide {i + 1}</p>
                          <p className="whitespace-pre-wrap text-sm">{s}</p>
                        </li>
                      ))}
                    </ol>
                  </Block>
                )}

                {isVideo && extra.script && (
                  <Block label="Roteiro do vídeo">
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-sm leading-relaxed">
                      {extra.script}
                    </div>
                  </Block>
                )}

                {post.caption && (
                  <Block label="Legenda">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-3"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.caption) }}
                    />
                  </Block>
                )}
                {post.cta && <Block label="CTA"><p className="text-sm">{post.cta}</p></Block>}
                {post.hashtags && (
                  <Block label="Hashtags">
                    <p className="break-words text-sm text-muted-foreground">{post.hashtags}</p>
                  </Block>
                )}

                {approval?.feedback && (
                  <Block label="Feedback do cliente">
                    <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm">{approval.feedback}</p>
                  </Block>
                )}
              </TabsContent>

              {/* -------- COMENTÁRIOS -------- */}
              <TabsContent value="comments" className="mt-0 space-y-4">
                {roots.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    Nenhum comentário ainda
                  </p>
                )}
                <ul className="space-y-3">
                  {roots.map((c) => (
                    <li key={c.id} className="space-y-2">
                      <CommentItem
                        c={c}
                        authorName={nameOf(c.author_id)}
                        isOwn={c.author_id === user?.id}
                        editingId={editingId}
                        editingContent={editingContent}
                        setEditingContent={setEditingContent}
                        onStartEdit={() => { setEditingId(c.id); setEditingContent(c.content); }}
                        onCancelEdit={() => setEditingId(null)}
                        onSaveEdit={() => editComment.mutate()}
                        onDelete={() => removeComment.mutate(c.id)}
                        onReply={() => { setReplyTo(c); setTab("comments"); }}
                      />
                      {repliesOf(c.id).length > 0 && (
                        <ul className="space-y-2 border-l-2 border-border pl-3 ml-4">
                          {repliesOf(c.id).map((r) => (
                            <li key={r.id}>
                              <CommentItem
                                c={r}
                                authorName={nameOf(r.author_id)}
                                isOwn={r.author_id === user?.id}
                                editingId={editingId}
                                editingContent={editingContent}
                                setEditingContent={setEditingContent}
                                onStartEdit={() => { setEditingId(r.id); setEditingContent(r.content); }}
                                onCancelEdit={() => setEditingId(null)}
                                onSaveEdit={() => editComment.mutate()}
                                onDelete={() => removeComment.mutate(r.id)}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>

                <Separator />
                <div className="space-y-2">
                  {replyTo && (
                    <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs">
                      <span className="truncate">Respondendo {nameOf(replyTo.author_id)}: “{replyTo.content.slice(0, 40)}”</span>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setReplyTo(null)}>Cancelar</Button>
                    </div>
                  )}
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário..."
                    rows={3}
                  />
                  <div className="flex items-center justify-between gap-2">
                    {isStaff ? (
                      <div className="flex items-center gap-2">
                        <Switch id="internal-comment" checked={asInternal} onCheckedChange={setAsInternal} />
                        <Label htmlFor="internal-comment" className="flex items-center gap-1 text-xs text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> Nota interna (o cliente não vê)
                        </Label>
                      </div>
                    ) : <span />}
                    <Button size="sm" className="gap-1.5" disabled={!newComment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                      {addComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Comentar
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* -------- HISTÓRICO -------- */}
              <TabsContent value="history" className="mt-0">
                <ol className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1 border-b border-border pb-3">
                        <p className="text-sm font-medium">{ACTION_LABEL[a.action] ?? a.action}</p>
                        {a.detail && <p className="mt-0.5 text-sm text-muted-foreground">{a.detail}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDate(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {a.actor_id ? ` · ${nameOf(a.actor_id)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Publicação criada</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(new Date(post.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {post.created_by ? ` · ${nameOf(post.created_by)}` : ""}
                      </p>
                    </div>
                  </li>
                </ol>
              </TabsContent>

              {/* -------- INTERNO -------- */}
              {isStaff && (
                <TabsContent value="internal" className="mt-0 space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Área visível apenas para a equipe. Nada aqui aparece no portal do cliente.
                  </div>
                  <Block label="Observações internas">
                    <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Briefing, referências, combinados com o cliente..." />
                    <Button size="sm" className="mt-2 gap-1.5" disabled={saveNotes.isPending} onClick={() => saveNotes.mutate()}>
                      {saveNotes.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                    </Button>
                  </Block>
                  <Block label="Notas internas na thread">
                    {comments.filter((c) => c.is_internal).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma nota interna.</p>
                    ) : (
                      <ul className="space-y-2">
                        {comments.filter((c) => c.is_internal).map((c) => (
                          <li key={c.id} className="rounded-lg border border-border bg-muted/20 p-2 text-sm">
                            <p className="text-[11px] text-muted-foreground">{nameOf(c.author_id)} · {formatDate(new Date(c.created_at), "dd/MM HH:mm")}</p>
                            <p className="whitespace-pre-wrap">{c.content}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Block>
                </TabsContent>
              )}
            </div>
          </ScrollArea>
        </Tabs>

        {onEdit && isStaff && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button className="gap-1.5" onClick={() => onEdit(post)}><Pencil className="h-4 w-4" /> Editar publicação</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CommentItem({
  c, authorName, isOwn, editingId, editingContent, setEditingContent,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete, onReply,
}: {
  c: CommentRow;
  authorName: string;
  isOwn: boolean;
  editingId: string | null;
  editingContent: string;
  setEditingContent: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onReply?: () => void;
}) {
  const editing = editingId === c.id;
  return (
    <div
      id={`detail-comment-${c.id}`}
      className={cn(
        "rounded-lg border border-border p-3",
        c.is_internal ? "border-amber-500/30 bg-amber-500/5" : "bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(authorName)}</AvatarFallback></Avatar>
        <span className="text-sm font-medium">{authorName}</span>
        {c.is_internal && <Badge variant="outline" className="h-4 gap-1 px-1 text-[9px] text-amber-600">interno</Badge>}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatDate(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea rows={3} value={editingContent} onChange={(e) => setEditingContent(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={onSaveEdit}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelEdit}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
      )}
      {!editing && (
        <div className="mt-2 flex gap-1">
          {onReply && (
            <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px]" onClick={onReply}>
              <Reply className="h-3 w-3" /> Responder
            </Button>
          )}
          {isOwn && (
            <>
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px]" onClick={onStartEdit}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px] text-destructive" onClick={onDelete}>
                <Trash2 className="h-3 w-3" /> Excluir
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
