import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  TrendingUp,
  Users2,
  Wallet,
} from "lucide-react";

import { useCharges, useContracts } from "@/hooks/use-finance";
import { effectiveStatus, money, todayISO } from "@/lib/finance-core";
import { Card, CardContent } from "@/components/ui/card";

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

    for (const c of charges) {
      const paidThisMonth = c.status === "paid" && (c.paid_date ?? "").startsWith(monthPrefix);
      if (paidThisMonth) {
        receivedMonth += Number(c.amount_received ?? c.amount ?? 0);
      }

      if (!c.due_date.startsWith(monthPrefix)) continue;
      const status = effectiveStatus(c);
      const amount = Number(c.amount ?? 0);
      if (status === "paid" || status === "cancelled") continue;

      forecast += amount;
      if (status === "overdue") {
        overdue += amount;
        defaulters.add(c.client_id);
      } else {
        toReceive += amount;
      }
    }

    const active = contracts.filter((c) => c.status === "active");
    const ticket = active.length
      ? active.reduce((s, c) => s + Number(c.amount ?? 0), 0) / active.length
      : 0;

    return { receivedMonth, toReceive, overdue, forecast, defaulters: defaulters.size, ticket };
  }, [charges, contracts]);

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Kpi icon={TrendingUp} label="Recebido no mês" value={money(k.receivedMonth)} hint="Pagamentos recebidos no mês corrente" />
      <Kpi icon={CalendarClock} label="A receber no mês" value={money(k.toReceive)} hint="Mensalidades pendentes deste mês" />
      <Kpi icon={AlertTriangle} label="Em atraso no mês" value={money(k.overdue)} hint="Mensalidades vencidas deste mês" />
      <Kpi icon={Wallet} label="Receita prevista no mês" value={money(k.forecast)} hint="Pendente + vencido deste mês" />
      <Kpi icon={Users2} label="Clientes inadimplentes" value={String(k.defaulters)} hint="Com mensalidade vencida no mês" />
      <Kpi icon={CircleDollarSign} label="Ticket médio" value={money(k.ticket)} hint="Média dos contratos ativos" />
    </section>
  );
}
