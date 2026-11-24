import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Handshake,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
  Users2,
  Wallet,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCharges } from "@/hooks/use-finance";
import { brl, formatDate, type FinanceTransaction } from "@/lib/finance";
import { todayLocalISO } from "@/lib/finance-alerts";
import {
  byCategory,
  byClient,
  change,
  effectiveTxStatus,
  monthLabel,
  monthOf,
  projectionsFor,
  refDate,
  shiftMonth,
  summarizeMonth,
  suspectDuplicates,
  NOT_DUPLICATE_MARK,
  type MonthKey,
  type Projection,
} from "@/lib/finance-dashboard";
import type { FinanceCharge } from "@/lib/finance-core";
import { FinanceDialog } from "@/components/finance/finance-dialog";
import { FinanceAlertsPanel } from "@/components/finance/finance-alerts-panel";
import { IncomeExpenseChart, RankingChart } from "@/components/finance/finance-charts";
import { ChargeStatusBadge, chargeRowClass } from "@/components/finance/finance-status";
import { PaymentDialog } from "@/components/finance/payment-dialog";
import { RenegotiateDialog, UndoPaymentDialog } from "@/components/finance/charge-actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finance/")({
  validateSearch: (s: Record<string, unknown>): { mes?: string } =>
    typeof s.mes === "string" && /^\d{4}-\d{2}$/.test(s.mes) ? { mes: s.mes } : {},
  head: () => ({ meta: [{ title: "Financeiro · RSM Gestão de Marketing" }] }),
  component: FinancePage,
});

type Filter = "all" | "income" | "expense" | "overdue" | "open" | "paid" | "duplicates";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "income", label: "Receitas" },
  { value: "expense", label: "Despesas" },
  { value: "overdue", label: "Vencidos" },
  { value: "open", label: "Em aberto" },
  { value: "paid", label: "Pagos" },
];

type Row =
  | { kind: "tx"; t: FinanceTransaction }
  | { kind: "projection"; p: Projection };

