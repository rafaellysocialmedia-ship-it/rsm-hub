import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Post } from "@/lib/posts";
export function ReviewLinks({ post }: { post: Post }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(7),
    [url, setUrl] = useState("");
  const q = useQuery({
    queryKey: ["approval-links", post.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_links")
        .select("id,revision,expires_at,revoked_at")
        .eq("post_id", post.id)
        .order("expires_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_approval_link", {
        _post_id: post.id,
        _days: days,
      });
      if (error) throw error;
      return data as { token: string };
    },
    onSuccess: (data) => {
      setUrl(`${window.location.origin}/review/${data.token}`);
      void qc.invalidateQueries({ queryKey: ["approval-links", post.id] });
      toast.success("Link criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("approval_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setUrl("");
      void qc.invalidateQueries({ queryKey: ["approval-links", post.id] });
      toast.success("Link revogado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">Compartilhar para aprovação</h3>
      <p className="text-sm text-muted-foreground">
        O link abre somente este conteúdo. É necessário entrar com o acesso do cliente vinculado.
        Alterar o conteúdo invalida o link.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Validade do link"
          className="rounded-md border bg-background px-3"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[1, 7, 14, 30].map((n) => (
            <option key={n} value={n}>
              {n} dia(s)
            </option>
          ))}
        </select>
        <Button
          disabled={create.isPending || !["review", "changes_requested"].includes(post.status)}
          onClick={() => create.mutate()}
        >
          Criar link
        </Button>
      </div>
      {url && (
        <div className="space-y-2">
          <input
            readOnly
            aria-label="Link de aprovação"
            value={url}
            className="w-full rounded border p-2 text-sm"
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Link copiado para compartilhar");
              } catch {
                toast.error("Selecione e copie o link acima.");
              }
            }}
          >
            Copiar link
          </Button>
        </div>
      )}
      {q.error && <p role="alert">Não foi possível consultar os links.</p>}
      {q.data?.map((l) => (
        <div
          key={l.id}
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm"
        >
          <span>
            Versão {l.revision} ·{" "}
            {l.revoked_at
              ? "Revogado"
              : new Date(l.expires_at) < new Date()
                ? "Expirado"
                : `Válido até ${new Date(l.expires_at).toLocaleDateString("pt-BR")}`}
          </span>
          {!l.revoked_at && new Date(l.expires_at) > new Date() && (
            <Button
              size="sm"
              variant="outline"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(l.id)}
            >
              Revogar
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
