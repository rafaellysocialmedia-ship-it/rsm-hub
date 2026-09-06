import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { briefingCompletion, type BriefingRow } from "@/lib/briefings";

export function ClientBriefingsTab({ clientId }: { clientId: string }) {
  const { data: briefings = [], isLoading } = useQuery({
    queryKey: ["client-briefings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefings")
        .select("id, client_id, title, meeting_date, status, sections, notes, created_at, updated_at")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefingRow[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Briefings do cliente</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Os briefings ficam vinculados à ficha do cliente e também à Biblioteca.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/library/briefings" search={{ client: clientId } as never}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo briefing
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : briefings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Nenhum briefing vinculado</p>
            <p className="text-xs text-muted-foreground">Crie o primeiro briefing para este cliente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {briefings.map((b) => {
              const progress = briefingCompletion(b.sections ?? []);
              return (
                <Link
                  key={b.id}
                  to="/briefings/$briefingId"
                  params={{ briefingId: b.id }}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {progress.answered}/{progress.total} respondidas · {progress.pct}%
                    </p>
                  </div>
                  <Badge variant={b.status === "completed" ? "default" : "secondary"}>
                    {b.status === "completed" ? "Concluído" : "Rascunho"}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
