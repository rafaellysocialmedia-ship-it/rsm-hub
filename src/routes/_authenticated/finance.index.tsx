import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Pencil,
  Trash2,
  MoreHorizontal,
  Download,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  STATUS_META,
  TYPE_META,
  brl,
  formatDate,
  type FinanceStatus,
  type FinanceTransaction,
  type FinanceType,
} from "@/lib/finance";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { ReceivablesKpis } from "@/components/finance/receivables-kpis";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/finance/")({
  component: FinancePage,
});

function FinancePage() {
  const { hasRole, loading: authLoading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | FinanceType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FinanceStatus>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["finance", "transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceTransaction[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["finance", "clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("finance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_transactions" },
        () => qc.invalidateQueries({ queryKey: ["finance", "transactions"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    (clients ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (transactions ?? []).filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (clientFilter !== "all") {
        if (clientFilter === "none" && t.client_id) return false;
        if (clientFilter !== "none" && t.client_id !== clientFilter) return false;
      }
      if (!q) return true;
      return (
        t.description.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.payment_method ?? "").toLowerCase().includes(q) ||
        (t.client_id ? clientNameById.get(t.client_id) ?? "" : "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [transactions, search, typeFilter, statusFilter, clientFilter, clientNameById]);

  const kpis = useMemo(() => {
    const list = transactions ?? [];
    const now = new Date();
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const currentMonth = ym(now);

    let mrr = 0;
    let paidTotal = 0;
    let pendingTotal = 0;
    let overdueTotal = 0;
    let expensesMonth = 0;

    list.forEach((t) => {
      const amount = Number(t.amount) || 0;
      const monthKey = ym(new Date(t.issue_date + "T00:00:00"));
      if (t.type === "income" && t.status === "paid" && monthKey === currentMonth) mrr += amount;
      if (t.type === "expense" && monthKey === currentMonth && t.status !== "cancelled")
        expensesMonth += amount;
      if (t.type === "income" && t.status === "paid") paidTotal += amount;
      if (t.type === "income" && t.status === "pending") pendingTotal += amount;
      if (t.type === "income" && t.status === "overdue") overdueTotal += amount;
    });

    return { mrr, paidTotal, pendingTotal, overdueTotal, expensesMonth, net: mrr - expensesMonth };
  }, [transactions]);

  const monthlySeries = useMemo(() => {
    const buckets = new Map<string, { month: string; receita: number; despesa: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, {
        month: d.toLocaleDateString("pt-BR", { month: "short" }),
        receita: 0,
        despesa: 0,
      });
    }
    (transactions ?? []).forEach((t) => {
      const d = new Date(t.issue_date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (!bucket) return;
      const amount = Number(t.amount) || 0;
      if (t.type === "income" && t.status === "paid") bucket.receita += amount;
      if (t.type === "expense" && t.status !== "cancelled") bucket.despesa += amount;
    });
    return [...buckets.values()];
  }, [transactions]);

  const statusBreakdown = useMemo(() => {
    const map: Record<FinanceStatus, number> = {
      pending: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
    };
    (transactions ?? []).forEach((t) => {
      if (t.type !== "income") return;
      map[t.status] += Number(t.amount) || 0;
    });
    return (Object.entries(map) as [FinanceStatus, number][]).map(([status, total]) => ({
      status,
      label: STATUS_META[status].label,
      total,
    }));
  }, [transactions]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Transação removida");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const rows = [
      [
        "Emissão",
        "Vencimento",
        "Pagamento",
        "Tipo",
        "Status",
        "Descrição",
        "Categoria",
        "Cliente",
        "Método",
        "Valor",
      ],
      ...filtered.map((t) => [
        t.issue_date,
        t.due_date ?? "",
        t.paid_date ?? "",
        TYPE_META[t.type].label,
        STATUS_META[t.status].label,
        `"${t.description.replace(/"/g, '""')}"`,
        t.category ?? "",
        t.client_id ? clientNameById.get(t.client_id) ?? "" : "",
        t.payment_method ?? "",
        String(Number(t.amount).toFixed(2)).replace(".", ","),
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Somente equipe e administradores acessam o financeiro.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe receitas, despesas, inadimplência e desempenho por cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nova transação
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label="Receita paga (mês)"
          value={brl(kpis.mrr)}
          hint="Pagamentos recebidos no mês corrente"
        />
        <Kpi
          icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
          label="Despesas (mês)"
          value={brl(kpis.expensesMonth)}
          hint="Saídas registradas no mês corrente"
        />
        <Kpi
          icon={<Wallet className="h-4 w-4 text-primary" />}
          label="Resultado líquido"
          value={brl(kpis.net)}
          hint="Receita paga − despesas"
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          label="A receber / vencidos"
          value={brl(kpis.pendingTotal + kpis.overdueTotal)}
          hint={`${brl(kpis.overdueTotal)} vencidos`}
        />
      </section>

      <ReceivablesKpis />



      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Fluxo dos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => brl(Number(v)).replace("R$", "").trim()} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => brl(Number(v))}
                />
                <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" fill="url(#gRec)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesa" stroke="hsl(var(--destructive))" fill="url(#gDes)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Receitas por status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => brl(Number(v)).replace("R$", "").trim()} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => brl(Number(v))}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Transações</CardTitle>
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {transactions?.length ?? 0} registros
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar descrição, categoria, cliente..."
                className="pl-8 sm:w-72"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="sm:w-48"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                <SelectItem value="none">Sem cliente</SelectItem>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{t.description}</span>
                        {t.source_charge_id && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                            Via cobrança
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.category || "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.client_id ? clientNameById.get(t.client_id) ?? "—" : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_META[t.type].className}>
                        {TYPE_META[t.type].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_META[t.status].className}>
                        {STATUS_META[t.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(t.issue_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(t.due_date)}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${t.type === "expense" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {t.type === "expense" ? "−" : "+"} {brl(Number(t.amount), t.currency)}
                    </TableCell>
                    <TableCell>
                      {t.source_charge_id ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Editar em Contas a Receber"
                          asChild
                        >
                          <a href="/finance/receivables">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </a>
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(t); setDialogOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(t.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FinanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        clients={clients ?? []}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remove.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">{icon}</div>
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
