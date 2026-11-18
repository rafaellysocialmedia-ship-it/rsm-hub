import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { brl } from "@/lib/finance";

const INCOME = "var(--fin-income)";
const EXPENSE = "var(--fin-expense)";

const compact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color?: string }[];
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold capitalize">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.color && <span className="size-2.5 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium text-foreground">{brl(r.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export type MonthPoint = { label: string; month: string; received: number; expenses: number };

/** Recebido x despesas pagas, mês a mês. Clique numa coluna para abrir o mês. */
export function IncomeExpenseChart({
  data,
  selected,
  onSelect,
}: {
  data: MonthPoint[];
  selected: string;
  onSelect?: (month: string) => void;
}) {
  return (
    <figure className="space-y-2">
      <Legend
        items={[
          { label: "Recebido", color: INCOME },
          { label: "Despesas pagas", color: EXPENSE },
        ]}
      />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="28%"
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            onClick={(state) => {
              const month = (state?.activePayload?.[0]?.payload as MonthPoint | undefined)?.month;
              if (month && onSelect) onSelect(month);
            }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={(props) => {
                const point = data[props.index];
                const active = point?.month === selected;
                return (
                  <text
                    x={props.x}
                    y={props.y + 12}
                    textAnchor="middle"
                    className={active ? "fill-foreground text-xs font-semibold" : "fill-muted-foreground text-xs"}
                  >
                    {props.payload.value}
                  </text>
                );
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={compact}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as MonthPoint;
                return (
                  <TooltipBox
                    title={p.label}
                    rows={[
                      { label: "Recebido", value: p.received, color: INCOME },
                      { label: "Despesas pagas", value: p.expenses, color: EXPENSE },
                      { label: "Resultado", value: p.received - p.expenses },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="received" name="Recebido" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={28} className="cursor-pointer" />
            <Bar dataKey="expenses" name="Despesas pagas" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={28} className="cursor-pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((p) => `${p.label}: recebido ${brl(p.received)}, despesas ${brl(p.expenses)}`).join("; ")}
      </figcaption>
    </figure>
  );
}

/** Barras horizontais de uma série só (faturamento por cliente, despesas por categoria). */
export function RankingChart({
  data,
  color,
  label,
  empty,
}: {
  data: { name: string; value: number }[];
  color: "income" | "expense";
  label: string;
  empty: string;
}) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const fill = color === "income" ? INCOME : EXPENSE;
  return (
    <figure>
      <div style={{ height: Math.max(120, data.length * 34 + 16) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            barCategoryGap={6}
            margin={{ top: 4, right: 72, bottom: 4, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { name: string; value: number };
                return <TooltipBox title={p.name} rows={[{ label, value: p.value, color: fill }]} />;
              }}
            />
            <Bar dataKey="value" fill={fill} radius={[0, 4, 4, 0]} maxBarSize={22}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: number) => brl(v)}
                className="fill-muted-foreground text-[11px] tabular-nums"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.name}: ${brl(d.value)}`).join("; ")}
      </figcaption>
    </figure>
  );
}
