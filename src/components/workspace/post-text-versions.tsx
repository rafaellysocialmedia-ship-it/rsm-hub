import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QueryState } from "./account-panels";
type Version = {
  id: string;
  version_number: number;
  created_at: string;
  title: string;
  caption: string | null;
  script: string | null;
  headline: string | null;
  slides: unknown;
};
export function PostTextVersions({ postId }: { postId: string }) {
  const q = useQuery({
    queryKey: ["shared-post-versions", postId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_post_versions", { _post_id: postId });
      if (error) throw error;
      return data as unknown as Version[];
    },
  });
  const [selected, setSelected] = useState("");
  const version = q.data?.find((v) => v.id === selected);
  if (!q.isLoading && !q.error && !q.data?.length) return null;
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="text-base font-medium">Histórico de versões do texto</h3>
      <QueryState loading={q.isLoading} error={q.error}>
        <select
          aria-label="Selecionar versão anterior"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Selecione uma versão anterior</option>
          {q.data?.map((v) => (
            <option key={v.id} value={v.id}>
              Versão {v.version_number} · {new Date(v.created_at).toLocaleString("pt-BR")}
            </option>
          ))}
        </select>
        {version && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registro anterior à alteração desta data. A aprovação se refere ao conteúdo atual.
            </p>
            <p className="font-medium">{version.title}</p>
            {version.headline && <p className="text-sm">{version.headline}</p>}
            {version.caption && (
              <div
                className="prose prose-sm max-w-none break-words dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(version.caption) }}
              />
            )}
            {version.script && <p className="whitespace-pre-wrap text-sm">{version.script}</p>}
            {Array.isArray(version.slides) &&
              version.slides.map((s, i) => (
                <p className="text-sm" key={i}>
                  {typeof s === "string" ? s : JSON.stringify(s)}
                </p>
              ))}
            <VersionComment key={version.id} postId={postId} version={version} />
          </div>
        )}
      </QueryState>
    </section>
  );
}
function VersionComment({ postId, version }: { postId: string; version: Version }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const comments = useQuery({
    queryKey: ["version-comments", version.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id,content,created_at")
        .eq("post_id", postId)
        .eq("version_id", version.id)
        .eq("is_internal", false)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta");
      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          version_id: version.id,
          author_id: user.id,
          is_internal: false,
          content: `[Versão ${version.version_number}] ${text.trim()}`,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      for (const key of ["version-comments", "portal-post-comments", "post-comments"])
        void qc.invalidateQueries({ queryKey: [key] });
      toast.success("Comentário vinculado à versão");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <QueryState loading={comments.isLoading} error={comments.error}>
        {comments.data?.map((c) => (
          <p key={c.id} className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {c.content}
          </p>
        ))}
      </QueryState>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Textarea
          aria-label="Comentário sobre esta versão"
          required
          minLength={2}
          maxLength={3000}
          placeholder="O que gostaria de comentar nesta versão?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={save.isPending}>
          Comentar esta versão
        </Button>
      </form>
    </div>
  );
}
