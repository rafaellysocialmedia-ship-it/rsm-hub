import { reconcileCalendarDraft } from "@/lib/calendar-draft";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { ReviewDialog } from "@/components/approval/review-dialog";
import { refreshPostViews } from "./post-workspace";
import type { Json } from "@/integrations/supabase/types";
import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Copy,
  Loader2,
  Paperclip,
  Pencil,
  Repeat,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  POST_FORMATS,
  POST_OBJECTIVES,
  POST_STATUS,
  SOCIAL_NETWORKS,
  statusMeta,
  type Post,
  type PostComment,
  type PostFile,
  type PostStatus,
  type RecurrenceRule,
} from "@/lib/posts";
import type { Client } from "@/lib/clients";
import { RichTextEditor } from "./rich-text-editor";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";

export type EditorController = {
  id: string;
  request: (action: () => void) => void;
  schedule: () => Pick<Post, "scheduled_date" | "scheduled_time" | "updated_at">;
  reconcile: (saved: Post) => void;
};
type Props = {
  onCreated?: (post: Post) => void;
  readOnly?: boolean;
  persistent?: boolean;
  minimized?: boolean;
  onMinimize?: () => void;
  onController?: (controller: EditorController) => void;

  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  initial?: Partial<Post>;
  clients: Client[];
  focusedCommentId?: string | null;
};

const EMPTY: Partial<Post> = {
  title: "",
  client_id: null,
  social_network: null,
  social_networks: [],
  scheduled_date: null,
  scheduled_time: null,
  objective: null,
  format: null,
  theme: null,
  pillar: null,
  headline: null,
  caption: "",
  cta: null,
  hashtags: null,
  status: "idea",
} as Partial<Post>;

