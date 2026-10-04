import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceAccess } from "@/hooks/use-finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "./account-panels";

export function AccountActivity({ clientId }: { clientId: string }) {
  const finance = useFinanceAccess();
  const query = useQuery({
    queryKey: ["account-activity", clientId, finance.canView],
    refetchInterval: 30000,
    queryFn: async () => {
      const [posts, meetings, payments, timeline, tasks] = await Promise.all([
        supabase
          .from("post_activity_log")
          .select("id,action,detail,created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("meetings")
          .select("id,title,status,updated_at")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(50),
        finance.canView
          ? supabase
              .from("finance_history")
              .select("id,title,detail,created_at")
              .eq("client_id", clientId)
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("client_timeline")
          .select("id,title,detail,created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("tasks")
          .select("id,title,status,updated_at")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);
      if (posts.error || meetings.error || payments.error || timeline.error || tasks.error)
        throw posts.error || meetings.error || payments.error || timeline.error || tasks.error;
      const labels: Record<string, string> = {
        approval_approved: "Conteúdo aprovado",
        approval_changes_requested: "Alteração solicitada",
        approval_rejected: "Conteúdo rejeitado",
        commented: "Comentário registrado",
      };
      return [
        ...(timeline.data ?? []).map((t) => ({
          id: `timeline-${t.id}`,
          title: t.title,
          detail: t.detail,
          date: t.created_at,
        })),
        ...(tasks.data ?? []).map((t) => ({
          id: `task-${t.id}`,
          title: `Demanda: ${t.title}`,
          detail: (
            {
              todo: "A fazer",
              production: "Em produção",
              waiting_client: "Aguardando cliente",
              review: "Em revisão",
              done: "Concluída",
            } as Record<string, string>
          )[t.status],
          date: t.updated_at,
        })),
        ...(posts.data ?? []).map((p) => ({
          id: `post-${p.id}`,
          title: labels[p.action] || "Atividade de conteúdo",
          detail: p.detail,
          date: p.created_at,
        })),
        ...(meetings.data ?? []).map((m) => ({
          id: `meeting-${m.id}`,
          title: `Reunião: ${m.title}`,
          detail: (
            { scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada" } as Record<
              string,
              string
            >
          )[m.status],
          date: m.updated_at,
        })),
        ...(payments.data ?? []).map((p) => ({
          id: `finance-${p.id}`,
          title: p.title,
          detail: p.detail,
          date: p.created_at,
        })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 100);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atividades da operação</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length}>
          <ol className="space-y-5 border-l pl-5">
            {query.data?.map((e) => (
              <li key={e.id}>
                <p className="text-sm font-medium">{e.title}</p>
                {e.detail && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {e.detail}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(e.date).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ol>
        </QueryState>
      </CardContent>
    </Card>
  );
}
