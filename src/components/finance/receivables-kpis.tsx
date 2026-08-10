import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  TrendingUp,
  Users2,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useCharges, useContracts } from "@/hooks/use-finance";
import { effectiveStatus, money, todayISO } from "@/lib/finance-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Indicadores de Contas a Receber e Contratos (financeiro interno). */
export function ReceivablesKpis() {
  const { data: charges = [] } = useCharges();
  const { data: contracts = [] } = useContracts();

  const k = useMemo(() => {
    const today = todayISO();
    const monthPrefix = today.slice(0, 7);
    let receivedMonth = 0;
    let toReceive = 0;
    let overdue = 0;
    let forecast = 0;
    const defaulters = new Set<string>();
    const upcoming = new Map<string, number>();

    for (const c of charges) {
      const status = effectiveStatus(c);
      const amount = Number(c.amount ?? 0);
      if (status === "paid") {
        if ((c.paid_date ?? "").startsWith(monthPrefix)) {
          receivedMonth += Number(c.amount_received ?? amount);
        }
        continue;
      }
      if (status === "cancelled") continue;
      forecast += amount;
      if (status === "overdue") {
        overdue += amount;
        defaulters.add(c.client_id);
      } else {
        toReceive += amount;
      }
      const key = c.due_date.slice(0, 7);
      upcoming.set(key, (upcoming.get(key) ?? 0) + amount);
    }

    const active = contracts.filter((c) => c.status === "active");
    const ticket = active.length
      ? active.reduce((s, c) => s + Number(c.amount ?? 0), 0) / active.length
      : 0;

    const series = [...upcoming.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 6)
      .map(([month, total]) => ({
        month: month.split("-").reverse().join("/"),
        total,
      }));

    return { receivedMonth, toReceive, overdue, forecast, defaulters: defaulters.size, ticket, series };
  }, [charges, contracts]);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="Recebido no mês"
          value={money(k.receivedMonth)}
          hint="Cobranças pagas no mês corrente"
        />
        <Kpi icon={CalendarClock} label="A receber" value={money(k.toReceive)} hint="Vencimentos futuros" />
        <Kpi icon={AlertTriangle} label="Em atraso" value={money(k.overdue)} hint="Vencidas e não recebidas" />
        <Kpi
          icon={Wallet}
          label="Receita prevista"
          value={money(k.forecast)}
          hint="Cobranças pendentes + vencidas"
        />
        <Kpi
          icon={Users2}
          label="Clientes inadimplentes"
          value={String(k.defaulters)}
          hint="Com cobranças vencidas"
        />
        <Kpi
          icon={CircleDollarSign}
          label="Ticket médio"
          value={money(k.ticket)}
          hint="Média dos contratos ativos"
        />
      </section>

      {k.series.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Cobranças previstas por mês</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={k.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => money(Number(v)).replace("R$", "").trim()}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => money(Number(v))}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}
