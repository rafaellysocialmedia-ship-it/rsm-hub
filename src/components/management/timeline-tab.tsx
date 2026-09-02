import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Eye, Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { TIMELINE_LABELS, formatDateTime, type ClientTimelineEvent } from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SectionCard } from "./master-shared";

type Scope = "all" | "internal" | "client";

export function TimelineTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff = [] } = useStaffMembers();

  const [scope, setScope] = useState<Scope>("all");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "client">("client");

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

  const filtered = useMemo(
    () => (scope === "all" ? events : events.filter((e) => (e.visibility ?? "internal") === scope)),
    [events, scope],
  );

  const addUpdate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_timeline").insert({
        client_id: clientId,
        event_type: "team_update",
        title: title.trim(),
        detail: detail.trim() || null,
        visibility,
        actor_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        visibility === "client"
          ? "Atualização publicada para o cliente"
          : "Atualização registrada apenas internamente",
      );
      setTitle("");
      setDetail("");
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Nova atualização"
        description="Publique um andamento para o cliente ou registre uma nota interna da equipe"
      >
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Planejamento de conteúdo de maio aprovado"
          />
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detalhes da atualização (opcional)"
            rows={3}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs value={visibility} onValueChange={(v) => setVisibility(v as "internal" | "client")}>
              <TabsList className="h-9">
                <TabsTrigger value="client" className="gap-1.5 text-xs">
                  <Eye className="h-3.5 w-3.5" /> Visível ao cliente
                </TabsTrigger>
                <TabsTrigger value="internal" className="gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" /> Somente interno
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              disabled={!title.trim() || addUpdate.isPending}
              onClick={() => addUpdate.mutate()}
            >
              <Send className="mr-1.5 h-4 w-4" /> Registrar
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Histórico" description="Eventos automáticos e atualizações da equipe">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="mb-4">
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">
              Tudo ({events.length})
            </TabsTrigger>
            <TabsTrigger value="client" className="text-xs">
              Visível ao cliente ({events.filter((e) => e.visibility === "client").length})
            </TabsTrigger>
            <TabsTrigger value="internal" className="text-xs">
              Interno ({events.filter((e) => (e.visibility ?? "internal") === "internal").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <EmptyState>Nenhum evento registrado ainda.</EmptyState>
        ) : (
          <ol className="relative space-y-5 border-l border-border pl-6">
            {filtered.map((e) => {
              const actor = staff.find((s) => s.id === e.actor_id);
              const isClientVisible = e.visibility === "client";
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
                    <Badge
                      variant="outline"
                      className={
                        isClientVisible
                          ? "border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                          : "text-[10px] text-muted-foreground"
                      }
                    >
                      {isClientVisible ? (
                        <>
                          <Eye className="mr-1 h-2.5 w-2.5" /> Cliente
                        </>
                      ) : (
                        <>
                          <Lock className="mr-1 h-2.5 w-2.5" /> Interno
                        </>
                      )}
                    </Badge>
                  </div>
                  {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
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
    </div>
  );
}
