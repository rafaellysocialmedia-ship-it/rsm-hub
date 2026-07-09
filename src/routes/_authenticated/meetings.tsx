import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Video, Plus, Pencil, Trash2, Calendar as CalendarIcon, Clock, MapPin, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MeetingDialog, type Meeting } from "@/components/meetings/meeting-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({
    meta: [
      { title: "Reuniões · Social Media Hub" },
      { name: "description", content: "Agende e acompanhe reuniões com clientes." },
    ],
  }),
  component: MeetingsPage,
});

const STATUS_META: Record<Meeting["status"], { label: string; className: string }> = {
  scheduled: { label: "Agendada", className: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  completed: { label: "Concluída", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

function MeetingsPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("upcoming");

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: true })
        .order("meeting_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["meetings-clients"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("meetings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" },
        () => qc.invalidateQueries({ queryKey: ["meetings"] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Reunião removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = startOfDay(new Date());
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (!q) return true;
      const client = m.client_id ? clientNameById.get(m.client_id) ?? "" : "";
      return (
        m.title.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [meetings, search, clientNameById]);

  const upcoming = filtered.filter((m) => {
    const d = new Date(m.meeting_date + "T00:00:00");
    return m.status === "scheduled" && !isBefore(d, today);
  });
  const past = filtered.filter((m) => {
    const d = new Date(m.meeting_date + "T00:00:00");
    return m.status !== "scheduled" || isBefore(d, today);
  }).sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));

  if (authLoading) {
    return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Video className="h-3.5 w-3.5" /> Reuniões
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda de reuniões</h1>
          <p className="text-sm text-muted-foreground">Organize encontros com clientes, links e pautas.</p>
        </div>
        {isStaff && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nova reunião
          </Button>
        )}
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, cliente..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Anteriores ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {isLoading ? <Skeleton className="h-32 w-full" /> :
            upcoming.length === 0 ? <EmptyMsg text="Nenhuma reunião agendada." /> :
              upcoming.map((m) => (
                <MeetingRow
                  key={m.id} meeting={m}
                  clientName={m.client_id ? clientNameById.get(m.client_id) : undefined}
                  canEdit={isStaff}
                  onEdit={() => { setEditing(m); setDialogOpen(true); }}
                  onDelete={() => { if (confirm("Excluir esta reunião?")) remove.mutate(m.id); }}
                />
              ))}
        </TabsContent>
        <TabsContent value="past" className="mt-4 space-y-3">
          {isLoading ? <Skeleton className="h-32 w-full" /> :
            past.length === 0 ? <EmptyMsg text="Nenhuma reunião anterior." /> :
              past.map((m) => (
                <MeetingRow
                  key={m.id} meeting={m}
                  clientName={m.client_id ? clientNameById.get(m.client_id) : undefined}
                  canEdit={isStaff}
                  onEdit={() => { setEditing(m); setDialogOpen(true); }}
                  onDelete={() => { if (confirm("Excluir esta reunião?")) remove.mutate(m.id); }}
                />
              ))}
        </TabsContent>
      </Tabs>

      {isStaff && (
        <MeetingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          meeting={editing}
          clients={clients}
        />
      )}
    </div>
  );
}

function MeetingRow({
  meeting, clientName, canEdit, onEdit, onDelete,
}: {
  meeting: Meeting;
  clientName?: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[meeting.status];
  const date = new Date(meeting.meeting_date + "T00:00:00");
  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  return (
    <Card className="shadow-soft">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center",
            isToday ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted"
          )}>
            <span className="text-[10px] uppercase leading-none">{format(date, "MMM", { locale: ptBR })}</span>
            <span className="text-sm font-semibold leading-none mt-0.5">{format(date, "dd")}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{meeting.title}</p>
              <Badge variant="outline" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
              {isToday && <Badge className="text-[10px] bg-primary text-primary-foreground">Hoje</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {clientName && <span>{clientName}</span>}
              {meeting.meeting_time && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{meeting.meeting_time.slice(0,5)} · {meeting.duration_minutes}min</span>
              )}
              {meeting.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{meeting.location}</span>
              )}
              {meeting.meeting_url && (
                <a href={meeting.meeting_url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Entrar
                </a>
              )}
            </div>
            {meeting.description && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{meeting.description}</p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
