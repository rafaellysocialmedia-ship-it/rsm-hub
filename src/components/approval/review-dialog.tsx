import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MessageSquare,
  Lock,
  Trash2,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePostCreativeQuery } from "@/components/posts/post-creative-viewer";
import { PostTextVersions } from "@/components/workspace/post-text-versions";
import { sanitizeHtml } from "@/lib/sanitize";
import { postNetworks, statusMeta, type Post } from "@/lib/posts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/workspace/account-panels";
import { ReviewLinks } from "./review-links";
export function invalidateReviews(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    "portal-posts",
    "portal-home-posts",
    "portal-approvals",
    "posts",
    "staff-approvals-posts",
    "portal-calendar-posts",
    "shared-post-versions",
    "post-review-history",
    "retention",
    "client-workspace-posts",
    "post-usage",
    "operational-dashboard",
    "delivery-progress",
    "post-creative-signed",
  ])
    void qc.invalidateQueries({ queryKey: [key] });
}
export function ReviewDialog({
  post,
  onClose,
  token,
  readOnly = false,
}: {
  post: Post;
  onClose: () => void;
  token?: string;
  readOnly?: boolean;
}) {
  const { hasRole } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState(""),
    [adjust, setAdjust] = useState(false);
  const permissions = useQuery({
    queryKey: ["portal-settings", post.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_settings")
        .select("*")
        .eq("client_id", post.client_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const decide = useMutation({
    mutationFn: async (decision: "approved" | "changes_requested") => {
      if (decision === "changes_requested" && !feedback.trim())
        throw new Error("Descreva o ajuste necessário.");
      const args = {
        _expected_updated_at: post.updated_at,
        _decision: decision,
        _feedback: feedback.trim() || undefined,
      };
      const { error } = token
        ? await supabase.rpc("decide_approval_link", { ...args, _token: token })
        : await supabase.rpc("decide_my_account_post", { ...args, _post_id: post.id });
      if (error) throw error;
    },
    onSuccess: (_, decision) => {
      invalidateReviews(qc);
      toast.success(
        decision === "approved"
          ? "Conteúdo aprovado. Obrigada!"
          : "Ajuste registrado para a equipe.",
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const actionable = !staff && !readOnly && ["review", "changes_requested"].includes(post.status);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 flex h-dvh !w-screen !max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 lg:!inset-[3vh_3vw] lg:h-[94vh] lg:!w-[94vw] lg:rounded-xl lg:border">
        <DialogHeader className="border-b bg-card px-5 py-4 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={statusMeta(post.status).tone}>
              {statusMeta(post.status).label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Versão {post.content_revision ?? 1}
            </span>
          </div>
          <DialogTitle className="text-lg">{post.title}</DialogTitle>
          <DialogDescription>
            {postNetworks(post).join(" · ")}
            {post.format && ` · ${post.format}`} ·{" "}
            {post.scheduled_date
              ? new Date(post.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR")
              : "Data a definir"}{" "}
            {post.scheduled_time?.slice(0, 5)}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:overflow-hidden">
          <div className="min-w-0 space-y-5 p-4 lg:overflow-y-auto lg:p-6">
            <CreativeStage postId={post.id} />
            {["scheduled", "published"].includes(post.status) && (
              <p className="text-xs text-muted-foreground">
                {post.publication_source === "manual"
                  ? `Status confirmado manualmente em ${new Date(post.publication_confirmed_at!).toLocaleString("pt-BR")}`
                  : "Status do registro histórico; origem da confirmação não informada."}
              </p>
            )}
            {post.caption && (
              <section>
                <h3 className="mb-3 font-semibold">Legenda</h3>
                <div
                  className="prose prose-sm max-w-none break-words whitespace-pre-wrap dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.caption) }}
                />
              </section>
            )}
            {post.script && (
              <details>
                <summary className="cursor-pointer font-medium">
                  Roteiro e orientações do conteúdo
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm">{post.script}</p>
              </details>
            )}
            <ReviewHistory postId={post.id} />
            <PostTextVersions postId={post.id} />
            {staff && <ReviewLinks post={post} />}
          </div>
          <aside className="border-t bg-card p-4 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-5">
            <ContextComments
              postId={post.id}
              canComment={staff || (!readOnly && !!permissions.data?.can_comment)}
            />
          </aside>
        </div>
        {actionable && (
          <footer className="rsm-approval-actions shrink-0 border-t bg-card px-4 py-3">
            {permissions.error && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível verificar suas permissões.
              </p>
            )}
            {adjust && (
              <label className="mb-3 block text-sm font-medium">
                O que precisa ser ajustado?
                <Textarea
                  autoFocus
                  required
                  maxLength={4000}
                  className="mt-2 max-h-28"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Indique o trecho, a imagem ou o detalhe que deseja alterar."
                />
              </label>
            )}
            <div className="flex gap-3 sm:justify-end">
              {permissions.data?.can_request_changes && (
                <Button
                  className="min-h-11 flex-1 sm:flex-none"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => (adjust ? decide.mutate("changes_requested") : setAdjust(true))}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {adjust ? "Enviar ajuste" : "Solicitar ajuste"}
                </Button>
              )}
              {permissions.data?.can_approve && (
                <Button
                  className="min-h-11 flex-1 bg-emerald-700 text-white hover:bg-emerald-800 sm:flex-none"
                  disabled={decide.isPending || adjust}
                  onClick={() => decide.mutate("approved")}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Aprovar
                </Button>
              )}
              {adjust && (
                <Button variant="ghost" onClick={() => setAdjust(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function CreativeStage({ postId }: { postId: string }) {
  const q = usePostCreativeQuery(postId);
  const items = q.data ?? [];
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)];
  if (q.isLoading) return <p className="p-8 text-sm">Carregando mídias…</p>;
  if (q.error)
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        Não foi possível carregar as mídias.{" "}
        <button className="underline" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!items.length)
    return (
      <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-sm text-muted-foreground">
        Nenhuma arte ou vídeo anexado.
      </div>
    );
  return (
    <div className="rsm-approval-media space-y-3">
      <div className="grid min-h-52 place-items-center overflow-hidden rounded-xl border bg-muted/40">
        {current?.url ? (
          current.file.mime_type?.startsWith("video/") ? (
            <video key={current.url} src={current.url} controls playsInline />
          ) : current.file.mime_type?.startsWith("image/") ? (
            <img src={current.url} alt={current.file.file_name} />
          ) : (
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="p-8 text-primary underline"
            >
              Abrir {current.file.file_name}
            </a>
          )
        ) : (
          <p className="p-8 text-sm">Carregando prévia…</p>
        )}
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mídia anterior"
            disabled={index <= 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm">
            {Math.min(index + 1, items.length)} de {items.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próxima mídia"
            disabled={index >= items.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
function ContextComments({ postId, canComment }: { postId: string; canComment: boolean }) {
  const { user, hasRole } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const [content, setContent] = useState(""),
    [internal, setInternal] = useState(false),
    [editing, setEditing] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["review-comments", postId],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const authors = useQuery({
    queryKey: ["review-authors", postId, q.data?.length],
    enabled: !!q.data?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", [...new Set(q.data!.map((c) => c.author_id))]);
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) throw new Error("Escreva seu comentário.");
      const result = editing
        ? await supabase.from("post_comments").update({ content: content.trim() }).eq("id", editing)
        : await supabase.from("post_comments").insert({
            post_id: postId,
            author_id: user.id,
            content: content.trim(),
            is_internal: staff && internal,
          });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      setContent("");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["review-comments", postId] });
      toast.success("Comentário salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["review-comments", postId] });
      toast.success("Comentário excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">
        Comentários <span className="text-muted-foreground">({q.data?.length ?? 0})</span>
      </h3>
      <QueryState loading={q.isLoading} error={q.error}>
        {!q.data?.length && (
          <p className="text-sm text-muted-foreground">
            Use este espaço para alinhar os detalhes deste conteúdo.
          </p>
        )}
        {q.data?.map((c) => (
          <article key={c.id} className="mb-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {authors.data?.find((a) => a.id === c.author_id)?.name ??
                  (c.author_id === user?.id ? "Você" : "Participante")}
              </p>
              {c.is_internal && (
                <Badge variant="outline">
                  <Lock className="mr-1 h-3 w-3" />
                  Interno
                </Badge>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
            <div className="mt-2 flex items-center gap-2">
              <time className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("pt-BR")}
              </time>
              {c.author_id === user?.id && canComment && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar comentário"
                    onClick={() => {
                      setEditing(c.id);
                      setContent(c.content);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir comentário"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </QueryState>
      {canComment && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Textarea
            aria-label="Seu comentário"
            rows={3}
            required
            maxLength={4000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comente sobre este conteúdo…"
          />
          {staff && !editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Nota interna, visível apenas para a equipe
            </label>
          )}
          <Button type="submit" disabled={save.isPending}>
            {editing ? "Salvar edição" : "Comentar"}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setContent("");
              }}
            >
              Cancelar
            </Button>
          )}
        </form>
      )}
    </section>
  );
}
function ReviewHistory({ postId }: { postId: string }) {
  const q = useQuery({
    queryKey: ["post-review-history", postId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_post_review_history", { _post_id: postId });
      if (error) throw error;
      return data as unknown as {
        id: string;
        revision: number;
        decision: string;
        feedback: string | null;
        actor_name: string | null;
        created_at: string;
        snapshot: { caption?: string; files: { storage_path: string; file_name: string }[] };
      }[];
    },
  });
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer text-sm font-medium">Decisões e versões revisadas</summary>
      <QueryState loading={q.isLoading} error={q.error}>
        {!q.data?.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma decisão com versão registrada ainda.
          </p>
        )}
        {q.data?.map((e) => (
          <article key={e.id} className="mt-3 border-t pt-3 text-sm">
            <p className="font-medium">
              Versão {e.revision} · {e.decision === "approved" ? "Aprovado" : "Ajuste solicitado"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {e.actor_name ?? "Aprovador da conta"} ·{" "}
              {new Date(e.created_at).toLocaleString("pt-BR")}
            </p>
            {e.feedback && <p className="mt-2 whitespace-pre-wrap">{e.feedback}</p>}
            <details className="mt-2">
              <summary className="cursor-pointer text-primary">Conteúdo desta decisão</summary>
              {e.snapshot.caption && (
                <div
                  className="mt-2 break-words"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.snapshot.caption) }}
                />
              )}
              {e.snapshot.files?.map((f) => (
                <HistoricMedia key={f.storage_path} file={f} />
              ))}
            </details>
          </article>
        ))}
      </QueryState>
    </details>
  );
}
function HistoricMedia({ file }: { file: { storage_path: string; file_name: string } }) {
  const open = async () => {
    const { data, error } = await supabase.storage
      .from("post-files")
      .createSignedUrl(file.storage_path, 300);
    if (error) return toast.error("Não foi possível abrir o arquivo desta versão.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <Button variant="link" onClick={() => void open()}>
      {file.file_name}
    </Button>
  );
}
