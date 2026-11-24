import { ListSkeleton } from "@/components/skeletons";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BriefingSection, BriefingTemplateRow } from "@/lib/briefings";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { briefingCompletion, type BriefingRow } from "@/lib/briefings";

export function ClientBriefingsTab({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Briefing");
  const [meetingDate, setMeetingDate] = useState("");

  const { data: template } = useQuery({
    queryKey: ["briefing-template"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefing_template")
        .select("id,name,sections")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BriefingTemplateRow | null;
    },
  });

  // Novo briefing já nasce vinculado a este cliente, a partir do modelo.
  const createMutation = useMutation({
    mutationFn: async () => {
      const sections = (template?.sections ?? []) as BriefingSection[];
      const cloned = sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ id: q.id, text: q.text, answer: "" })),
      }));
      const { data, error } = await supabase
        .from("briefings")
        .insert({
          client_id: clientId,
          title: title.trim() || "Briefing",
          meeting_date: meetingDate || null,
          status: "draft",
          sections: cloned,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["client-briefings"] });
      toast.success("Briefing criado");
      setOpen(false);
      navigate({ to: "/clientes/briefing/$briefingId", params: { briefingId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
            Os briefings ficam vinculados à ficha do cliente. O modelo vale para todos os clientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/clientes/briefing/modelo">
              <Settings2 className="mr-1.5 h-4 w-4" /> Editar modelo
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo briefing
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
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
                  to="/clientes/briefing/$briefingId"
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo briefing</DialogTitle>
            <DialogDescription>O briefing ficará vinculado a este cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="briefing-title">Título</Label>
              <Input id="briefing-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="briefing-date">Data da reunião</Label>
              <Input id="briefing-date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Criar briefing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
