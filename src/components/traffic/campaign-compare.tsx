import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import {
  campaignStatusMeta,
  money,
  num,
  pct,
  sumMetrics,
  type TrafficCampaign,
  type TrafficMetric,
} from "@/lib/traffic";
import { NA, roasLabel } from "@/lib/traffic-analytics";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  campaigns: TrafficCampaign[];
  metrics: TrafficMetric[];
};

/** Comparação de até 3 campanhas — somente campanhas do mesmo cliente. */
export function CampaignCompare({ campaigns, metrics }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const baseClient = selected.length
    ? campaigns.find((c) => c.id === selected[0])?.client_id
    : null;

  const options = useMemo(
    () => campaigns.filter((c) => !baseClient || c.client_id === baseClient),
    [campaigns, baseClient],
  );

  const chosen = selected
    .map((id) => campaigns.find((c) => c.id === id))
    .filter((c): c is TrafficCampaign => !!c);

  const add = (id: string) => {
    if (selected.includes(id) || selected.length >= 3) return;
    setSelected([...selected, id]);
  };

  const rows: { label: string; get: (c: TrafficCampaign) => string }[] = [
    { label: "Investimento", get: (c) => money(totalsFor(c).spend) },
    { label: "Leads", get: (c) => num(totalsFor(c).leads) },
    { label: "Conversões", get: (c) => num(totalsFor(c).conversions) },
    {
      label: "CPC",
      get: (c) => (totalsFor(c).clicks > 0 ? money(totalsFor(c).cpc) : NA),
    },
    {
      label: "CPA",
      get: (c) =>
        (totalsFor(c).conversions || totalsFor(c).leads) > 0 ? money(totalsFor(c).cpa) : NA,
    },
    {
      label: "CTR",
      get: (c) => (totalsFor(c).impressions > 0 ? pct(totalsFor(c).ctr) : NA),
    },
    {
      label: "ROAS",
      get: (c) => {
        const t = totalsFor(c);
        return roasLabel(t.revenue, t.spend, t.roas);
      },
    },
  ];

  function totalsFor(c: TrafficCampaign) {
    return sumMetrics(metrics.filter((m) => m.campaign_id === c.id));
  }

  return (
    <Card className="p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Comparar campanhas</p>
          <p className="text-xs text-muted-foreground">
            Selecione até 3 campanhas do mesmo cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value="" onValueChange={add}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Adicionar campanha" />
            </SelectTrigger>
            <SelectContent>
              {options
                .filter((c) => !selected.includes(c.id))
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      {chosen.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nenhuma campanha selecionada.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Indicador</th>
                {chosen.map((c) => (
                  <th key={c.id} className="pb-2 pr-4 font-medium">
                    <Link
                      to="/traffic/campaigns/$campaignId"
                      params={{ campaignId: c.id }}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="mt-1">
                      <Badge variant="outline" className={campaignStatusMeta(c.status).tone}>
                        {campaignStatusMeta(c.status).label}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2 pr-4 text-muted-foreground">{r.label}</td>
                  {chosen.map((c) => (
                    <td key={c.id} className="py-2 pr-4 font-medium">
                      {r.get(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
