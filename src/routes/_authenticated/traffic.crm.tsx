import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useTrafficAccess, useTrafficClients } from "@/hooks/use-traffic";
import {
  LEAD_STAGES,
  money,
  num,
  platformLabel,
  type TrafficLead,
  type TrafficLeadStage,
} from "@/lib/traffic";
import { LeadDialog } from "@/components/traffic/lead-dialog";
import { TrafficLocked } from "@/components/traffic/traffic-locked";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/traffic/crm")({
  head: () => ({
    meta: [
      { title: "CRM de Tráfego Pago · Social Media Hub" },
      {
        name: "description",
        content:
          "Pipeline de leads gerados pelas campanhas: etapas, valor em negociação e taxa de conversão.",
      },
      { property: "og:title", content: "CRM de Tráfego Pago" },
      { property: "og:description", content: "Gestão de leads e oportunidades das campanhas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmPage,
});

function CrmPage() {
  const { loading, allowed, isStaff, client } = useTrafficAccess();
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!allowed) return <TrafficLocked />;
  return <Crm isStaff={isStaff} clientId={client?.id ?? null} />;
}

function Crm({ isStaff, clientId }: { isStaff: boolean; clientId: string | null }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useTrafficClients();
  const [clientFilter, setClientFilter] = useState<string>(clientId ?? "all");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrafficLead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["traffic-leads", clientFilter],
    queryFn: async () => {
      let query = supabase
        .from("traffic_leads")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (clientFilter !== "all") query = query.eq("client_id", clientFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TrafficLead[];
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: TrafficLeadStage }) => {
      const { error } = await supabase.from("traffic_leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("traffic_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead removido.");
      qc.invalidateQueries({ queryKey: ["traffic-leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((l) =>
      [l.name, l.email, l.phone, l.source].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [leads, q]);

  const byStage = useMemo(() => {
    const map = new Map<TrafficLeadStage, TrafficLead[]>();
    for (const s of LEAD_STAGES) map.set(s.value, []);
    for (const l of filtered) map.get(l.stage)?.push(l);
    return map;
  }, [filtered]);

  const total = filtered.length;
  const won = filtered.filter((l) => l.stage === "client").length;
  const lost = filtered.filter((l) => l.stage === "lost").length;
  const pipeline = filtered
    .filter((l) => l.stage !== "lost" && l.stage !== "client")
    .reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  const wonValue = filtered
    .filter((l) => l.stage === "client")
    .reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  const conversion = total > 0 ? (won / total) * 100 : 0;

  const stageIndex = (s: TrafficLeadStage) => LEAD_STAGES.findIndex((x) => x.value === s);
  const shift = (lead: TrafficLead, dir: -1 | 1) => {
    const next = LEAD_STAGES[stageIndex(lead.stage) + dir];
    if (!next) return;
    moveStage.mutate({ id: lead.id, stage: next.value });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users2 className="h-5 w-5 shrink-0 text-primary" /> CRM de Tráfego Pago
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe cada lead gerado pelas campanhas até a conversão.
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo lead
          </Button>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads" value={num(total)} hint={`${lost} perdidos`} />
        <Stat label="Em negociação" value={money(pipeline)} hint="Valor estimado no pipeline" />
        <Stat label="Convertidos" value={num(won)} hint={money(wonValue)} />
        <Stat label="Taxa de conversão" value={`${conversion.toFixed(1)}%`} hint="Leads que viraram cliente" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone..."
            className="pl-8"
          />
        </div>
        {isStaff && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-3">
          {LEAD_STAGES.map((stage) => {
            const items = byStage.get(stage.value) ?? [];
            const value = items.reduce((acc, l) => acc + Number(l.value ?? 0), 0);
            return (
              <Card key={stage.value} className="shadow-soft">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={stage.tone}>
                      {stage.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {items.length} · {money(value)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-lg border border-border/60 bg-muted/20 p-3 transition hover:border-primary/40"
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            if (!isStaff) return;
                            setEditing(lead);
                            setDialogOpen(true);
                          }}
                        >
                          <p className="truncate text-sm font-medium">{lead.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {lead.value ? money(Number(lead.value)) : "Sem valor estimado"}
                            {lead.platform ? ` · ${platformLabel(lead.platform)}` : ""}
                          </p>
                          {(lead.phone || lead.email) && (
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {lead.phone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {lead.phone}
                                </span>
                              )}
                              {lead.email && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <Mail className="h-3 w-3" /> {lead.email}
                                </span>
                              )}
                            </p>
                          )}
                          {lead.source && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Origem: {lead.source}
                            </p>
                          )}
                        </button>

                        {isStaff && (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                disabled={stageIndex(lead.stage) === 0}
                                onClick={() => shift(lead, -1)}
                                aria-label="Etapa anterior"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                disabled={stageIndex(lead.stage) === LEAD_STAGES.length - 1}
                                onClick={() => shift(lead, 1)}
                                aria-label="Próxima etapa"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeLead.mutate(lead.id)}
                              aria-label="Remover lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    {items.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        Nenhum lead nesta etapa.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isStaff && (
        <LeadDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          lead={editing}
          defaultClientId={clientFilter !== "all" ? clientFilter : null}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
