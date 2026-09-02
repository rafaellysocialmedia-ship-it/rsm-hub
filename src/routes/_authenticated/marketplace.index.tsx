import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BarChart3,
  Camera,
  GraduationCap,
  LayoutTemplate,
  Megaphone,
  Palette,
  Sparkles,
  Store,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SERVICE_CATALOG, situationMeta } from "@/lib/client-master";
import { money } from "@/lib/traffic";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/marketplace/")({
  head: () => ({
    meta: [
      { title: "Serviços · Social Media Hub" },
      {
        name: "description",
        content:
          "Catálogo de serviços da agência: social media, tráfego pago, landing pages, filmagem, branding e academy.",
      },
      { property: "og:title", content: "Catálogo de Serviços" },
      {
        property: "og:description",
        content: "Veja o que já está contratado e solicite novos serviços da agência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketplacePage,
});

const SERVICE_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; pitch: string; bullets: string[] }
> = {
  social_media: {
    icon: Sparkles,
    pitch: "Planejamento, produção e aprovação de conteúdo com calendário completo.",
    bullets: ["Calendário editorial", "Aprovação no portal", "Relatórios de desempenho"],
  },
  paid_traffic: {
    icon: Megaphone,
    pitch: "Campanhas em Meta e Google Ads com CRM de leads e métricas ao vivo.",
    bullets: ["Gestão de campanhas", "CRM de leads", "CPA, CTR e ROAS"],
  },
  landing_page: {
    icon: LayoutTemplate,
    pitch: "Páginas de conversão rápidas, rastreadas e prontas para anúncio.",
    bullets: ["Copy e design", "Pixel e GA4", "Testes de conversão"],
  },
  filming: {
    icon: Camera,
    pitch: "Captação profissional de vídeo e foto para todas as redes.",
    bullets: ["Direção e roteiro", "Gravação e edição", "Cortes verticais"],
  },
  branding: {
    icon: Palette,
    pitch: "Identidade visual e posicionamento consistentes em todos os canais.",
    bullets: ["Identidade visual", "Manual de marca", "Templates sociais"],
  },
  academy: {
    icon: GraduationCap,
    pitch: "Treinamentos e cursos para o time do cliente ganhar autonomia.",
    bullets: ["Aulas gravadas", "Trilhas por tema", "Certificado interno"],
  },
  other: {
    icon: BarChart3,
    pitch: "Projetos sob demanda: consultorias, automações e integrações.",
    bullets: ["Escopo personalizado", "Orçamento dedicado", "Prazo combinado"],
  },
};

function MarketplacePage() {
  const { user, hasRole, loading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");

  const { data: myClients = [] } = useQuery({
    queryKey: ["marketplace-clients", user?.id, isStaff],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("clients").select("id, name").order("name");
      if (!isStaff) q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["marketplace-services", myClients.map((c) => c.id).join(",")],
    enabled: myClients.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_services")
        .select("client_id, service_key, label, situation, amount, start_date")
        .in(
          "client_id",
          myClients.map((c) => c.id),
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const map = new Map<
      string,
      { count: number; situation: string | null; amount: number; clients: string[] }
    >();
    for (const s of services) {
      const cur = map.get(s.service_key) ?? { count: 0, situation: null, amount: 0, clients: [] };
      cur.count += 1;
      cur.amount += Number(s.amount ?? 0);
      cur.situation = cur.situation === "active" ? cur.situation : s.situation;
      const name = myClients.find((c) => c.id === s.client_id)?.name;
      if (name && !cur.clients.includes(name)) cur.clients.push(name);
      map.set(s.service_key, cur);
    }
    return map;
  }, [services, myClients]);

  const activeCount = services.filter((s) => s.situation !== "cancelled").length;
  const monthly = services
    .filter((s) => s.situation === "active")
    .reduce((acc, s) => acc + Number(s.amount ?? 0), 0);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Store className="h-5 w-5 shrink-0 text-primary" /> Serviços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStaff
              ? "Catálogo da agência e onde cada serviço já está sendo entregue."
              : "Veja o que você já contratou e solicite novos serviços."}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{activeCount} contratações</Badge>
          {isStaff && monthly > 0 && <Badge variant="outline">{money(monthly)} / mês</Badge>}
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATALOG.map((service) => {
            const meta = SERVICE_META[service.key] ?? SERVICE_META.other;
            const Icon = meta.icon;
            const row = summary.get(service.key);
            const contracted = !!row && row.situation !== "cancelled";
            return (
              <Card
                key={service.key}
                className={`flex flex-col shadow-soft transition ${
                  contracted ? "border-primary/40" : ""
                }`}
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {contracted ? (
                      <Badge variant="outline" className={situationMeta(row!.situation ?? "active").tone}>
                        <BadgeCheck className="mr-1 h-3 w-3" />
                        {situationMeta(row!.situation ?? "active").label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Disponível
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">{service.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.pitch}</p>
                  </div>

                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {meta.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" /> {b}
                      </li>
                    ))}
                  </ul>

                  {isStaff && row && (
                    <p className="text-xs text-muted-foreground">
                      {row.count} cliente{row.count === 1 ? "" : "s"}: {row.clients.slice(0, 3).join(", ")}
                      {row.clients.length > 3 ? ` +${row.clients.length - 3}` : ""}
                    </p>
                  )}

                  <div className="mt-auto pt-2">
                    {isStaff ? (
                      <Button asChild variant={contracted ? "outline" : "default"} className="w-full">
                        <Link to="/management/clients">
                          {contracted ? "Gerenciar contratações" : "Vincular a um cliente"}
                        </Link>
                      </Button>
                    ) : contracted ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link to={service.key === "paid_traffic" ? "/traffic" : "/portal"}>
                          Acompanhar entrega
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild className="w-full">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Olá! Gostaria de contratar o serviço de ${service.label}.`,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Solicitar proposta
                        </a>
                      </Button>
                    )}
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
