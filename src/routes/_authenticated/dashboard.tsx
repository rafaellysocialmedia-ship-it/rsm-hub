import { createFileRoute } from "@tanstack/react-router";
import { Users, Briefcase, Calendar, BarChart3, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Social Media Hub" },
      { name: "description", content: "Visão geral da sua operação de social media." },
    ],
  }),
  component: DashboardPage,
});

const stats = [
  { label: "Clientes ativos", value: "—", icon: Briefcase },
  { label: "Membros da equipe", value: "—", icon: Users },
  { label: "Posts agendados", value: "—", icon: Calendar },
  { label: "Engajamento", value: "—", icon: BarChart3 },
];

function DashboardPage() {
  const { profile, user } = useAuth();
  const name = profile?.name ?? user?.email?.split("@")[0] ?? "";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Bem-vindo de volta{name ? `, ${name}` : ""}.</p>
        <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="bg-gradient-surface lg:col-span-2 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Nenhuma atividade ainda
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Próximos posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Nada agendado
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
