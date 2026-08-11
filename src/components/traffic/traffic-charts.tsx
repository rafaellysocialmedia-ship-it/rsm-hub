import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
} as const;

const axis = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

export type SeriesPoint = {
  label: string;
  spend: number;
  leads: number;
  conversions: number;
  revenue: number;
};

/** Leads e conversões por dia. */
export function LeadsBarChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar name="Leads" dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar name="Conversões" dataKey="conversions" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Investimento x Leads. */
export function SpendVsLeadsChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="l" {...axis} />
        <YAxis yAxisId="r" orientation="right" {...axis} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="l" name="Investimento" dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="r"
          name="Leads"
          type="monotone"
          dataKey="leads"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Receita x Investimento. */
export function RevenueVsSpendChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line name="Receita" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        <Line
          name="Investimento"
          type="monotone"
          dataKey="spend"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
