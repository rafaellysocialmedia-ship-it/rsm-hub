import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LIBRARY_BUCKET, fileIconFor, isImage, isVideo, type FileRow } from "@/lib/library";

export function FileThumbnail({ file, size = "md" }: { file: FileRow; size?: "sm" | "md" | "lg" }) {
  const [url, setUrl] = useState<string | null>(null);
  const Icon = fileIconFor(file.mime_type, file.name);

  useEffect(() => {
    let active = true;
    if (isImage(file.mime_type) || isVideo(file.mime_type)) {
      supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(file.storage_path, 60 * 60).then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    }
    return () => { active = false; };
  }, [file.storage_path, file.mime_type]);

  const dims = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-40 w-full" : "h-28 w-full";

  if (url && isImage(file.mime_type)) {
    return <img src={url} alt={file.name} className={`${dims} rounded-lg object-cover`} loading="lazy" />;
  }
  if (url && isVideo(file.mime_type)) {
    return (
      <div className={`${dims} relative overflow-hidden rounded-lg bg-muted`}>
        <video src={url} className="h-full w-full object-cover" muted preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Icon className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      </div>
    );
  }
  return (
    <div className={`${dims} flex items-center justify-center rounded-lg bg-muted`}>
      <Icon className={size === "sm" ? "h-5 w-5 text-muted-foreground" : "h-10 w-10 text-muted-foreground"} />
    </div>
  );
}
