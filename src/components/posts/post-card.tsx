import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";

type Props = {
  post: Post;
  clientName?: string;
  onClick?: () => void;
  compact?: boolean;
  dragging?: boolean;
};

export function PostCard({ post, clientName, onClick, compact, dragging }: Props) {
  const meta = statusMeta(post.status);
  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-soft transition-all",
        "hover:border-primary/40 hover:shadow-md",
        dragging && "rotate-1 opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{post.title}</p>
        <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
      </div>
      {!compact && clientName && (
        <p className="mt-1 text-xs text-muted-foreground">{clientName}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {post.social_network && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal">
            <Hash className="h-2.5 w-2.5" />
            {post.social_network}
          </Badge>
        )}
        {post.format && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
            {post.format}
          </Badge>
        )}
      </div>
      {(post.scheduled_date || post.scheduled_time) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {post.scheduled_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(post.scheduled_date + "T00:00:00"), "dd MMM", { locale: ptBR })}
            </span>
          )}
          {post.scheduled_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.scheduled_time.slice(0, 5)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
