import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Paperclip, Repeat, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  initial?: Partial<Post>;
  clients: Client[];
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

export function PostEditorSheet({ open, onOpenChange, post, initial, clients }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<Post>>(EMPTY);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: "none" });
  const isEdit = !!post;

  useEffect(() => {
    if (open) {
      setForm(post ?? { ...EMPTY, ...initial });
      setRecurrence(((post?.recurrence as RecurrenceRule | null) ?? { frequency: "none" }));
    }
  }, [open, post, initial]);

  const update = <K extends keyof Post>(k: K, v: Post[K] | null | undefined) =>
    setForm((f) => ({ ...f, [k]: v as Post[K] }));

  // ---- Files & comments queries (only when editing)
  const { data: files = [] } = useQuery({
    queryKey: ["post-files", post?.id],
    queryFn: async () => {
      if (!post?.id) return [] as PostFile[];
      const { data, error } = await supabase
        .from("post_files")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!post?.id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", post?.id],
    queryFn: async () => {
      if (!post?.id) return [] as PostComment[];
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!post?.id,
  });

  // ---- Save
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || form.title.trim().length === 0) throw new Error("Título obrigatório");
      const networks = ((form as { social_networks?: string[] }).social_networks ?? []).filter(Boolean);
      const payload = {
        title: form.title!,
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
        caption: form.caption || null,
        cta: form.cta || null,
        hashtags: form.hashtags || null,
        status: (form.status ?? "idea") as PostStatus,
        recurrence: recurrence.frequency === "none" ? null : recurrence,
      };
      if (isEdit && post) {
        const { error } = await supabase.from("posts").update(payload).eq("id", post.id);
        if (error) throw error;
        return post.id;
      } else {
        const { data, error } = await supabase
          .from("posts")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        // recurrence: spawn extra occurrences
        if (recurrence.frequency !== "none" && payload.scheduled_date && (recurrence.count ?? 0) > 1) {
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
        return data.id;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Post atualizado" : "Post criado");
      qc.invalidateQueries({ queryKey: ["posts"] });
      onOpenChange(false);
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
      const { error } = await supabase
        .from("posts")
        .insert({ ...rest, title: `${post.title} (cópia)`, status: "idea", created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post duplicado");
      qc.invalidateQueries({ queryKey: ["posts"] });
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
        const { error: insErr } = await supabase.from("post_files").insert({
          post_id: post.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: user?.id ?? null,
        });
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["post-files", post.id] });
      toast.success("Arquivo(s) enviado(s)");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeFile = async (f: PostFile) => {
    await supabase.storage.from("post-files").remove([f.storage_path]);
    await supabase.from("post_files").delete().eq("id", f.id);
    qc.invalidateQueries({ queryKey: ["post-files", post?.id] });
  };

  // ---- Comments
  const [newComment, setNewComment] = useState("");
  const sendComment = async () => {
    if (!post?.id || !user?.id || !newComment.trim()) return;
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      author_id: user.id,
      content: newComment.trim(),
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">
              {isEdit ? "Editar publicação" : "Nova publicação"}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {isEdit && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => duplicateMutation.mutate()} title="Duplicar">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate()} title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-9rem)]">
          <div className="space-y-6 px-6 py-5">
            {/* Title + status */}
            <div className="space-y-2">
              <Input
                value={form.title ?? ""}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Título da publicação"
                className="h-11 border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={form.status ?? "idea"} onValueChange={(v) => update("status", v as PostStatus)}>
                  <SelectTrigger className="h-7 w-auto gap-1.5 border-0 bg-muted px-2 text-xs">
                    <span className={cn("h-2 w-2 rounded-full", statusMeta((form.status ?? "idea") as PostStatus).dot)} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Properties grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Cliente">
                <Select value={form.client_id ?? "none"} onValueChange={(v) => update("client_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Rede social">
                <Select value={form.social_network ?? "none"} onValueChange={(v) => update("social_network", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {SOCIAL_NETWORKS.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data">
                <Input type="date" value={form.scheduled_date ?? ""} onChange={(e) => update("scheduled_date", e.target.value || null)} />
              </Field>
              <Field label="Hora">
                <Input type="time" value={form.scheduled_time ?? ""} onChange={(e) => update("scheduled_time", e.target.value || null)} />
              </Field>
              <Field label="Objetivo">
                <Select value={form.objective ?? "none"} onValueChange={(v) => update("objective", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {POST_OBJECTIVES.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Formato">
                <Select value={form.format ?? "none"} onValueChange={(v) => update("format", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {POST_FORMATS.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tema">
                <Input value={form.theme ?? ""} onChange={(e) => update("theme", e.target.value || null)} placeholder="Ex: Lançamento" />
              </Field>
              <Field label="Pilar">
                <Input value={form.pillar ?? ""} onChange={(e) => update("pillar", e.target.value || null)} placeholder="Ex: Autoridade" />
              </Field>
            </div>

            <Separator />

            <Field label="Headline">
              <Input value={form.headline ?? ""} onChange={(e) => update("headline", e.target.value || null)} placeholder="Chamada principal" />
            </Field>

            <Field label="Legenda">
              <RichTextEditor
                value={form.caption ?? ""}
                onChange={(html) => update("caption", html)}
                placeholder="Escreva a legenda..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="CTA">
                <Input value={form.cta ?? ""} onChange={(e) => update("cta", e.target.value || null)} placeholder="Saiba mais →" />
              </Field>
              <Field label="Hashtags">
                <Input value={form.hashtags ?? ""} onChange={(e) => update("hashtags", e.target.value || null)} placeholder="#marketing #social" />
              </Field>
            </div>

            <Separator />

            {/* Recurrence */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Repeat className="h-3.5 w-3.5" /> Recorrência
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={recurrence.frequency} onValueChange={(v) => setRecurrence((r) => ({ ...r, frequency: v as RecurrenceRule["frequency"] }))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
                      onChange={(e) => setRecurrence((r) => ({ ...r, count: Number(e.target.value) || 1 }))}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">ocorrências (incluindo esta)</span>
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
                        disabled={uploading}
                      />
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-muted">
                        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                        Adicionar
                      </span>
                    </label>
                  </div>
                  {files.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum arquivo anexado
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {files.map((f) => (
                        <li key={f.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate text-xs">{f.file_name}</span>
                          <span className="text-[10px] text-muted-foreground">{Math.round((f.size_bytes ?? 0) / 1024)} KB</span>
                          <button onClick={() => removeFile(f)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Comentários ({comments.length})</div>
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(c.created_at), "dd/MM HH:mm")}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.content}</p>
                      </div>
                    ))}
                  </div>
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
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
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
      case "daily": date.setDate(date.getDate() + 1); break;
      case "weekly": date.setDate(date.getDate() + 7); break;
      case "biweekly": date.setDate(date.getDate() + 14); break;
      case "monthly": date.setMonth(date.getMonth() + 1); break;
      default: break;
    }
  };
  for (let i = 1; i < count; i++) {
    step(d);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