export function PostEditorSheet({
  open,
  onOpenChange,
  post,
  initial,
  clients,
  focusedCommentId,
  onCreated,
  readOnly = false,
  persistent = false,
  minimized = false,
  onMinimize,
  onController,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<Post>>(EMPTY);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: "none" });
  const isEdit = !!post;
  const permissions = usePermissions();
  const baseline = useRef<Partial<Post>>(post ?? EMPTY);
  const version = useRef(post?.updated_at ?? "");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSaved, setLastSaved] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [internalComment, setInternalComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (persistent && !minimized) panelRef.current?.focus();
  }, [persistent, minimized]);
  const dirty =
    !!newComment.trim() ||
    !!editingCommentId ||
    JSON.stringify(form) !== JSON.stringify(baseline.current) ||
    JSON.stringify(recurrence) !==
      JSON.stringify(baseline.current.recurrence ?? { frequency: "none" });
  const request = (action: () => void) => {
    if (saveMutation.isPending || uploading) {
      toast.info("Aguarde o salvamento terminar.");
      return;
    }
    if (newComment.trim() || editingCommentId) {
      toast.info("Envie ou limpe o comentário em edição antes de fechar ou trocar de publicação.");
      onMinimize && minimized && toast.info("Restaure o editor para concluir o comentário.");
      return;
    }
    if (dirty) setPendingAction(() => action);
    else action();
  };
  const reconcile = (saved: Post, mergeSchedule = true) => {
    const previous = baseline.current;
    baseline.current = reconcileCalendarDraft(previous, previous, saved, mergeSchedule).baseline;
    version.current = saved.updated_at;
    setForm((f) => reconcileCalendarDraft(f, previous, saved, mergeSchedule).draft);
  };
  useEffect(() => {
    onController?.({
      id: post?.id ?? "new",
      request,
      schedule: () => ({
        scheduled_date: baseline.current.scheduled_date ?? null,
        scheduled_time: baseline.current.scheduled_time ?? null,
        updated_at: version.current,
      }),
      reconcile,
    });
  });
  useEffect(() => {
    if (!dirty || !open) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, open]);
  const extras = useQuery({
    queryKey: ["accepted-extras", form.client_id],
    enabled: !!form.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_requests")
        .select("id,title,quote_revision,accepted_revision")
        .eq("client_id", form.client_id!)
        .eq("kind", "extra")
        .not("accepted_at", "is", null);
      if (error) throw error;
      return data.filter((r) => r.quote_revision === r.accepted_revision);
    },
  });

  useEffect(() => {
    if (open) {
      const value = post ?? { ...EMPTY, ...initial };
      baseline.current = value;
      version.current = post?.updated_at ?? "";
      setForm(value);
      setRecurrence((post?.recurrence as RecurrenceRule | null) ?? { frequency: "none" });
    }
  }, [open, post, initial]);

  const update = <K extends keyof Post>(k: K, v: Post[K] | null | undefined) =>
    setForm((f) => ({ ...f, [k]: v as Post[K] }));

  // ---- Files & comments queries (only when editing)
  const {
    data: files = [],
    error: filesError,
    isPending: filesLoading,
  } = useQuery({
    queryKey: ["post-files", post?.id],
    queryFn: async () => {
      if (!post?.id) return [] as PostFile[];
      const { data, error } = await supabase
        .from("post_files")
        .select("*")
        .eq("post_id", post.id)
        .order("sort_order")
        .order("created_at")
        .order("id");
      if (error) throw error;
      return data;
    },
    enabled: !!post?.id,
  });

  const {
    data: comments = [],
    error: commentsError,
    isPending: commentsLoading,
  } = useQuery({
    queryKey: ["post-comments", post?.id],
    queryFn: async () => {
      if (!post?.id) return [] as PostComment[];
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })
        .order("id");
      if (error) throw error;
      return data;
    },
    enabled: !!post?.id,
  });

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id).filter(Boolean)));
  const { data: authorProfiles = [] } = useQuery({
    queryKey: ["comment-authors", post?.id, authorIds.join(",")],
    queryFn: async () => {
      if (authorIds.length === 0)
        return [] as { id: string; name: string | null; avatar_url: string | null }[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", authorIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!post?.id && authorIds.length > 0,
  });
  const authorMap = new Map(authorProfiles.map((p) => [p.id, p]));
  const clientUserId = post?.client_id
    ? (clients.find((c) => c.id === post.client_id)?.user_id ?? null)
    : null;

  useEffect(() => {
    if (!open || !focusedCommentId) return;
    window.setTimeout(() => {
      const targetId =
        focusedCommentId === "last"
          ? comments.length > 0
            ? `comment-${comments[comments.length - 1].id}`
            : "post-comments-section"
          : `comment-${focusedCommentId}`;
      (
        document.getElementById(targetId) ?? document.getElementById("post-comments-section")
      )?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, [open, focusedCommentId, comments]);

  // ---- Save
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || form.title.trim().length === 0) throw new Error("Título obrigatório");
      const networks = ((form as { social_networks?: string[] }).social_networks ?? []).filter(
        Boolean,
      );
      const extra = form as unknown as {
        subheadline?: string | null;
        slides?: unknown;
        script?: string | null;
      };
      const cleanSlides = Array.isArray(extra.slides)
        ? (extra.slides as unknown[]).filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0,
          )
        : null;
      const payload = {
        title: form.title!,
        extra_request_id: form.extra_request_id || null,
        client_id: form.client_id || null,
        social_network: networks[0] ?? null,
        social_networks: networks,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        objective: form.objective || null,
        format: form.format || null,
        theme: form.theme || null,
        pillar: form.pillar || null,
        headline: form.headline || null,
        subheadline: extra.subheadline || null,
        slides: cleanSlides && cleanSlides.length > 0 ? cleanSlides : null,
        script: extra.script || null,
        caption: form.caption ? sanitizeHtml(form.caption) : null,
        cta: form.cta || null,
        hashtags: form.hashtags || null,
        status: (form.status ?? "idea") as PostStatus,
        recurrence: recurrence.frequency === "none" ? null : recurrence,
      };
      if (isEdit && post) {
        const { data, error } = await supabase.rpc("save_calendar_post", {
          _post_id: post.id,
          _expected_updated_at: version.current,
          _patch: payload as Json,
        });
        if (error) throw error;
        const saved = data as unknown as Post;
        version.current = saved.updated_at;
        baseline.current = saved;
        setForm(saved);
        setRecurrence((saved.recurrence as RecurrenceRule | null) ?? { frequency: "none" });
        return post.id;
      } else {
        const { data, error } = await supabase
          .from("posts")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("*")
          .single();
        if (error) throw error;
        // recurrence: spawn extra occurrences
        if (
          recurrence.frequency !== "none" &&
          payload.scheduled_date &&
          (recurrence.count ?? 0) > 1
        ) {
          const extras = buildRecurrenceDates(payload.scheduled_date, recurrence).slice(1);
          if (extras.length > 0) {
            await supabase.from("posts").insert(
              extras.map((d) => ({
                ...payload,
                scheduled_date: d,
                created_by: user?.id ?? null,
                recurrence: null,
              })),
            );
          }
        }
        onCreated?.(data);
        return data.id;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Post atualizado" : "Post criado");
      void refreshPostViews(qc);
      setLastSaved(true);
      if (!persistent) onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post removido");
      qc.invalidateQueries({ queryKey: ["posts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { id, created_at, updated_at, ...rest } = post;
      void id;
      void created_at;
      void updated_at;
      const { error } = await supabase.from("posts").insert({
        ...rest,
        title: `${post.title} (cópia)`,
        status: "idea",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post duplicado");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await supabase.from("tasks").insert({
        title: `Publicação: ${post.title}`,
        description: post.headline ?? null,
        status: "todo",
        priority: "medium",
        client_id: post.client_id ?? null,
        due_date: post.scheduled_date ? new Date(post.scheduled_date).toISOString() : null,
        source_post_id: post.id,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa criada a partir do post");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- File upload
  const [uploading, setUploading] = useState(false);
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || !post?.id) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const path = `${post.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("post-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: saved, error: insErr } = await supabase.rpc("change_calendar_media", {
          _post_id: post.id,
          _expected_updated_at: version.current,
          _action: "attach",
          _file: {
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          },
        });
        if (insErr) throw insErr;
        reconcile(saved as unknown as Post, false);
      }
      qc.invalidateQueries({ queryKey: ["post-files", post.id] });
      qc.invalidateQueries({ queryKey: ["post-creative-signed", post.id] });
      void refreshPostViews(qc);
      toast.success("Arquivo(s) salvo(s). Conteúdos aprovados precisam de nova revisão.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const changeMedia = async (action: string, file: Json) => {
    if (!post || uploading || saveMutation.isPending) return;
    setUploading(true);
    try {
      const { data, error } = await supabase.rpc("change_calendar_media", {
        _post_id: post.id,
        _expected_updated_at: version.current,
        _action: action,
        _file: file,
      });
      if (error) throw error;
      reconcile(data as unknown as Post, false);
      await refreshPostViews(qc);
      toast.success("Mídias atualizadas. Alterações exigem nova revisão quando aplicável.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const removeFile = (f: PostFile) => void changeMedia("remove", { id: f.id });
  const moveFile = (index: number, direction: number) => {
    const ids = files.map((f) => f.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void changeMedia("order", { ids });
  };

  // ---- Comments
  const sendComment = async () => {
    if (!post?.id || !user?.id || !newComment.trim()) return;
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      author_id: user.id,
      content: newComment.trim(),
      is_internal: internalComment,
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  };

  const updateComment = async () => {
    if (!post?.id || !editingCommentId || !editingCommentContent.trim()) return;
    const { error } = await supabase
      .from("post_comments")
      .update({ content: editingCommentContent.trim() })
      .eq("id", editingCommentId);
    if (error) return toast.error(error.message);
    setEditingCommentId(null);
    setEditingCommentContent("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    toast.success("Comentário atualizado");
  };

  const deleteComment = async (id: string) => {
    if (!post?.id) return;
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    toast.success("Comentário excluído");
  };

  const Header = persistent ? "div" : SheetHeader;
  const Title = persistent ? "h2" : SheetTitle;
  const content = (
    <>
      <Header className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <Title className="text-base font-semibold">
            {isEdit ? "Editar publicação" : "Nova publicação"}
          </Title>
          <div className="flex items-center gap-1">
            {readOnly && (
              <p role="alert" className="text-sm text-destructive">
                Edição indisponível para sua permissão atual. Seu rascunho foi mantido.
              </p>
            )}
            {persistent && (
              <>
                <Button size="sm" variant="ghost" onClick={onMinimize}>
                  Minimizar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => request(() => onOpenChange(false))}
                  aria-label="Fechar editor"
                >
                  <X className="size-4" />
                </Button>
              </>
            )}
            {isEdit && !persistent && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createTaskMutation.mutate()}
                  disabled={createTaskMutation.isPending}
                  title="Criar tarefa a partir do post"
                >
                  <CheckSquare className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => duplicateMutation.mutate()}
                  title="Duplicar"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate()}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {persistent && (
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {post?.title ?? "Nova publicação"} ·{" "}
            {clients.find((c) => c.id === (post?.client_id ?? form.client_id))?.name ??
              "Conta original"}
          </p>
        )}
      </Header>

      <ScrollArea className={persistent ? "min-h-0 flex-1" : "h-[calc(100vh-9rem)]"}>
        {isEdit && (
          <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
            <Button size="sm" variant="outline" onClick={() => setShowHistory(true)}>
              Prévia, aprovação e histórico
            </Button>
            {permissions.can("workspace.tasks", "create") && (
              <Button size="sm" variant="ghost" onClick={() => createTaskMutation.mutate()}>
                Criar tarefa vinculada
              </Button>
            )}
          </div>
        )}
        <fieldset
          disabled={saveMutation.isPending || readOnly}
          className="min-w-0 space-y-6 px-6 py-5"
        >
          <label className="mb-4 block text-sm font-medium">
            Entrega do plano ou extra
            <select
              className="mt-2 block min-h-11 w-full rounded border bg-background px-3"
              value={form.extra_request_id ?? ""}
              onChange={(e) => update("extra_request_id", e.target.value || null)}
            >
              <option value="">Entrega do plano</option>
              {extras.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} · orçamento aceito
                </option>
              ))}
            </select>
          </label>
          {/* Title + status */}
          <div className="space-y-2">
            <Input
              value={form.title ?? ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Título da publicação"
              className="h-11 border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={form.status ?? "idea"}
                onValueChange={(v) => update("status", v as PostStatus)}
              >
                <SelectTrigger className="h-7 w-auto gap-1.5 border-0 bg-muted px-2 text-xs">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      statusMeta((form.status ?? "idea") as PostStatus).dot,
                    )}
                  />
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
            </div>
          </div>

          <Separator />

          {/* Properties grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <Select
                disabled={isEdit}
                value={form.client_id ?? "none"}
                onValueChange={(v) => update("client_id", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Redes sociais">
              <div className="flex flex-wrap gap-1.5">
                {SOCIAL_NETWORKS.map((n) => {
                  const list = (form as { social_networks?: string[] }).social_networks ?? [];
                  const active = list.includes(n);
                  return (
                    <button
                      type="button"
                      key={n}
                      onClick={() => {
                        const next = active ? list.filter((x) => x !== n) : [...list, n];
                        setForm((f) => ({ ...f, social_networks: next }) as Partial<Post>);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Data">
              <Input
                type="date"
                value={form.scheduled_date ?? ""}
                onChange={(e) => update("scheduled_date", e.target.value || null)}
              />
            </Field>
            <Field label="Hora">
              <Input
                type="time"
                value={form.scheduled_time ?? ""}
                onChange={(e) => update("scheduled_time", e.target.value || null)}
              />
            </Field>
            <Field label="Objetivo">
              <Select
                value={form.objective ?? "none"}
                onValueChange={(v) => update("objective", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {POST_OBJECTIVES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Formato">
              <Select
                value={form.format ?? "none"}
                onValueChange={(v) => update("format", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {POST_FORMATS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tema">
              <Input
                value={form.theme ?? ""}
                onChange={(e) => update("theme", e.target.value || null)}
                placeholder="Ex: Lançamento"
              />
            </Field>
            <Field label="Pilar">
              <Input
                value={form.pillar ?? ""}
                onChange={(e) => update("pillar", e.target.value || null)}
                placeholder="Ex: Autoridade"
              />
            </Field>
          </div>

          <Separator />

          {(() => {
            const fmt = (form.format ?? "").toLowerCase();
            const isCarousel = fmt === "carrossel";
            const isReels = fmt === "reels" || fmt === "vídeo" || fmt === "video" || fmt === "live";
            const slides: string[] = Array.isArray((form as unknown as { slides?: unknown }).slides)
              ? ((form as unknown as { slides: unknown[] }).slides.filter(
                  (s) => typeof s === "string",
                ) as string[])
              : [];
            const setSlides = (next: string[]) =>
              setForm(
                (f) => ({ ...(f as Partial<Post>), slides: next }) as unknown as Partial<Post>,
              );
            const script = (form as unknown as { script?: string | null }).script ?? "";
            const subheadline =
              (form as unknown as { subheadline?: string | null }).subheadline ?? "";

            return (
              <>
                {isCarousel ? (
                  <Field label={`Slides (${slides.length})`}>
                    <div className="space-y-2">
                      {slides.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-2 w-6 shrink-0 text-center text-[10px] font-medium text-muted-foreground">
                            {i + 1}
                          </span>
                          <Textarea
                            rows={2}
                            value={s}
                            onChange={(e) => {
                              const next = [...slides];
                              next[i] = e.target.value;
                              setSlides(next);
                            }}
                            placeholder={`Conteúdo do slide ${i + 1}`}
                            className="resize-none text-sm"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSlides(slides.filter((_, idx) => idx !== i))}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSlides([...slides, ""])}
                        className="h-8 gap-1 text-xs"
                      >
                        + Adicionar slide
                      </Button>
                    </div>
                  </Field>
                ) : isReels ? (
                  <Field label="Roteiro do vídeo">
                    <Textarea
                      rows={6}
                      value={script}
                      onChange={(e) =>
                        setForm(
                          (f) =>
                            ({
                              ...(f as Partial<Post>),
                              script: e.target.value,
                            }) as unknown as Partial<Post>,
                        )
                      }
                      placeholder="Ex: Cena 1 – Abertura com pergunta&#10;Cena 2 – Desenvolvimento&#10;Cena 3 – CTA"
                      className="resize-none text-sm"
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Headline">
                      <Input
                        value={form.headline ?? ""}
                        onChange={(e) => update("headline", e.target.value || null)}
                        placeholder="Chamada principal"
                      />
                    </Field>
                    <Field label="Subheadline">
                      <Input
                        value={subheadline}
                        onChange={(e) =>
                          setForm(
                            (f) =>
                              ({
                                ...(f as Partial<Post>),
                                subheadline: e.target.value || null,
                              }) as unknown as Partial<Post>,
                          )
                        }
                        placeholder="Complemento da chamada"
                      />
                    </Field>
                  </>
                )}

                <Field label="Legenda">
                  <RichTextEditor
                    disabled={saveMutation.isPending || readOnly}
                    value={form.caption ?? ""}
                    onChange={(html) => update("caption", html)}
                    placeholder="Escreva a legenda..."
                  />
                </Field>
              </>
            );
          })()}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CTA">
              <Input
                value={form.cta ?? ""}
                onChange={(e) => update("cta", e.target.value || null)}
                placeholder="Saiba mais →"
              />
            </Field>
            <Field label="Hashtags">
              <Input
                value={form.hashtags ?? ""}
                onChange={(e) => update("hashtags", e.target.value || null)}
                placeholder="#marketing #social"
              />
            </Field>
          </div>

          <Separator />

          {/* Recurrence */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Repeat className="h-3.5 w-3.5" /> Recorrência
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={recurrence.frequency}
                onValueChange={(v) =>
                  setRecurrence((r) => ({ ...r, frequency: v as RecurrenceRule["frequency"] }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
              {recurrence.frequency !== "none" && (
                <>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={recurrence.count ?? 4}
                    onChange={(e) =>
                      setRecurrence((r) => ({ ...r, count: Number(e.target.value) || 1 }))
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    ocorrências (incluindo esta)
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Files (edit only) */}
          {isEdit && (
            <>
              <Separator />
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" /> Arquivos ({files.length})
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={onUpload}
                      disabled={uploading || saveMutation.isPending || readOnly}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-muted">
                      {uploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Paperclip className="h-3 w-3" />
                      )}
                      Adicionar
                    </span>
                  </label>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Mídias são salvas imediatamente. Para substituir, adicione o novo arquivo e remova
                  o anterior. As versões anteriores são preservadas.
                </p>
                {filesLoading && (
                  <p role="status" className="text-xs">
                    Carregando mídias…
                  </p>
                )}
                {filesError && (
                  <p role="alert" className="text-sm text-destructive">
                    Não foi possível carregar as mídias.
                  </p>
                )}
                {files.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhum arquivo anexado
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {files.map((f, index) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate text-xs">{f.file_name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round((f.size_bytes ?? 0) / 1024)} KB
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={uploading || index === 0}
                          aria-label={`Mover ${f.file_name} para cima`}
                          onClick={() => moveFile(index, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={uploading || index === files.length - 1}
                          aria-label={`Mover ${f.file_name} para baixo`}
                          onClick={() => moveFile(index, 1)}
                        >
                          ↓
                        </Button>
                        <button
                          disabled={uploading}
                          aria-label={`Remover ${f.file_name}`}
                          onClick={() => removeFile(f)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />
              <div id="post-comments-section">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Comentários ({comments.length})
                </div>
                <div className="space-y-2">
                  {comments.map((c) => {
                    const author = authorMap.get(c.author_id);
                    const isClient = clientUserId && c.author_id === clientUserId;
                    const canManageComment = c.author_id === user?.id || user?.id !== clientUserId;
                    const isEditingComment = editingCommentId === c.id;
                    return (
                      <div
                        key={c.id}
                        id={`comment-${c.id}`}
                        className={cn(
                          "rounded-md bg-muted/50 px-3 py-2 transition-shadow",
                          focusedCommentId === c.id &&
                            "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium">{author?.name ?? "Usuário"}</span>
                            <Badge
                              variant={isClient ? "default" : "secondary"}
                              className="h-4 px-1.5 text-[9px]"
                            >
                              {c.is_internal
                                ? "Interno"
                                : isClient
                                  ? "Cliente"
                                  : "Visível ao cliente"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(c.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                          {canManageComment && (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditingCommentContent(c.content);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => deleteComment(c.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {isEditingComment ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              rows={2}
                              value={editingCommentContent}
                              onChange={(e) => setEditingCommentContent(e.target.value)}
                              className="resize-none text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCommentId(null)}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={updateComment}
                                disabled={!editingCommentContent.trim()}
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                        )}
                      </div>
                    );
                  })}
                  {comments.length === 0 && (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum comentário ainda
                    </p>
                  )}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={internalComment}
                    onChange={(e) => setInternalComment(e.target.checked)}
                  />
                  Comentário interno (somente equipe)
                </label>
                <div className="mt-2 flex items-end gap-2">
                  <Textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicionar comentário..."
                    className="resize-none text-sm"
                  />
                  <Button size="sm" onClick={sendComment} disabled={!newComment.trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </fieldset>
      </ScrollArea>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-6 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <p role="status" className="mr-auto text-xs text-muted-foreground">
          {saveMutation.isPending
            ? "Salvando…"
            : dirty
              ? "Alterações não salvas"
              : lastSaved
                ? "Salvo"
                : ""}
        </p>
        <Button variant="ghost" onClick={() => request(() => onOpenChange(false))}>
          Fechar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || uploading || readOnly}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar" : "Criar"}
        </Button>
      </div>
      {saveMutation.error && (
        <p role="alert" className="px-6 pb-3 text-sm text-destructive">
          {saveMutation.error.message}{" "}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              request(async () => {
                if (!post) return;
                const { data, error } = await supabase
                  .from("posts")
                  .select("*")
                  .eq("id", post.id)
                  .single();
                if (error) {
                  toast.error(error.message);
                  return;
                }
                baseline.current = data;
                version.current = data.updated_at;
                setForm(data);
                setRecurrence((data.recurrence as RecurrenceRule | null) ?? { frequency: "none" });
                saveMutation.reset();
              })
            }
          >
            Carregar versão atual
          </Button>
        </p>
      )}
    </>
  );
  return (
    <>
      {persistent ? (
        <aside
          aria-label="Editor da publicação"
          ref={panelRef}
          tabIndex={-1}
          style={{ display: minimized ? "none" : undefined }}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-white shadow-sm lg:top-14 lg:w-[420px] xl:w-[480px]"
        >
          {content}
        </aside>
      ) : (
        <Sheet
          open={open}
          onOpenChange={(value) => {
            if (!value) request(() => onOpenChange(false));
          }}
        >
          <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">{content}</SheetContent>
        </Sheet>
      )}
      <Dialog
        open={!!pendingAction}
        onOpenChange={(value) => {
          if (!value) setPendingAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Há alterações não salvas</DialogTitle>
            <DialogDescription>
              Salve o rascunho antes de continuar ou descarte os campos alterados. Mídias e
              comentários já enviados permanecem salvos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={saveMutation.isPending || uploading || readOnly}
              onClick={async () => {
                try {
                  await saveMutation.mutateAsync();
                  const action = pendingAction;
                  setPendingAction(null);
                  action?.();
                } catch {
                  /* draft remains open */
                }
              }}
            >
              Salvar
            </Button>
            <Button
              variant="outline"
              disabled={saveMutation.isPending || uploading}
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                action?.();
              }}
            >
              Descartar alterações
            </Button>
            <Button variant="ghost" onClick={() => setPendingAction(null)}>
              Continuar editando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {showHistory && post && (
        <ReviewDialog
          post={{ ...post, ...baseline.current } as Post}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function buildRecurrenceDates(start: string, r: RecurrenceRule): string[] {
  const out: string[] = [start];
  const count = Math.max(1, Math.min(52, r.count ?? 1));
  const d = new Date(start + "T00:00:00");
  const step = (date: Date) => {
    switch (r.frequency) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "biweekly":
        date.setDate(date.getDate() + 14);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        break;
    }
  };
  for (let i = 1; i < count; i++) {
    step(d);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
