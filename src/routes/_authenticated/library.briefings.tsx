import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { briefingCompletion, type BriefingRow, type BriefingSection, type BriefingTemplateRow } from "@/lib/briefings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/library/briefings")({
  validateSearch: (search: Record<string, unknown>) => ({
    client: typeof search.client === "string" ? search.client : undefined,
  }),
  head: () => ({ meta: [{ title: "Briefings · Biblioteca · RSM Gestão de Marketing" }] }),
  component: LibraryBriefingsPage,
});

function LibraryBriefingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [open, setOpen] = useState(!!searchParams.client);
  const [clientId, setClientId] = useState(searchParams.client ?? "all");
  const [newClientId, setNewClientId] = useState(searchParams.client ?? "");
  const [title, setTitle] = useState("Briefing");
  const [meetingDate, setMeetingDate] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: briefings = [], isLoading } = useQuery({
    queryKey: ["briefings-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefings")
        .select("id, client_id, title, meeting_date, status, sections, notes, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefingRow[];
    },
  });

  const { data: template } = useQuery({
    queryKey: ["briefing-template"],
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

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const filtered = useMemo(
    () => clientId === "all" ? briefings : briefings.filter((b) => b.client_id === clientId),
    [briefings, clientId],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newClientId) throw new Error("Selecione o cliente");
      const sections = (template?.sections ?? []) as BriefingSection[];
      const cloned = sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ id: q.id, text: q.text, answer: "" })),
      }));
      const { data, error } = await supabase
        .from("briefings")
        .insert({
          client_id: newClientId,
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
      qc.invalidateQueries({ queryKey: ["briefings-library"] });
      qc.invalidateQueries({ queryKey: ["client-briefings"] });
      toast.success("Briefing criado");
      setOpen(false);
      navigate({ to: "/briefings/$briefingId", params: { briefingId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Biblioteca</p>
          <h1 className="text-2xl font-semibold tracking-tight">Briefings</h1>
          <p className="text-sm text-muted-foreground">Briefings organizados e vinculados por cliente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/library">Arquivos</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/briefings/template">
              <Settings2 className="mr-1.5 h-4 w-4" /> Perguntas
            </Link>
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo briefing
          </Button>
        </div>
      </header>

      <div className="max-w-sm">
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhum briefing encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => {
            const progress = briefingCompletion(b.sections ?? []);
            return (
              <Link key={b.id} to="/briefings/$briefingId" params={{ briefingId: b.id }}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{b.title}</CardTitle>
                      <Badge variant={b.status === "completed" ? "default" : "secondary"}>
                        {b.status === "completed" ? "Concluído" : "Rascunho"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.client_id ? clientMap.get(b.client_id) ?? "Cliente removido" : "Sem cliente"}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {progress.answered}/{progress.total} respondidas · {progress.pct}%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${progress.pct}%` }} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo briefing</DialogTitle>
            <DialogDescription>O briefing ficará vinculado ao cliente escolhido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newClientId}>
              Criar briefing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
