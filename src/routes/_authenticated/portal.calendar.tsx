import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portal/calendar")({
  head: () => ({
    meta: [
      { title: "Calendário · Área do Cliente" },
      { name: "description", content: "Acompanhe o calendário editorial da sua marca." },
    ],
  }),
  component: ClientCalendarPage,
});

function ClientCalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [openPost, setOpenPost] = useState<Post | null>(null);

  const { data: client } = useQuery({
    queryKey: ["portal-client", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: posts = [], refetch } = useQuery({
    queryKey: ["portal-calendar-posts", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts").select("*").eq("client_id", client!.id)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase
      .channel(`portal-cal-${client.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `client_id=eq.${client.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [client?.id, refetch]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [cursor]);

  const byDate = useMemo(() => {
    const m = new Map<string, Post[]>();
    posts.forEach((p) => {
      if (!p.scheduled_date) return;
      const arr = m.get(p.scheduled_date) ?? [];
      arr.push(p);
      m.set(p.scheduled_date, arr);
    });
    return m;
  }, [posts]);

  if (!client) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <CardTitle>Área do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um cliente. Solicite à equipe a associação do seu acesso.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Portal</span>
          <span className="text-xs text-muted-foreground">· {client.name}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendário editorial</h1>
        <p className="text-sm text-muted-foreground">
          Todas as publicações programadas para a sua marca — ideias, produção, aprovação, agendadas e publicadas.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setCursor(startOfMonth(new Date()))}>Hoje</Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d) => (
            <div key={d} className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const list = byDate.get(iso) ?? [];
            const inMonth = isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            return (
              <div key={iso} className={cn("relative min-h-[110px] border-b border-r border-border p-1.5", !inMonth && "bg-muted/20")}>
                <div className="mb-1">
                  <span className={cn(
                    "text-xs font-medium",
                    !inMonth && "text-muted-foreground/50",
                    today && "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                  )}>{format(d, "d")}</span>
                </div>
                <div className="space-y-1">
                  {list.slice(0, 3).map((p) => {
                    const meta = statusMeta(p.status);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setOpenPost(p)}
                        className="block w-full truncate rounded border-l-2 bg-muted/60 px-1.5 py-0.5 text-left text-[10px] hover:bg-muted"
                        style={{ borderLeftColor: `var(--${meta.value})` }}
                      >
                        <div className="flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                          {p.scheduled_time && <span className="text-muted-foreground">{p.scheduled_time.slice(0, 5)}</span>}
                          <span className="truncate font-medium">{p.title}</span>
                        </div>
                      </button>
                    );
                  })}
                  {list.length > 3 && (
                    <p className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!openPost} onOpenChange={(o) => !o && setOpenPost(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {openPost && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusMeta(openPost.status).tone}>
                    {statusMeta(openPost.status).label}
                  </Badge>
                  {postNetworks(openPost).map((n) => (
                    <Badge key={n} variant="secondary">{n}</Badge>
                  ))}
                </div>
                <SheetTitle>{openPost.title}</SheetTitle>
                {openPost.headline && <SheetDescription>{openPost.headline}</SheetDescription>}
              </SheetHeader>

              <ScrollArea className="mt-4 max-h-[70vh] pr-3">
                <div className="space-y-4 text-sm">
                  {openPost.scheduled_date && (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {new Date(openPost.scheduled_date).toLocaleDateString("pt-BR")}
                      {openPost.scheduled_time && ` · ${openPost.scheduled_time.slice(0, 5)}`}
                    </div>
                  )}
                  {openPost.caption && (
                    <section>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Legenda</p>
                      <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/30 p-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(openPost.caption) }} />
                    </section>
                  )}
                  {openPost.cta && (
                    <section>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">CTA</p>
                      <p>{openPost.cta}</p>
                    </section>
                  )}
                  {openPost.hashtags && (
                    <section>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Hashtags</p>
                      <p className="text-muted-foreground">{openPost.hashtags}</p>
                    </section>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {openPost.theme && <div><p className="text-xs uppercase text-muted-foreground">Tema</p><p>{openPost.theme}</p></div>}
                    {openPost.objective && <div><p className="text-xs uppercase text-muted-foreground">Objetivo</p><p>{openPost.objective}</p></div>}
                    {openPost.format && <div><p className="text-xs uppercase text-muted-foreground">Formato</p><p>{openPost.format}</p></div>}
                    {openPost.pillar && <div><p className="text-xs uppercase text-muted-foreground">Pilar</p><p>{openPost.pillar}</p></div>}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
