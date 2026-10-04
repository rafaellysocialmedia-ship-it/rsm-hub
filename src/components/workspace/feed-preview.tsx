import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Layers, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { statusMeta, type Post } from "@/lib/posts";
import { dateLabel } from "@/lib/retention";
import { ClientLogo } from "@/components/clients/client-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostCreativeGallery } from "@/components/posts/post-creative-viewer";
import { QueryState } from "./account-panels";
type FeedPost = Pick<
  Post,
  "id" | "title" | "caption" | "scheduled_date" | "scheduled_time" | "format" | "status"
>;
export function FeedPreview({
  clientId,
  name,
  logo,
}: {
  clientId: string;
  name: string;
  logo?: string | null;
}) {
  const [month, setMonth] = useState(""),
    [status, setStatus] = useState("all"),
    [limit, setLimit] = useState(30),
    [selected, setSelected] = useState<FeedPost | null>(null);
  const q = useQuery({
    queryKey: ["experience", "feed", clientId, month, status, limit],
    refetchInterval: 30000,
    queryFn: async () => {
      let req = supabase
        .from("portal_posts")
        .select("id,title,caption,scheduled_date,scheduled_time,format,status", { count: "exact" })
        .eq("client_id", clientId)
        .or("social_network.ilike.Instagram,social_networks.cs.{Instagram}")
        .in("format", ["Feed", "Reels", "Carrossel", "Vídeo"])
        .in(
          "status",
          status === "all"
            ? ["approved", "to_schedule", "scheduled", "published"]
            : status === "approved"
              ? ["approved", "to_schedule"]
              : [status as Post["status"]],
        )
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .order("scheduled_time", { ascending: false })
        .order("id")
        .range(0, limit - 1);
      if (month) {
        const [year, m] = month.split("-").map(Number);
        const next = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
        req = req.gte("scheduled_date", month + "-01").lt("scheduled_date", next);
      }
      const { data, error, count } = await req;
      if (error) throw error;
      return { posts: data ?? [], count: count ?? 0 };
    },
  });
  const ids = (q.data?.posts ?? []).map((p) => p.id);
  const media = useQuery({
    queryKey: ["experience", "feed-media", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 20 * 60 * 1000,
    queryFn: async () => {
      const { data: files, error } = await supabase
        .from("post_files")
        .select("post_id,storage_path,mime_type,created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const covers = ids
        .map((id) => {
          const row = files?.filter((f) => f.post_id === id) ?? [];
          return (
            row.find((f) => (f.mime_type ?? "").startsWith("image/")) ??
            row.find((f) => (f.mime_type ?? "").startsWith("video/"))
          );
        })
        .filter((f) => !!f);
      if (!covers.length) return {} as Record<string, { url: string | null; video: boolean }>;
      const { data: signed, error: signError } = await supabase.storage
        .from("post-files")
        .createSignedUrls(
          covers.map((f) => f.storage_path),
          3600,
        );
      if (signError) throw signError;
      return Object.fromEntries(
        covers.map((f, i) => [
          f.post_id,
          { url: signed?.[i]?.signedUrl ?? null, video: (f.mime_type ?? "").startsWith("video/") },
        ]),
      );
    },
  });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Prévia do feed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Publicações do Instagram aprovadas, programadas e publicadas, na ordem das datas
          planejadas.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Filtrar feed por mês"
          type="month"
          className="w-auto"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setLimit(30);
          }}
        />
        <select
          aria-label="Filtrar situação do feed"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setLimit(30);
          }}
        >
          <option value="all">Todas as situações</option>
          <option value="approved">Aprovados</option>
          <option value="scheduled">Programados</option>
          <option value="published">Publicados</option>
        </select>
        {month && (
          <Button variant="ghost" onClick={() => setMonth("")}>
            Todos os meses
          </Button>
        )}
      </div>
      <QueryState loading={q.isLoading} error={q.error}>
        <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-4 border-b p-5">
            <ClientLogo path={logo ?? null} name={name} className="h-14 w-14" />
            <div>
              <h3 className="font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {q.data?.count ?? 0} publicação(ões) neste filtro
              </p>
            </div>
          </div>
          {media.error && (
            <p role="alert" className="p-4 text-sm text-destructive">
              Não foi possível carregar as capas.{" "}
              <button className="underline" onClick={() => void media.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!ids.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma publicação aprovada, programada ou publicada para este filtro.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {q.data?.posts.map((p) => {
                const cover = media.data?.[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    aria-label={`Abrir ${p.title}, ${statusMeta(p.status).label}`}
                    className="group relative aspect-square overflow-hidden bg-muted focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {cover?.url ? (
                      cover.video ? (
                        <video
                          src={cover.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={cover.url}
                          alt={p.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      )
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                        <span className="line-clamp-3 text-sm">{p.title}</span>
                      </div>
                    )}
                    {p.format === "Carrossel" && (
                      <Layers className="absolute right-2 top-2 h-5 w-5 text-white drop-shadow" />
                    )}
                    {["Reels", "Vídeo"].includes(p.format ?? "") && (
                      <Film className="absolute right-2 top-2 h-5 w-5 text-white drop-shadow" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-1 text-xs text-white">
                      {statusMeta(p.status).label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {(q.data?.count ?? 0) > ids.length && (
          <div className="text-center">
            <Button variant="outline" onClick={() => setLimit((n) => n + 30)}>
              Carregar mais publicações
            </Button>
          </div>
        )}
      </QueryState>
      <p className="text-sm text-muted-foreground">
        Simulação com os criativos anexados. Stories não aparecem aqui. A prévia não publica no
        Instagram nem altera o calendário.
      </p>
      {selected && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{statusMeta(selected.status).label}</Badge>
              <span className="text-sm text-muted-foreground">
                {dateLabel(selected.scheduled_date)}
                {selected.scheduled_time && ` · ${selected.scheduled_time.slice(0, 5)}`}
              </span>
            </div>
            <PostCreativeGallery postId={selected.id} />
            {selected.caption ? (
              <div
                className="prose prose-sm max-w-none text-sm dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.caption) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Legenda ainda não cadastrada.</p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
