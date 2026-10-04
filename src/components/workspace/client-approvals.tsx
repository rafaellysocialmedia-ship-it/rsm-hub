import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ReviewDialog, invalidateReviews } from "@/components/approval/review-dialog";
import { PostCreativeThumb } from "@/components/posts/post-creative-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QueryState } from "./account-panels";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { toast } from "sonner";
export function ClientPortal({
  defaultTab = "pending",
  clientId,
}: {
  defaultTab?: string;
  clientId?: string;
}) {
  const { hasRole } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const [filter, setFilter] = useState(defaultTab),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [open, setOpen] = useState<Post | null>(null),
    [confirm, setConfirm] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");
  const accounts = useQuery({
    queryKey: ["approval-active-clients"],
    enabled: staff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("status", "active")
        .eq("churned", false);
      if (error) throw error;
      return data;
    },
  });
  const q = useQuery({
    queryKey: ["portal-posts", clientId, staff, accounts.data?.map((c) => c.id).join(",")],
    enabled: !staff || !!accounts.data,
    refetchInterval: 15000,
    queryFn: async () => {
      let query = supabase
        .from("portal_posts")
        .select("*")
        .order("scheduled_date", { nullsFirst: false });
      if (clientId) query = query.eq("client_id", clientId);
      else if (staff) query = query.in("client_id", accounts.data?.map((c) => c.id) ?? []);
      const { data, error } = await query;
      if (error) throw error;
      return data as Post[];
    },
  });
  const permissions = useQuery({
    queryKey: ["approval-batch-permissions", q.data?.[0]?.client_id],
    enabled: !!q.data?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_settings")
        .select("can_approve")
        .eq("client_id", q.data![0].client_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const list = (q.data ?? []).filter(
    (p) =>
      (!accountFilter || p.client_id === accountFilter) &&
      (filter === "all" ||
        (filter === "pending"
          ? ["review", "changes_requested"].includes(p.status)
          : p.status === filter)) &&
      p.title.toLowerCase().includes(search.toLowerCase()),
  );
  const chosen = list.filter(
    (p) => selected.includes(p.id) && ["review", "changes_requested"].includes(p.status),
  );
  const batch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("decide_my_account_posts", {
        _items: chosen.map((p) => ({ id: p.id, updated_at: p.updated_at })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${chosen.length} conteúdo(s) aprovado(s)`);
      setSelected([]);
      setConfirm(false);
      invalidateReviews(qc);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirm(false);
      void q.refetch();
    },
  });
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {filter === "pending" ? "Conteúdos para revisar" : "Seus conteúdos"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra a prévia para conferir a arte, a legenda e conversar com a equipe.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{list.length} conteúdo(s)</span>
      </header>
      <div className="flex flex-wrap gap-3">
        {staff && !clientId && (
          <select
            className="min-h-11 rounded border bg-card px-3 text-sm"
            aria-label="Cliente"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">Todos os clientes ativos</option>
            {accounts.data?.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <Input
          className="w-full sm:max-w-xs"
          placeholder="Buscar conteúdo"
          aria-label="Buscar conteúdo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="min-h-11 rounded-md border bg-card px-3"
          aria-label="Filtrar status"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setSelected([]);
          }}
        >
          <option value="pending">Aguardando revisão</option>
          <option value="all">Todos os conteúdos</option>
          <option value="approved">Aprovados</option>
          <option value="scheduled">Agendados</option>
          <option value="published">Publicados</option>
        </select>
        {!staff && permissions.data?.can_approve && chosen.length > 0 && (
          <Button onClick={() => setConfirm(true)}>Aprovar {chosen.length} selecionado(s)</Button>
        )}
      </div>
      <QueryState
        loading={q.isLoading || (staff && accounts.isLoading)}
        error={q.error || accounts.error}
        empty={!list.length}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-xl border bg-card">
              <button className="block w-full p-3 text-left" onClick={() => setOpen(p)}>
                <PostCreativeThumb postId={p.id} />
                <Badge className={`mt-3 ${statusMeta(p.status).tone}`} variant="outline">
                  {statusMeta(p.status).label}
                </Badge>
                <h3 className="mt-2 font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {postNetworks(p).join(" · ")} · {p.format || "Formato a definir"}
                </p>
                <p className="mt-1 text-sm">
                  {p.scheduled_date
                    ? new Date(p.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR")
                    : "Data a definir"}{" "}
                  · Versão {p.content_revision}
                </p>
                <span className="mt-3 block text-sm font-medium text-primary">Abrir revisão →</span>
              </button>
              {!staff &&
                permissions.data?.can_approve &&
                ["review", "changes_requested"].includes(p.status) && (
                  <label className="flex min-h-11 items-center gap-2 border-t px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, p.id] : s.filter((id) => id !== p.id),
                        )
                      }
                    />
                    Selecionar para aprovação
                  </label>
                )}
            </article>
          ))}
        </div>
      </QueryState>
      {open && <ReviewDialog key={open.id} post={open} onClose={() => setOpen(null)} />}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar {chosen.length} conteúdo(s)?</DialogTitle>
            <DialogDescription>
              Confirme que revisou as artes e legendas das versões selecionadas. Se algum conteúdo
              tiver sido alterado, nenhuma aprovação deste lote será aplicada.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={batch.isPending || !chosen.length || chosen.length > 50}
            onClick={() => batch.mutate()}
          >
            Confirmar {chosen.length} aprovação(ões)
          </Button>
          {chosen.length > 50 && <p>Selecione no máximo 50 por vez.</p>}
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Voltar à revisão
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
