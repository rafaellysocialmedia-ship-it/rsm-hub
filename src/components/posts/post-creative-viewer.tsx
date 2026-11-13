import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileIcon, ImageIcon, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import type { PostFile } from "@/lib/posts";

type Signed = { file: PostFile; url: string | null };

const EMPTY_CREATIVES: Signed[] = [];
export function usePostCreativeQuery(postId: string | undefined) {
  return useQuery({
    queryKey: ["post-creative-signed", postId],
    enabled: !!postId,
    staleTime: 240000,
    refetchInterval: 240000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_files")
        .select("*")
        .eq("post_id", postId!)
        .order("sort_order")
        .order("created_at", { ascending: true })
        .order("id");
      if (error) throw error;
      return Promise.all(
        data.map(async (file) => {
          const { data, error } = await supabase.storage
            .from("post-files")
            .createSignedUrl(file.storage_path, 600);
          if (error) throw error;
          return { file, url: data.signedUrl };
        }),
      );
    },
  });
}
export function usePostCreatives(postId: string | undefined) {
  return usePostCreativeQuery(postId).data ?? EMPTY_CREATIVES;
}

export function PostCreativeThumb({
  postId,
  showEmpty = false,
  fit = "cover",
}: {
  postId: string;
  showEmpty?: boolean;
  fit?: "cover" | "contain";
}) {
  const query = usePostCreativeQuery(postId);
  const items = query.data ?? EMPTY_CREATIVES;
  const first = items[0];
  if (!items.length)
    return showEmpty ? (
      <div className="flex min-h-20 w-full flex-col py-3 items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground">
        <ImageIcon className="size-6" aria-hidden="true" />
        <span>
          {query.isPending
            ? "Carregando prévia…"
            : query.isError
              ? "Prévia indisponível"
              : "Somente texto · mídia não anexada"}
        </span>
      </div>
    ) : null;
  const mime = first?.file.mime_type ?? "";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
      {first?.url && mime.startsWith("image/") ? (
        <img
          draggable={false}
          src={first.url}
          alt=""
          className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
          loading="lazy"
        />
      ) : first?.url && mime.startsWith("video/") ? (
        <video
          draggable={false}
          src={first.url}
          className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
          muted
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
      {items.length > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] font-medium text-background">
          +{items.length - 1}
        </span>
      )}
    </div>
  );
}

export function PostCreativeGallery({
  postId,
  previewOnly = false,
}: {
  postId: string;
  previewOnly?: boolean;
}) {
  const items = usePostCreatives(postId);
  if (!items.length) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        <ImageIcon className="h-4 w-4" /> Sem criativo anexado ainda.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ file, url }) => {
        const mime = file.mime_type ?? "";
        const media =
          url && mime.startsWith("image/") ? (
            <img
              src={url}
              alt={file.file_name}
              className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : url && mime.startsWith("video/") ? (
            <video
              src={url}
              controls={!previewOnly}
              muted={previewOnly}
              className="aspect-square w-full object-cover"
            />
          ) : url ? (
            <div className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
              <FileIcon className="h-6 w-6" />
              <span className="line-clamp-2">{file.file_name}</span>
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          );

        if (previewOnly) {
          return (
            <div
              key={file.id}
              className="group relative block overflow-hidden rounded-md border border-border bg-muted"
            >
              {media}
            </div>
          );
        }

        return (
          <a
            key={file.id}
            href={url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="group relative block overflow-hidden rounded-md border border-border bg-muted"
          >
            {media}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Prévia dos criativos vinculados à publicação, exibida ao abrir o editor.
 * Não renderiza nada quando a publicação não tem mídia anexada.
 * Clicar em uma miniatura abre a mídia ampliada, com navegação entre os itens.
 */
export function PostCreativePreview({ postId }: { postId: string }) {
  const query = usePostCreativeQuery(postId);
  const items = query.data ?? EMPTY_CREATIVES;
  const [active, setActive] = useState<number | null>(null);

  // Mantém o índice válido quando uma mídia é removida com a ampliação aberta.
  useEffect(() => {
    if (active !== null && active >= items.length) setActive(items.length ? 0 : null);
  }, [active, items.length]);

  if (query.isPending) {
    return (
      <div
        role="status"
        className="flex h-24 items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando criativo…
      </div>
    );
  }
  if (query.isError) {
    return (
      <p role="alert" className="rounded-md border border-dashed border-border p-3 text-xs">
        Não foi possível carregar a prévia do criativo.
      </p>
    );
  }
  if (!items.length) return null;

  const current = active !== null ? items[active] : undefined;
  const step = (direction: number) =>
    setActive((value) =>
      value === null ? value : (value + direction + items.length) % items.length,
    );

  return (
    <section aria-label="Criativo vinculado" className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {items.length > 1 ? `Criativo · ${items.length} mídias` : "Criativo"}
      </div>
      <div className={items.length === 1 ? "grid grid-cols-1" : "flex gap-2 overflow-x-auto pb-1"}>
        {items.map(({ file, url }, index) => {
          const mime = file.mime_type ?? "";
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Ampliar ${file.file_name}`}
              title="Clique para ampliar"
              className={`group relative shrink-0 overflow-hidden rounded-md border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                items.length === 1 ? "w-full" : "h-40 w-32"
              }`}
            >
              {url && mime.startsWith("image/") ? (
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={
                    items.length === 1
                      ? "max-h-72 w-full object-contain"
                      : "h-full w-full object-cover"
                  }
                />
              ) : url && mime.startsWith("video/") ? (
                <video
                  src={url}
                  muted
                  preload="metadata"
                  className={
                    items.length === 1
                      ? "max-h-72 w-full object-contain"
                      : "h-full w-full object-cover"
                  }
                />
              ) : (
                <div className="flex h-24 w-full flex-col items-center justify-center gap-1 p-2 text-xs text-muted-foreground">
                  <FileIcon className="h-6 w-6" aria-hidden="true" />
                  <span className="line-clamp-2">{file.file_name}</span>
                </div>
              )}
              {mime.startsWith("video/") && (
                <span className="absolute bottom-1.5 left-1.5 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] font-medium text-background">
                  Vídeo
                </span>
              )}
              {items.length > 1 && (
                <span className="absolute right-1.5 top-1.5 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] font-medium text-background">
                  {index + 1}/{items.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={!!current} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent
          className="max-w-3xl"
          onKeyDown={(event) => {
            if (items.length < 2) return;
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
          }}
        >
          <DialogTitle className="truncate pr-8 text-sm">
            {current?.file.file_name ?? "Criativo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visualização ampliada do criativo vinculado à publicação.
          </DialogDescription>
          {current && (
            <div className="relative flex items-center justify-center rounded-md bg-muted">
              {current.url && (current.file.mime_type ?? "").startsWith("image/") ? (
                <img
                  src={current.url}
                  alt={current.file.file_name}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              ) : current.url && (current.file.mime_type ?? "").startsWith("video/") ? (
                <video
                  key={current.file.id}
                  src={current.url}
                  controls
                  className="max-h-[70vh] w-auto max-w-full"
                />
              ) : (
                <a
                  href={current.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-2 p-10 text-sm underline"
                >
                  <FileIcon className="h-8 w-8" aria-hidden="true" />
                  Abrir arquivo
                </a>
              )}
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Mídia anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow hover:bg-background"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Próxima mídia"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow hover:bg-background"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          )}
          {items.length > 1 && active !== null && (
            <p className="text-center text-xs text-muted-foreground">
              {active + 1} de {items.length}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
