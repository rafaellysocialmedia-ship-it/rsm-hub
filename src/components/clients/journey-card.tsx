import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Stage = "closing" | "kickoff" | "onboarding" | "ongoing" | "renewal" | "offboarded";

const STAGES: { value: Stage; label: string; description: string }[] = [
  { value: "closing", label: "Fechamento", description: "Reunião de fechamento e contrato" },
  { value: "kickoff", label: "Kickoff", description: "Reunião inicial e alinhamento" },
  { value: "onboarding", label: "Onboarding", description: "Primeiros 7 dias" },
  { value: "ongoing", label: "Acompanhamento", description: "Rotina mensal" },
  { value: "renewal", label: "Renovação", description: "Ciclo em renovação" },
  { value: "offboarded", label: "Encerrado", description: "Contrato finalizado" },
];

type JourneyEvent = { id: string; stage: Stage; note: string | null; created_at: string };
const sb = supabase as unknown as typeof supabase;

export function JourneyCard({ clientId, currentStage }: { clientId: string; currentStage: Stage }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("administrator") || hasRole("team");
  const activeIdx = STAGES.findIndex((s) => s.value === currentStage);

  const { data: events = [] } = useQuery({
    queryKey: ["journey-events", clientId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("client_journey_events" as never)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as JourneyEvent[];
    },
  });

  const advance = useMutation({
    mutationFn: async (stage: Stage) => {
      const { error } = await supabase.from("clients").update({ journey_stage: stage } as never).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa atualizada");
      qc.invalidateQueries({ queryKey: ["clients", clientId] });
      qc.invalidateQueries({ queryKey: ["journey-events", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Jornada do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {STAGES.map((s, i) => {
            const done = i < activeIdx;
            const current = i === activeIdx;
            return (
              <div
                key={s.value}
                className={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                  current ? "border-primary/40 bg-primary/5" : done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : current ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.label}</p>
                    {current && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">atual</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                {canManage && !current && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => advance.mutate(s.value)} disabled={advance.isPending}>
                    Definir
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {events.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico</p>
            <div className="space-y-1.5">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {STAGES.find((s) => s.value === e.stage)?.label ?? e.stage}
                    {e.note ? ` — ${e.note}` : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
