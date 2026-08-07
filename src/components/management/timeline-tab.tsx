import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useStaffMembers } from "@/hooks/use-staff";
import { TIMELINE_LABELS, formatDateTime, type ClientTimelineEvent } from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionCard } from "./master-shared";

export function TimelineTab({ clientId }: { clientId: string }) {
  const { data: staff = [] } = useStaffMembers();

  const { data: events = [] } = useQuery({
    queryKey: ["client-timeline", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_timeline")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ClientTimelineEvent[];
    },
  });

  return (
    <SectionCard title="Histórico" description="Timeline automática dos eventos do cliente">
      {events.length === 0 ? (
        <EmptyState>Nenhum evento registrado ainda.</EmptyState>
      ) : (
        <ol className="relative space-y-5 border-l border-border pl-6">
          {events.map((e) => {
            const actor = staff.find((s) => s.id === e.actor_id);
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{e.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {TIMELINE_LABELS[e.event_type] ?? e.event_type}
                  </Badge>
                </div>
                {e.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDateTime(e.created_at)}
                  {actor ? ` · ${actor.name || actor.email}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
