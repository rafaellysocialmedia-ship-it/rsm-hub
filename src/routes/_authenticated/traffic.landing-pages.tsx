import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Globe, Pencil, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTrafficAccess } from "@/hooks/use-traffic";
import { lpStatusMeta, type LandingPage } from "@/lib/traffic";
import { formatDate } from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LandingPageDialog } from "@/components/traffic/landing-page-dialog";
import { TrafficLocked } from "@/components/traffic/traffic-locked";

export const Route = createFileRoute("/_authenticated/traffic/landing-pages")({
  head: () => ({
    meta: [
      { title: "Landing Pages · Tráfego Pago" },
      {
        name: "description",
        content: "Cadastro e status das landing pages dos clientes: produção, homologação e responsáveis.",
      },
      { property: "og:title", content: "Landing Pages · Tráfego Pago" },
      { property: "og:description", content: "Gestão das landing pages dos clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPagesPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Não encontrado</div>
  ),
});

function LandingPagesPage() {
  const { isStaff, allowed, loading } = useTrafficAccess();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);

  const { data: pages = [] } = useQuery({
    queryKey: ["landing-pages"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LandingPage[];
    },
  });

  if (loading) return <div className="px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <TrafficLocked />;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Landing Pages</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Páginas de captação vinculadas aos clientes da operação.
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Landing Page
          </Button>
        )}
      </div>

      {pages.length === 0 ? (
        <Card className="mt-6 border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma landing page cadastrada.
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => {
            const meta = lpStatusMeta(p.status);
            return (
              <Card key={p.id} className="p-5 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
                    {meta.label}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {p.domain || p.production_url || "Sem domínio"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.builder || "—"} · Publicada em {formatDate(p.published_at)}
                </p>
                {isStaff && (p as { visible_to_client?: boolean }).visible_to_client && (
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    Visível ao cliente
                  </Badge>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    asChild={!!p.production_url}
                    variant="outline"
                    size="sm"
                    disabled={!p.production_url}
                  >
                    {p.production_url ? (
                      <a href={p.production_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Abrir LP
                      </a>
                    ) : (
                      <span>Abrir LP</span>
                    )}
                  </Button>
                  {isStaff && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LandingPageDialog open={open} onOpenChange={setOpen} page={editing} />
    </div>
  );
}
