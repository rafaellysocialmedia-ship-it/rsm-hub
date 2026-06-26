import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/clients";
import { cn } from "@/lib/utils";

const cache = new Map<string, string>();

export function ClientLogo({
  path,
  name,
  className,
}: {
  path: string | null;
  name: string | null;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(path ? cache.get(path) ?? null : null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    if (cache.has(path)) {
      setUrl(cache.get(path)!);
      return;
    }
    if (/^https?:\/\//.test(path)) {
      cache.set(path, path);
      setUrl(path);
      return;
    }
    let active = true;
    supabase.storage
      .from("client-logos")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active && data?.signedUrl) {
          cache.set(path, data.signedUrl);
          setUrl(data.signedUrl);
        }
      });
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <Avatar className={cn("rounded-lg", className)}>
      {url && <AvatarImage src={url} alt={name ?? ""} className="object-cover" />}
      <AvatarFallback className="rounded-lg bg-gradient-brand text-white font-medium">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
