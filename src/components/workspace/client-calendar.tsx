import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { statusMeta, type Post } from "@/lib/posts";
import { cn } from "@/lib/utils";
import { PostDetailSheet } from "@/components/posts/post-detail-sheet";

export function ClientCalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [openPost, setOpenPost] = useState<Post | null>(null);

  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ["portal-client", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: posts = [],
    refetch,
    isLoading: postsLoading,
    error: postsError,
  } = useQuery({
    queryKey: ["portal-calendar-posts", client?.id],
    refetchInterval: 30000,
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id,client_id,title,headline,subheadline,slides,script,caption,cta,hashtags,theme,objective,format,status,scheduled_date,scheduled_time,social_network,social_networks,created_at,updated_at",
        )
        .eq("client_id", client!.id)
        .in("status", [
          "production",
          "recording",
          "editing",
          "review",
          "changes_requested",
          "approved",
          "to_schedule",
          "scheduled",
          "published",
        ])
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase
      .channel(`portal-cal-${client.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `client_id=eq.${client.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [client?.id, refetch]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
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

  if (clientLoading || postsLoading)
    return <p className="p-6 text-sm text-muted-foreground">Carregando calendário…</p>;
  if (clientError || postsError)
    return (
      <p role="alert" className="p-6 text-sm text-destructive">
        Não foi possível carregar o calendário.
      </p>
    );
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
            Sua conta ainda não está vinculada a um cliente. Solicite à equipe a associação do seu
            acesso.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Portal
          </span>
          <span className="text-xs text-muted-foreground">· {client.name}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendário editorial</h1>
        <p className="text-sm text-muted-foreground">
          Todas as publicações programadas para a sua marca — produção, aprovação, agendadas e
          publicadas.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setCursor(startOfMonth(new Date()))}>
              Hoje
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={() => setCursor((c) => subMonths(c, 1))}
            >
              <ChevronLeft aria-label="Mês anterior" className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={() => setCursor((c) => addMonths(c, 1))}
            >
              <ChevronRight aria-label="Próximo mês" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden grid-cols-7 border-b sm:grid border-border bg-muted/30">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="hidden grid-cols-7 sm:grid">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const list = byDate.get(iso) ?? [];
            const inMonth = isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            return (
              <div
                key={iso}
                className={cn(
                  "relative min-h-[110px] border-b border-r border-border p-1.5",
                  !inMonth && "bg-muted/20",
                )}
              >
                <div className="mb-1">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      !inMonth && "text-muted-foreground/50",
                      today &&
                        "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {list.slice(0, 3).map((p) => {
                    const meta = statusMeta(p.status);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setOpenPost(p)}
                        className="block w-full truncate rounded border-l-2 bg-muted/60 px-1.5 py-0.5 text-left text-sm hover:bg-muted"
                        style={{ borderLeftColor: `var(--${meta.value})` }}
                      >
                        <div className="flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                          {p.scheduled_time && (
                            <span className="text-muted-foreground">
                              {p.scheduled_time.slice(0, 5)}
                            </span>
                          )}
                          <span className="truncate font-medium">{p.title}</span>
                        </div>
                      </button>
                    );
                  })}
                  {list.length > 3 && (
                    <p className="px-1 text-sm text-muted-foreground">+{list.length - 3} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {posts
          .filter((p) => p.scheduled_date?.startsWith(format(cursor, "yyyy-MM")))
          .map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPost(p)}
              className="w-full rounded-xl border p-4 text-left"
            >
              <p className="font-medium">{p.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {p.scheduled_date &&
                  new Date(p.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")}
                {p.scheduled_time && ` · ${p.scheduled_time.slice(0, 5)}`} ·{" "}
                {p.status === "review" ? "Aguardando aprovação" : statusMeta(p.status).label}
              </p>
            </button>
          ))}
        {!posts.some((p) => p.scheduled_date?.startsWith(format(cursor, "yyyy-MM"))) && (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Nenhuma publicação com data prevista neste mês.
          </p>
        )}
      </div>

      <PostDetailSheet
        post={openPost}
        open={!!openPost}
        onOpenChange={(o) => {
          if (!o) setOpenPost(null);
        }}
        clientName={client.name}
      />
    </div>
  );
}
