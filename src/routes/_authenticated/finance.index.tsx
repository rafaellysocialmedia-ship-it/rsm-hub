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
  head: () => ({ meta: [{ title: "Financeiro · RSM Gestão de Marketing" }] }),
  component: FinancePage,
});

function currentMonthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(first), toExclusive: iso(next) };
}

function FinancePage() {
  const { hasRole, loading: authLoading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const month = currentMonthBounds();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | FinanceType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FinanceStatus>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["finance", "transactions", "current-month"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .gte("issue_date", month.from)
        .lt("issue_date", month.toExclusive)
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceTransaction[];
    },
  });

  const { data: clients = [] } = useQuery({
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
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
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
        (t.client_id ? clientNameById.get(t.client_id) ?? "" : "").toLowerCase().includes(q)
      );
    });
  }, [transactions, search, typeFilter, statusFilter, clientFilter, clientNameById]);

  const kpis = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let overdue = 0;
    let expenses = 0;
    filtered.forEach((t) => {
      const amount = Number(t.amount) || 0;
      if (t.type === "income" && t.status === "paid") paid += amount;
      if (t.type === "income" && t.status === "pending") pending += amount;
      if (t.type === "income" && t.status === "overdue") overdue += amount;
      if (t.type === "expense" && t.status !== "cancelled") expenses += amount;
    });
    return { paid, pending, overdue, expenses, net: paid - expenses };
  }, [filtered]);

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
      ["Emissão", "Vencimento", "Pagamento", "Tipo", "Status", "Descrição", "Categoria", "Cliente", "Método", "Valor"],
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
    a.download = `financeiro-mes-atual-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <CardHeader><CardTitle className="text-base">Acesso restrito</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Somente equipe e administradores acessam o financeiro.</p></CardContent>
        </Card>
      </div>
    );
  }

  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel financeiro</h1>
          <p className="text-sm text-muted-foreground">Transações de {monthLabel}.</p>
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
        <Kpi icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} label="Receita paga" value={brl(kpis.paid)} hint="Recebido no mês atual" />
        <Kpi icon={<TrendingDown className="h-4 w-4 text-rose-500" />} label="Despesas" value={brl(kpis.expenses)} hint="Saídas do mês atual" />
        <Kpi icon={<Wallet className="h-4 w-4 text-primary" />} label="Resultado líquido" value={brl(kpis.net)} hint="Receitas pagas − despesas" />
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="A receber / vencidos" value={brl(kpis.pending + kpis.overdue)} hint={`${brl(kpis.overdue)} vencidos`} />
      </section>

      <ReceivablesKpis />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Transações do mês atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar transação..." />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | FinanceType)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | FinanceStatus)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(STATUS_META) as FinanceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Nenhuma transação no mês atual.</TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.issue_date)}</TableCell>
                    <TableCell className="max-w-[280px] truncate font-medium">{t.description}</TableCell>
                    <TableCell>{t.client_id ? clientNameById.get(t.client_id) ?? "—" : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_META[t.type].label}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{STATUS_META[t.status].label}</Badge></TableCell>
                    <TableCell>{t.payment_method ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{brl(Number(t.amount))}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(t); setDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(t.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        clients={clients}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}