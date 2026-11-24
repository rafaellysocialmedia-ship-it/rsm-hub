import { TableRowsSkeleton } from "@/components/skeletons";
import { useCallback, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { FinanceWallet } from "@/components/finance/finance-wallet";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Pencil,
  Plus,
  Search,
  Ban,
  CheckCircle2,
  Handshake,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  useCharges,
  useFinanceAccess,
  useFinanceClients,
  usePaymentMethods,
} from "@/hooks/use-finance";
import {
  CHARGE_STATUS_META,
  dateBR,
  effectiveStatus,
  money,
  type ChargeStatus,
  type FinanceCharge,
} from "@/lib/finance-core";
import { SERVICE_CATALOG } from "@/lib/client-master";
import { ChargeDialog } from "@/components/finance/charge-dialog";
import { PaymentDialog } from "@/components/finance/payment-dialog";
import { RenegotiateDialog, UndoPaymentDialog } from "@/components/finance/charge-actions";
import { ChargeStatusBadge, chargeRowClass } from "@/components/finance/finance-status";
import { FinanceAlertsPanel } from "@/components/finance/finance-alerts-panel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/financeiro/receber")({
  head: () => ({
    meta: [
      { title: "Receber · Financeiro · RSM Gestão de Marketing" },
      { name: "description", content: "Mensalidades e cobranças do mês atual." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { visao?: "por-cliente" } => ({
    visao: s.visao === "por-cliente" ? "por-cliente" : undefined,
  }),
  component: ReceberPage,
});

/** Aba Receber: cobranças do mês ou, em "Por cliente", o total já pago por cliente
 *  (antiga Carteira financeira) — mesmos dados, sem duplicar telas. */
function ReceberPage() {
  const { visao } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  // Cada visão mantém a permissão que a tela tinha antes.
  const views = (
    [
      [undefined, "Por cobrança", "finance.receivables"],
      ["por-cliente", "Por cliente", "finance.clients"],
    ] as const
  ).filter(([, , module]) => can(module));
  return (
    <div className="flex flex-col">
      {views.length > 1 && (
        <div className="px-6 pt-6">
          <div
            role="group"
            aria-label="Como ver o que há para receber"
            className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
          >
            {views.map(([value, label]) => (
              <Button
                key={label}
                size="sm"
                variant={visao === value ? "secondary" : "ghost"}
                aria-pressed={visao === value}
                className="h-8 px-3"
                onClick={() => void navigate({ search: { visao: value }, replace: true })}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {visao === "por-cliente" ? (
        <div className="p-6">
          <FinanceWallet />
        </div>
      ) : (
        <ReceivablesPage />
      )}
    </div>
  );
}

function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(first), toExclusive: iso(next) };
}

function ReceivablesPage() {
  const qc = useQueryClient();
  const access = useFinanceAccess();
  const { data: charges = [], isLoading } = useCharges();
  const { data: clients = [] } = useFinanceClients();
  const { data: methods = [] } = usePaymentMethods();
  const month = currentMonthRange();

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCharge | null>(null);
  const [paying, setPaying] = useState<FinanceCharge | null>(null);
  const [undoing, setUndoing] = useState<FinanceCharge | null>(null);
  const [renegotiating, setRenegotiating] = useState<FinanceCharge | null>(null);

  const clientName = useCallback(
    (id: string) => clients.find((client) => client.id === id)?.name ?? "—",
    [clients],
  );
  const methodName = (id: string | null) =>
    id ? (methods.find((m) => m.id === id)?.label ?? "—") : "—";

  const filtered = useMemo(
    () =>
      charges.filter((c) => {
        const status = effectiveStatus(c);
        // Mês atual + tudo que continua em atraso de meses anteriores: uma
        // cobrança vencida só sai da lista quando é paga, renegociada ou cancelada.
        const carriedOver = c.due_date < month.from && status === "overdue";
        if (!carriedOver && (c.due_date < month.from || c.due_date >= month.toExclusive))
          return false;
        if (clientFilter !== "all" && c.client_id !== clientFilter) return false;
        if (serviceFilter !== "all" && c.service_key !== serviceFilter) return false;
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (methodFilter !== "all" && c.payment_method_id !== methodFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !c.description.toLowerCase().includes(q) &&
            !clientName(c.client_id).toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [
      charges,
      clientFilter,
      serviceFilter,
      statusFilter,
      methodFilter,
      search,
      clientName,
      month.from,
      month.toExclusive,
    ],
  );

  const cancel = useMutation({
    mutationFn: async (charge: FinanceCharge) => {
      const { error } = await supabase
        .from("finance_charges")
        .update({ status: "cancelled" })
        .eq("id", charge.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-charges"] });
      qc.invalidateQueries({ queryKey: ["finance-history"] });
      toast.success("Cobrança cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!access.loading && !access.canView) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        Você não possui permissão para acessar o Financeiro.
      </div>
    );
  }

  const total = filtered.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const carried = filtered.filter((c) => c.due_date < month.from);
  const carriedTotal = carried.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Receber</h1>
          <p className="text-sm text-muted-foreground">
            Mensalidades de {monthLabel} · {filtered.length} cobranças · {money(total)}
          </p>
          {carried.length > 0 && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
              Inclui {carried.length} cobrança{carried.length === 1 ? "" : "s"} em atraso de meses
              anteriores · {money(carriedTotal)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/financeiro">Painel</Link>
          </Button>
          {access.canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Nova cobrança
            </Button>
          )}
        </div>
      </header>

      <FinanceAlertsPanel
        overdueActive={statusFilter === "overdue"}
        onFilterOverdue={() => setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")}
      />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar descrição ou cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger>
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
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {SERVICE_CATALOG.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(CHARGE_STATUS_META) as ChargeStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {CHARGE_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as formas</SelectItem>
              {methods.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton cols={10} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma cobrança encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const status = effectiveStatus(c);
                  return (
                    <TableRow key={c.id} className={chargeRowClass(c)}>
                      <TableCell className="font-medium">
                        {clientName(c.client_id)}
                        {c.due_date < month.from && (
                          <span className="mt-0.5 block text-[11px] font-normal text-red-600 dark:text-red-400">
                            Atraso de mês anterior
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{c.service_label ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{c.description}</TableCell>
                      <TableCell>{money(c.amount)}</TableCell>
                      <TableCell>
                        {c.competence?.slice(0, 7).split("-").reverse().join("/") || "A definir"}
                      </TableCell>
                      <TableCell>{dateBR(c.due_date)}</TableCell>
                      <TableCell>{methodName(c.payment_method_id)}</TableCell>
                      <TableCell>
                        <ChargeStatusBadge charge={c} />
                      </TableCell>
                      <TableCell>{dateBR(c.paid_date)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {access.canEdit && c.status !== "paid" && c.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Registrar pagamento"
                              onClick={() => setPaying(c)}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </Button>
                          )}
                          {access.canEdit && c.status !== "paid" && c.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Renegociar"
                              aria-label={`Renegociar cobrança de ${clientName(c.client_id)}`}
                              onClick={() => setRenegotiating(c)}
                            >
                              <Handshake className="h-4 w-4 text-brand-accent" />
                            </Button>
                          )}
                          {access.canEdit && c.status === "paid" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Desfazer pagamento"
                              aria-label={`Desfazer pagamento de ${clientName(c.client_id)}`}
                              onClick={() => setUndoing(c)}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          {access.canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Editar"
                              onClick={() => {
                                setEditing(c);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {access.canCancel && c.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Cancelar cobrança"
                              onClick={() => cancel.mutate(c)}
                            >
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ChargeDialog open={dialogOpen} onOpenChange={setDialogOpen} charge={editing} />
      <PaymentDialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)} charge={paying} />
      <UndoPaymentDialog charge={undoing} onClose={() => setUndoing(null)} />
      <RenegotiateDialog charge={renegotiating} onClose={() => setRenegotiating(null)} />
    </div>
  );
}
