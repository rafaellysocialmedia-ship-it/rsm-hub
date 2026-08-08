import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Target } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTrafficAccess } from "@/hooks/use-traffic";
import { useStaffMembers } from "@/hooks/use-staff";
import {
  CAMPAIGN_STATUS,
  campaignStatusMeta,
  money,
  objectiveLabel,
  platformLabel,
  type TrafficCampaign,
} from "@/lib/traffic";
import { formatDate } from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignDialog } from "@/components/traffic/campaign-dialog";
import { TrafficLocked } from "@/components/traffic/traffic-locked";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/traffic/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campanhas de Tráfego Pago" },
      {
        name: "description",
        content: "Cadastro e acompanhamento das campanhas de Meta Ads e Google Ads por cliente.",
      },
      { property: "og:title", content: "Campanhas de Tráfego Pago" },
      { property: "og:description", content: "Gestão das campanhas de tráfego pago da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampaignsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Não encontrado</div>
  ),
});

function CampaignsPage() {
  const { isStaff, allowed, loading } = useTrafficAccess();
  const { data: staff = [] } = useStaffMembers();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["traffic-campaigns"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrafficCampaign[];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns
      .filter((c) => (status === "all" ? true : c.status === status))
      .filter((c) => (!q ? true : c.name.toLowerCase().includes(q)));
  }, [campaigns, search, status]);

  const ownerName = (id: string | null) => {
    const m = staff.find((s) => s.id === id);
    return m?.name || m?.email || "—";
  };

  if (loading) return <div className="px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <TrafficLocked />;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cadastro manual das campanhas, preparado para integrações futuras.
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova campanha
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar campanha…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {CAMPAIGN_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="mt-6">
          <ListSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <Card className="mt-6 border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma campanha encontrada.
        </Card>
      ) : (
        <Card className="mt-6 divide-y divide-border shadow-soft">
          {rows.map((c) => {
            const meta = campaignStatusMeta(c.status);
            return (
              <Link
                key={c.id}
                to="/traffic/campaigns/$campaignId"
                params={{ campaignId: c.id }}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {platformLabel(c.platform)} · {objectiveLabel(c.objective)}
                  </p>
                </div>
                <div className="sm:w-[150px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Diário</p>
                  <p className="text-xs">{money(c.daily_budget)}</p>
                </div>
                <div className="sm:w-[150px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
                  <p className="text-xs">{money(c.total_budget)}</p>
                </div>
                <div className="sm:w-[160px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Período</p>
                  <p className="text-xs">
                    {formatDate(c.start_date)} → {formatDate(c.end_date)}
                  </p>
                </div>
                <div className="sm:w-[160px]">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Responsável
                  </p>
                  <p className="truncate text-xs">{ownerName(c.owner_id)}</p>
                </div>
              </Link>
            );
          })}
        </Card>
      )}

      <CampaignDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