function FinancePage() {
  const { hasRole, user, loading: authLoading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const today = todayLocalISO();
  const currentMonth = monthOf(today);
  const { mes } = Route.useSearch();
  const month: MonthKey = mes ?? currentMonth;
  const setMonth = (value: MonthKey) =>
    void navigate({ search: value === currentMonth ? {} : { mes: value }, replace: true });

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [dialog, setDialog] = useState<{ tx: FinanceTransaction | null; type: "income" | "expense" } | null>(null);
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null);
  const [paying, setPaying] = useState<FinanceCharge | null>(null);
  const [undoing, setUndoing] = useState<FinanceCharge | null>(null);
  const [renegotiating, setRenegotiating] = useState<FinanceCharge | null>(null);

  // Seis meses de histórico para o gráfico e a comparação, mais os fixos.
  const from = `${shiftMonth(month, -6)}-01`;
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["finance", "transactions", "dashboard", from],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .or(
          `due_date.gte.${from},issue_date.gte.${from},paid_date.gte.${from},recurrence.eq.monthly`,
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as FinanceTransaction[];
    },
  });
  const { data: charges = [] } = useCharges();
  const { data: clients = [] } = useQuery({
    queryKey: ["finance", "clients"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("finance-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, () =>
        qc.invalidateQueries({ queryKey: ["finance"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_charges" }, () =>
        qc.invalidateQueries({ queryKey: ["finance-charges"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const names = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const chargeById = useMemo(() => new Map(charges.map((c) => [c.id, c])), [charges]);
  const projections = useMemo(() => projectionsFor(month, txs, currentMonth), [month, txs, currentMonth]);
  const duplicates = useMemo(() => suspectDuplicates(txs), [txs]);
  const monthDuplicates = useMemo(
    () => txs.filter((t) => duplicates.has(t.id) && monthOf(refDate(t)) === month),
    [txs, duplicates, month],
  );
  const allDuplicatesTotal = useMemo(
    () => txs.filter((t) => duplicates.has(t.id)).reduce((s, t) => s + Number(t.amount), 0),
    [txs, duplicates],
  );
  const summary = useMemo(
    () => summarizeMonth(month, txs, today, projections),
    [month, txs, today, projections],
  );
  const previous = useMemo(() => {
    const prev = shiftMonth(month, -1);
    return summarizeMonth(prev, txs, today, projectionsFor(prev, txs, currentMonth));
  }, [month, txs, today, currentMonth]);
  const history = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => {
        const s = summarizeMonth(m, txs, today);
        return { month: m, label: monthLabel(m, "short"), received: s.received, expenses: s.expensesPaid };
      }),
    [month, txs, today],
  );
  const clientsChart = useMemo(() => byClient(month, txs, names), [month, txs, names]);
  const categoryChart = useMemo(() => byCategory(month, txs, projections), [month, txs, projections]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: Row[] = [
      ...txs
        .filter((t) => t.status !== "cancelled" && monthOf(refDate(t)) === month)
        .map((t) => ({ kind: "tx" as const, t })),
      ...projections.map((p) => ({ kind: "projection" as const, p })),
    ];
    const txOf = (r: Row) => (r.kind === "tx" ? r.t : r.p.template);
    const statusOf = (r: Row) => (r.kind === "tx" ? effectiveTxStatus(r.t, today) : "open");
    const order = { overdue: 0, open: 1, paid: 2, cancelled: 3 } as const;
    return list
      .filter((r) => {
        const t = txOf(r);
        const st = statusOf(r);
        if (filter === "income" && t.type !== "income") return false;
        if (filter === "expense" && t.type !== "expense") return false;
        if (filter === "overdue" && st !== "overdue") return false;
        if (filter === "open" && st !== "open") return false;
        if (filter === "paid" && st !== "paid") return false;
        if (filter === "duplicates" && !(r.kind === "tx" && duplicates.has(r.t.id))) return false;
        if (clientFilter !== "all" && t.client_id !== clientFilter) return false;
        if (!q) return true;
        return [t.description, t.category, t.client_id ? names.get(t.client_id) : ""]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const byStatus = order[statusOf(a)] - order[statusOf(b)];
        if (byStatus) return byStatus;
        const da = a.kind === "tx" ? refDate(a.t) : (a.p.due_date ?? a.p.issue_date);
        const db = b.kind === "tx" ? refDate(b.t) : (b.p.due_date ?? b.p.issue_date);
        return da.localeCompare(db);
      });
  }, [txs, projections, month, filter, clientFilter, search, names, today, duplicates]);

  const refresh = () => {
    for (const key of ["finance", "finance-charges", "finance-history"])
      void qc.invalidateQueries({ queryKey: [key] });
  };
  const setPaid = useMutation({
    mutationFn: async ({ t, paid }: { t: FinanceTransaction; paid: boolean }) => {
      const { error } = await supabase
        .from("finance_transactions")
        .update(paid ? { status: "paid", paid_date: today } : { status: "pending", paid_date: null })
        .eq("id", t.id);
      if (error) throw error;
      return paid;
    },
    onSuccess: (paid) => {
      refresh();
      toast.success(paid ? "Marcado como pago" : "Pagamento desfeito");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const launch = useMutation({
    mutationFn: async (list: Projection[]) => {
      const { error } = await supabase.from("finance_transactions").insert(
        list.map(({ template: t, issue_date, due_date }) => ({
          client_id: t.client_id,
          type: t.type,
          category: t.category,
          description: t.description,
          amount: t.amount,
          currency: t.currency,
          status: "pending" as const,
          issue_date,
          due_date,
          payment_method: t.payment_method,
          notes: t.notes,
          created_by: user?.id ?? undefined,
          recurrence: null,
          recurrence_active: true,
          recurrence_parent_id: t.id,
        })),
      );
      if (error) throw error;
      return list.length;
    },
    onSuccess: (n) => {
      refresh();
      toast.success(n === 1 ? "Lançamento fixo lançado no mês" : `${n} lançamentos fixos lançados no mês`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirmNotDuplicate = useMutation({
    mutationFn: async (t: FinanceTransaction) => {
      const { error } = await supabase
        .from("finance_transactions")
        .update({ notes: `${t.notes ? `${t.notes}\n` : ""}${NOT_DUPLICATE_MARK}` })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Mantido como receita separada. Ela volta a contar nos totais.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stopRepeating = useMutation({
    mutationFn: async (t: FinanceTransaction) => {
      const { error } = await supabase
        .from("finance_transactions")
        .update({ recurrence_active: false })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Repetição encerrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Lançamento excluído");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const lines = [
      ["Vencimento", "Pagamento", "Tipo", "Situação", "Descrição", "Categoria", "Cliente", "Valor"],
      ...rows.map((r) => {
        const t = r.kind === "tx" ? r.t : r.p.template;
        const st = r.kind === "tx" ? effectiveTxStatus(r.t, today) : "previsto";
        return [
          r.kind === "tx" ? refDate(t) : (r.p.due_date ?? r.p.issue_date),
          r.kind === "tx" ? (t.paid_date ?? "") : "",
          t.type === "income" ? "Receita" : "Despesa",
          { paid: "Pago", overdue: "Vencido", open: "Em aberto", cancelled: "Cancelado", previsto: "Fixo não lançado" }[st],
          `"${t.description.replace(/"/g, '""')}"`,
          t.category ?? "",
          t.client_id ? (names.get(t.client_id) ?? "") : "",
          Number(t.amount).toFixed(2).replace(".", ","),
        ];
      }),
    ];
    const blob = new Blob(["﻿" + lines.map((l) => l.join(";")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="space-y-4 p-6">
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

  const label = monthLabel(month);
  const prevLabel = monthLabel(shiftMonth(month, -1), "short");
  const expenseProjections = projections.filter((p) => p.template.type === "expense");
  const incomeProjections = projections.filter((p) => p.template.type === "income");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel financeiro</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Mês anterior"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-semibold" aria-live="polite">
              {label}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Próximo mês"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {month !== currentMonth && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setMonth(currentMonth)}>
                Voltar para o mês atual
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button variant="outline" onClick={() => setDialog({ tx: null, type: "expense" })}>
            <TrendingDown className="mr-2 h-4 w-4" /> Nova despesa
          </Button>
          <Button onClick={() => setDialog({ tx: null, type: "income" })}>
            <Plus className="mr-2 h-4 w-4" /> Nova receita
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <section aria-label={`Resumo de ${label}`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi
            icon={Receipt}
            tone="neutral"
            label="Faturamento do mês"
            value={brl(summary.billed)}
            hint={`${summary.billedClients} cliente${summary.billedClients === 1 ? "" : "s"} · ticket médio ${brl(summary.averageTicket)}`}
            delta={change(summary.billed, previous.billed)}
            vs={prevLabel}
          />
          <Kpi
            icon={TrendingUp}
            tone="success"
            label="Recebido"
            value={brl(summary.received)}
            hint="Pagamentos recebidos no mês"
            delta={change(summary.received, previous.received)}
            vs={prevLabel}
          />
          <Kpi
            icon={CalendarClock}
            tone={summary.toReceive > 0 ? "info" : "neutral"}
            label="A receber"
            value={brl(summary.toReceive)}
            hint="Ainda dentro do prazo"
          />
          <Kpi
            icon={AlertTriangle}
            tone={summary.overdue > 0 ? "danger" : "neutral"}
            label="Vencido"
            value={brl(summary.overdue)}
            hint={
              summary.overdueBefore > 0
                ? `${summary.overdueCount} no mês · mais ${brl(summary.overdueBefore)} de meses anteriores`
                : `${summary.overdueCount} cobrança${summary.overdueCount === 1 ? "" : "s"} no mês`
            }
            onClick={() => setFilter(filter === "overdue" ? "all" : "overdue")}
            active={filter === "overdue"}
          />
          <Kpi
            icon={TrendingDown}
            tone={summary.expenses > 0 ? "warning" : "neutral"}
            label="Despesas"
            value={brl(summary.expenses)}
            hint={`${brl(summary.expensesPaid)} pagas · ${brl(summary.expensesOpen)} a pagar`}
            delta={change(summary.expenses, previous.expenses)}
            vs={prevLabel}
            upIsBad
          />
          <Kpi
            icon={Wallet}
            tone={summary.profit < 0 ? "danger" : "success"}
            label="Lucro do mês"
            value={brl(summary.profit)}
            hint={`Recebido − despesas pagas · previsto ${brl(summary.expectedProfit)}`}
            delta={change(summary.profit, previous.profit)}
            vs={prevLabel}
          />
        </section>
      )}

      {projections.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] p-3.5">
          <Repeat className="size-4 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">
              {projections.length} lançamento{projections.length === 1 ? "" : "s"} fixo
              {projections.length === 1 ? "" : "s"} ainda não lançado{projections.length === 1 ? "" : "s"} em {label}
            </strong>
            <span className="text-muted-foreground">
              {expenseProjections.length > 0 &&
                ` · despesas ${brl(expenseProjections.reduce((s, p) => s + Number(p.template.amount), 0))}`}
              {incomeProjections.length > 0 &&
                ` · receitas ${brl(incomeProjections.reduce((s, p) => s + Number(p.template.amount), 0))}`}
              . Já estão somados como previstos.
            </span>
          </p>
          <Button size="sm" onClick={() => launch.mutate(projections)} disabled={launch.isPending}>
            Lançar no mês
          </Button>
        </div>
      )}

      {monthDuplicates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-3.5">
          <AlertTriangle className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">
              {monthDuplicates.length} receita{monthDuplicates.length === 1 ? "" : "s"} possivelmente
              duplicada{monthDuplicates.length === 1 ? "" : "s"} ·{" "}
              {brl(monthDuplicates.reduce((s, t) => s + Number(t.amount), 0))}
            </strong>
            <span className="text-muted-foreground">
              {" "}
              Foram lançadas à mão para clientes que já têm a mensalidade automática no mesmo mês.
              Ficam fora dos totais até você revisar
              {allDuplicatesTotal > 0 ? ` (no total, ${brl(allDuplicatesTotal)} nos últimos meses)` : ""}.
            </span>
          </p>
          <Button
            size="sm"
            variant="outline"
            className="bg-background"
            onClick={() => setFilter(filter === "duplicates" ? "all" : "duplicates")}
          >
            {filter === "duplicates" ? "Ver todos" : "Revisar"}
          </Button>
        </div>
      )}

      {month === currentMonth && <FinanceAlertsPanel showStats={false} />}

      <section className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recebido x despesas pagas · últimos 6 meses</CardTitle>
            <p className="text-xs text-muted-foreground">Clique numa coluna para abrir o mês.</p>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={history} selected={month} onSelect={setMonth} />
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:col-span-2">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Faturamento por cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingChart
                data={clientsChart}
                color="income"
                label="Faturado no mês"
                empty="Nenhuma receita neste mês."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Despesas por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <RankingChart
                data={categoryChart}
                color="expense"
                label="Despesas no mês"
                empty="Nenhuma despesa lançada. Use “Nova despesa” para começar."
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Lançamentos de {label}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" role="group" aria-label="Filtrar lançamentos">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={filter === f.value ? "secondary" : "ghost"}
                  aria-pressed={filter === f.value}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar descrição, categoria ou cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-full sm:w-56">
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum lançamento com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const t = r.kind === "tx" ? r.t : r.p.template;
                    const due = r.kind === "tx" ? refDate(r.t) : (r.p.due_date ?? r.p.issue_date);
                    const charge = r.kind === "tx" && t.source_charge_id ? chargeById.get(t.source_charge_id) : undefined;
                    const like = { id: t.id, amount: Number(t.amount), due_date: due, status: r.kind === "tx" ? t.status : "pending" };
                    return (
                      <TableRow key={r.kind === "tx" ? t.id : r.p.key} className={r.kind === "tx" ? chargeRowClass(like) : "bg-primary/[0.03]"}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(due)}
                          {r.kind === "tx" && t.paid_date && (
                            <span className="block text-[11px] text-muted-foreground">pago {formatDate(t.paid_date)}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="flex items-center gap-1.5">
                            {t.type === "income" ? (
                              <ArrowUpRight className="size-3.5 shrink-0 text-[var(--fin-income)]" aria-label="Receita" />
                            ) : (
                              <ArrowDownRight className="size-3.5 shrink-0 text-[var(--fin-expense)]" aria-label="Despesa" />
                            )}
                            <span className="truncate font-medium" title={t.description}>
                              {t.description}
                            </span>
                            {(t.recurrence === "monthly" || t.recurrence_parent_id || r.kind === "projection") && (
                              <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Fixo mensal" />
                            )}
                          </span>
                          {t.category && <span className="block truncate pl-5 text-[11px] text-muted-foreground">{t.category}</span>}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {t.client_id ? (
                            <Link
                              to="/management/clients/$clientId"
                              params={{ clientId: t.client_id }}
                              search={{ tab: "finance" }}
                              className="hover:underline"
                            >
                              {names.get(t.client_id) ?? "Cliente"}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.kind === "projection" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-xs text-primary">
                              <Repeat className="size-3.5" aria-hidden /> Fixo, não lançado
                            </span>
                          ) : (
                            <span className="flex flex-col items-start gap-1">
                              <ChargeStatusBadge charge={like} />
                              {duplicates.has(t.id) && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                                  title="O cliente já tem a mensalidade automática neste mês. Fora dos totais até a revisão."
                                >
                                  <AlertTriangle className="size-3" aria-hidden /> Possível duplicado
                                </span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-nowrap text-right font-semibold tabular-nums",
                            r.kind === "tx" && duplicates.has(t.id) && "text-muted-foreground line-through",
                          )}
                        >
                          {t.type === "expense" ? "− " : ""}
                          {brl(Number(t.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            row={r}
                            charge={charge}
                            onLaunch={(p) => launch.mutate([p])}
                            onPay={(c) => setPaying(c)}
                            onRenegotiate={(c) => setRenegotiating(c)}
                            onUndoCharge={(c) => setUndoing(c)}
                            onTogglePaid={(tx, paid) => setPaid.mutate({ t: tx, paid })}
                            onEdit={(tx) => setDialog({ tx, type: tx.type })}
                            onDelete={(tx) => setDeleting(tx)}
                            duplicate={r.kind === "tx" && duplicates.has(t.id)}
                            onConfirmNotDuplicate={(tx) => confirmNotDuplicate.mutate(tx)}
                            onStopRepeating={(tx) => stopRepeating.mutate(tx)}
                            busy={setPaid.isPending || launch.isPending || confirmNotDuplicate.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FinanceDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        transaction={dialog?.tx ?? null}
        defaultType={dialog?.type ?? "income"}
        clients={clients}
      />
      <PaymentDialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)} charge={paying} />
      <UndoPaymentDialog charge={undoing} onClose={() => setUndoing(null)} />
      <RenegotiateDialog charge={renegotiating} onClose={() => setRenegotiating(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.description} · {brl(Number(deleting?.amount ?? 0))}. Esta ação não pode ser
              desfeita.
              {deleting?.recurrence === "monthly" &&
                " Como é um lançamento fixo, ele deixa de aparecer nos próximos meses. As cobranças automáticas dos clientes não são afetadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  row,
  charge,
  onLaunch,
  onPay,
  onRenegotiate,
  onUndoCharge,
  onTogglePaid,
  onEdit,
  onDelete,
  duplicate = false,
  onConfirmNotDuplicate,
  onStopRepeating,
  busy,
}: {
  duplicate?: boolean;
  onConfirmNotDuplicate: (t: FinanceTransaction) => void;
  onStopRepeating: (t: FinanceTransaction) => void;
  row: Row;
  charge?: FinanceCharge;
  onLaunch: (p: Projection) => void;
  onPay: (c: FinanceCharge) => void;
  onRenegotiate: (c: FinanceCharge) => void;
  onUndoCharge: (c: FinanceCharge) => void;
  onTogglePaid: (t: FinanceTransaction, paid: boolean) => void;
  onEdit: (t: FinanceTransaction) => void;
  onDelete: (t: FinanceTransaction) => void;
  busy: boolean;
}) {
  if (row.kind === "projection")
    return (
      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => onLaunch(row.p)}>
        Lançar
      </Button>
    );
  const t = row.t;
  // Cobranças de clientes: as ações agem sobre a cobrança (o lançamento acompanha).
  if (t.source_charge_id) {
    if (!charge) return <span className="text-xs text-muted-foreground">—</span>;
    const open = charge.status !== "paid" && charge.status !== "cancelled";
    return (
      <div className="flex items-center justify-end gap-1">
        {open && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onPay(charge)}>
            <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" /> Recebido
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mais ações">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {open && (
              <DropdownMenuItem onClick={() => onRenegotiate(charge)}>
                <Handshake className="mr-2 h-4 w-4" /> Renegociar
              </DropdownMenuItem>
            )}
            {charge.status === "paid" && (
              <DropdownMenuItem onClick={() => onUndoCharge(charge)}>
                <Undo2 className="mr-2 h-4 w-4" /> Desfazer pagamento
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/management/clients/$clientId" params={{ clientId: charge.client_id }} search={{ tab: "finance" }}>
                <Users2 className="mr-2 h-4 w-4" /> Abrir cobranças do cliente
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
  const paid = t.status === "paid";
  const repeats = t.recurrence === "monthly" && t.recurrence_active !== false;
  if (duplicate)
    return (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => onDelete(t)}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Excluir duplicado
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mais ações">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={busy} onClick={() => onConfirmNotDuplicate(t)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Não é duplicado (manter)
            </DropdownMenuItem>
            {repeats && (
              <DropdownMenuItem onClick={() => onStopRepeating(t)}>
                <Repeat className="mr-2 h-4 w-4" /> Parar de repetir todo mês
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(t)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  return (
    <div className="flex items-center justify-end gap-1">
      {!paid && (
        <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => onTogglePaid(t, true)}>
          <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" />
          {t.type === "income" ? "Recebido" : "Pago"}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(t)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          {paid && (
            <DropdownMenuItem onClick={() => onTogglePaid(t, false)}>
              <Undo2 className="mr-2 h-4 w-4" /> Desfazer pagamento
            </DropdownMenuItem>
          )}
          {repeats && (
            <DropdownMenuItem onClick={() => onStopRepeating(t)}>
              <Repeat className="mr-2 h-4 w-4" /> Parar de repetir todo mês
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(t)}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type Tone = "neutral" | "success" | "info" | "warning" | "danger";
const KPI_TONE: Record<Tone, { box: string; icon: string }> = {
  neutral: { box: "bg-card", icon: "bg-muted text-muted-foreground" },
  success: { box: "border-emerald-500/25 bg-emerald-500/[0.05]", icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  info: { box: "border-sky-500/25 bg-sky-500/[0.05]", icon: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  warning: { box: "border-amber-500/30 bg-amber-500/[0.06]", icon: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  danger: { box: "border-red-500/30 bg-red-500/[0.06]", icon: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  delta,
  vs,
  upIsBad = false,
  onClick,
  active,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  vs?: string;
  upIsBad?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const t = KPI_TONE[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className={cn("flex size-7 items-center justify-center rounded-lg", t.icon)}>
            <Icon className="size-4" aria-hidden />
          </span>
          {label}
        </span>
        {delta != null && Number.isFinite(delta) && <Delta value={delta} vs={vs} upIsBad={upIsBad} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const className = cn("rounded-xl border p-4 text-left shadow-sm", t.box, active && "ring-2 ring-primary");
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title="Mostrar só os vencidos na lista"
      className={cn(className, "transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Variação contra o mês anterior, com seta e texto (nunca só cor). */
function Delta({ value, vs, upIsBad }: { value: number; vs?: string; upIsBad: boolean }) {
  const rounded = Math.round(value);
  if (rounded === 0)
    return <span className="whitespace-nowrap text-[11px] text-muted-foreground">= {vs}</span>;
  const up = rounded > 0;
  const good = up !== upIsBad;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        // Comparação não é alerta: vermelho e amarelo ficam só para vencido / a vencer.
        good ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground",
      )}
      title={`${up ? "Aumento" : "Queda"} de ${Math.abs(rounded)}% em relação a ${vs}`}
    >
      <Arrow className="size-3" aria-hidden />
      {Math.abs(rounded)}% vs {vs}
    </span>
  );
}
