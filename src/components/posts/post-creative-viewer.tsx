import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileIcon, ImageIcon, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { PostFile } from "@/lib/posts";

type Signed = { file: PostFile; url: string | null };

export function usePostCreatives(postId: string | undefined) {
  const { data: files = [] } = useQuery({
    queryKey: ["post-files", postId],
    enabled: !!postId,
    queryFn: async () => {
      if (!postId) return [] as PostFile[];
      const { data, error } = await supabase
        .from("post_files")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PostFile[];
    },
  });

  const [signed, setSigned] = useState<Signed[]>([]);
  useEffect(() => {
    let active = true;
    if (!files.length) { setSigned([]); return; }
    Promise.all(
      files.map(async (f) => {
        const { data } = await supabase.storage.from("post-files").createSignedUrl(f.storage_path, 60 * 60);
        return { file: f, url: data?.signedUrl ?? null };
      }),
    ).then((rows) => { if (active) setSigned(rows); });
    return () => { active = false; };
  }, [files]);

  return signed;
}

export function PostCreativeThumb({ postId }: { postId: string }) {
  const items = usePostCreatives(postId);
  const first = items.find((i) => (i.file.mime_type ?? "").startsWith("image/")) ?? items[0];
  if (!items.length) return null;
  const mime = first?.file.mime_type ?? "";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
      {first?.url && mime.startsWith("image/") ? (
        <img src={first.url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : first?.url && mime.startsWith("video/") ? (
        <video src={first.url} className="h-full w-full object-cover" muted />
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

export function PostCreativeGallery({ postId, previewOnly = false }: { postId: string; previewOnly?: boolean }) {
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
        const media = url && mime.startsWith("image/") ? (
          <img src={url} alt={file.file_name} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
        ) : url && mime.startsWith("video/") ? (
          <video src={url} controls={!previewOnly} muted={previewOnly} className="aspect-square w-full object-cover" />
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
            <div key={file.id} className="group relative block overflow-hidden rounded-md border border-border bg-muted">
              {media}
            </div>
          );
        }

        return (
          <a key={file.id} href={url ?? "#"} target="_blank" rel="noreferrer"
            className="group relative block overflow-hidden rounded-md border border-border bg-muted">
            {media}
          </a>
        );
      })}
    </div>
  );
}
