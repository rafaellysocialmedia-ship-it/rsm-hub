import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Settings2, Loader2, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BriefingRow, BriefingSection, BriefingTemplateRow } from "@/lib/briefings";
import { briefingCompletion } from "@/lib/briefings";

export const Route = createFileRoute("/_authenticated/briefings/")({
  component: BriefingsIndex,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

function BriefingsIndex() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [title, setTitle] = useState<string>("Briefing");
  const [meetingDate, setMeetingDate] = useState<string>("");

  const { data: briefings = [], isLoading } = useQuery({
    queryKey: ["briefings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("briefings")
        .select("id, client_id, title, meeting_date, status, sections, notes, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefingRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const { data: template } = useQuery({
    queryKey: ["briefing-template"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("briefing_template")
        .select("id, name, sections")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BriefingTemplateRow | null;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const sections = (template?.sections ?? []) as BriefingSection[];
      // deep-clone and reset answers
      const cloned = sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ id: q.id, text: q.text, answer: "" })),
      }));
      const payload = {
        client_id: clientId || null,
        title: title.trim() || "Briefing",
        meeting_date: meetingDate || null,
        status: "draft",
        sections: cloned,
        created_by: user?.id ?? null,
      };
      const { data, error } = await (supabase as any)
        .from("briefings")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["briefings"] });
      setOpen(false);
      setClientId("");
      setMeetingDate("");
      setTitle("Briefing");
      toast.success("Briefing criado");
      navigate({ to: "/briefings/$briefingId", params: { briefingId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("briefings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefings"] });
      toast.success("Briefing removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Briefings</h1>
          <p className="text-sm text-muted-foreground">
            Preencha o briefing durante a reunião com o cliente. As perguntas podem ser editadas no template.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/briefings/template">
              <Settings2 className="mr-2 h-4 w-4" />
              Editar perguntas
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo briefing
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo briefing</DialogTitle>
                <DialogDescription>
                  Escolha o cliente e um título. As perguntas serão copiadas do template atual.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data da reunião</Label>
                  <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : briefings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum briefing ainda</p>
              <p className="text-sm text-muted-foreground">
                Crie o primeiro briefing para começar.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {briefings.map((b) => {
            const c = briefingCompletion(b.sections ?? []);
            return (
              <Card key={b.id} className="group transition hover:border-primary/40">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{b.title}</CardTitle>
                    <Badge variant={b.status === "completed" ? "default" : "secondary"}>
                      {b.status === "completed" ? "Concluído" : "Rascunho"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {b.client_id ? clientMap.get(b.client_id) ?? "Cliente removido" : "Sem cliente"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {b.meeting_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(b.meeting_date + "T00:00:00"), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    )}
                    <span>
                      {c.answered}/{c.total} respondidas · {c.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${c.pct}%` }} />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/briefings/$briefingId" params={{ briefingId: b.id }}>
                        Abrir
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir briefing?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(b.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
