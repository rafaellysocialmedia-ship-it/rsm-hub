import { AtSign, Facebook, Globe2, Instagram, Linkedin, Youtube } from "lucide-react";

/**
 * Destination platform badges for editorial posts. Each platform is displayed
 * independently (one post can target multiple networks). This is visual only:
 * scheduling and publication logic continues to read the existing post fields.
 */
export function PostNetworkBadges({
  networks,
  compact = false,
  maxVisible,
  showEmpty = true,
  className = "",
}: {
  networks: string[];
  compact?: boolean;
  /** Limit only the rendered icons, while retaining every destination for accessibility. */
  maxVisible?: number;
  showEmpty?: boolean;
  className?: string;
}) {
  const unique = Array.from(new Set(networks.filter(Boolean)));
  const visibleNetworks = maxVisible === undefined ? unique : unique.slice(0, Math.max(0, maxVisible));
  const hiddenCount = unique.length - visibleNetworks.length;
  if (unique.length === 0 && !showEmpty) return null;
  return (
    <span className={`inline-flex min-w-0 flex-wrap items-center gap-1 ${className}`} aria-label={unique.length ? `Redes de destino: ${unique.join(", ")}` : "Rede social não definida"}>
      {unique.length === 0 ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <Globe2 className="size-3" aria-hidden="true" /> Rede a definir
        </span>
      ) : (
        <>
        {visibleNetworks.map((network) => (
          <span
            key={network}
            title={`Publicar em ${network}`}
            className={`inline-flex min-w-0 items-center gap-1 rounded-md border border-border/60 bg-background/90 text-[10px] font-medium text-foreground ${compact ? "h-5 min-w-5 justify-center px-1" : "px-1.5 py-0.5"}`}
          >
            <NetworkIcon network={network} />
            {compact ? <span className="sr-only">{network}</span> : <span className="truncate">{network}</span>}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span
            className="inline-flex h-5 items-center rounded-md border border-border/60 bg-background/90 px-1 text-[10px] font-medium text-muted-foreground"
            title={`Outras redes: ${unique.slice(visibleNetworks.length).join(", ")}`}
            aria-label={`Mais ${hiddenCount} ${hiddenCount === 1 ? "rede" : "redes"}`}
          >
            +{hiddenCount}
          </span>
        )}
        </>
      )}
    </span>
  );
}

function NetworkIcon({ network }: { network: string }) {
  const iconClass = "size-3.5 shrink-0";
  switch (network.trim().toLowerCase()) {
    case "instagram":
      return <Instagram className={`${iconClass} text-pink-600`} aria-hidden="true" />;
    case "facebook":
      return <Facebook className={`${iconClass} text-blue-600`} aria-hidden="true" />;
    case "linkedin":
      return <Linkedin className={`${iconClass} text-sky-700`} aria-hidden="true" />;
    case "youtube":
      return <Youtube className={`${iconClass} text-red-600`} aria-hidden="true" />;
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={`${iconClass} text-foreground`} fill="currentColor" aria-hidden="true">
          <path d="M16.6 2c.2 3.1 1.9 5 5.4 5.3v3.8c-2.1-.1-3.9-.8-5.4-1.8v5.8c0 4-3.1 7-7 7-4.1 0-7.1-3.1-7.1-7.1 0-4.2 3.2-7.3 7.3-7.3.5 0 1 .1 1.5.2v4c-.5-.2-1-.3-1.5-.3-1.9 0-3.3 1.4-3.3 3.4 0 1.8 1.4 3.1 3.3 3.1 2.1 0 3.3-1.5 3.3-3.6V2h3.8Z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" className={`${iconClass} text-red-600`} fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-3.6 19.3c0-.9 0-2.1.2-3.1l1.2-5.1s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2.1 1.6 2.1 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.3-4.5-4.3-3.1 0-4.9 2.3-4.9 4.8 0 .9.3 1.9.8 2.4l.2.6-.3 1.2c0 .2-.2.3-.5.2-1.4-.6-2.3-2.5-2.3-4 0-3.2 2.4-6.3 7-6.3 3.7 0 6.6 2.6 6.6 6.1 0 3.6-2.2 6.5-5.2 6.5-1 0-2-.6-2.4-1.2l-.7 2.7c-.2 1.1-1 2.2-1.5 3.1A10 10 0 1 0 12 2Z" />
        </svg>
      );
    case "threads":
      return <AtSign className={iconClass} aria-hidden="true" />;
    case "x":
    case "x (twitter)":
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20Z"/>
        </svg>
      );
    default:
      return <Globe2 className={`${iconClass} text-muted-foreground`} aria-hidden="true" />;
  }
}
