import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Pencil, Plus, Search, Ban, CheckCircle2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/finance/receivables")({
  head: () => ({
    meta: [
      { title: "Contas a Receber · Financeiro" },
      {
        name: "description",
        content:
          "Gestão interna de cobranças: vencimentos, formas de pagamento, inadimplência e registro de pagamentos.",
      },
      { property: "og:title", content: "Contas a Receber · Financeiro" },
      { property: "og:description", content: "Controle de cobranças e recebimentos da agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceivablesPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Página não encontrada</div>
  ),
});

function ReceivablesPage() {
  const qc = useQueryClient();
  const access = useFinanceAccess();
  const { data: charges = [], isLoading } = useCharges();
  const { data: clients = [] } = useFinanceClients();
  const { data: methods = [] } = usePaymentMethods();

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCharge | null>(null);
  const [paying, setPaying] = useState<FinanceCharge | null>(null);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const methodName = (id: string | null) =>
    id ? methods.find((m) => m.id === id)?.label ?? "—" : "—";

  const filtered = useMemo(
    () =>
      charges.filter((c) => {
        const status = effectiveStatus(c);
        if (clientFilter !== "all" && c.client_id !== clientFilter) return false;
        if (serviceFilter !== "all" && c.service_key !== serviceFilter) return false;
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (methodFilter !== "all" && c.payment_method_id !== methodFilter) return false;
        if (from && c.due_date < from) return false;
        if (to && c.due_date > to) return false;
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
    [charges, clientFilter, serviceFilter, statusFilter, methodFilter, from, to, search, clients],
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} cobranças · {money(total)} no filtro atual
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/finance">Painel</Link>
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

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
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
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger><SelectValue placeholder="Serviço" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {SERVICE_CATALOG.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(CHARGE_STATUS_META) as ChargeStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{CHARGE_STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as formas</SelectItem>
              {methods.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
                <TableHead>Vencimento</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma cobrança encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const status = effectiveStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{clientName(c.client_id)}</TableCell>
                      <TableCell>{c.service_label ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{c.description}</TableCell>
                      <TableCell>{money(c.amount)}</TableCell>
                      <TableCell>{dateBR(c.due_date)}</TableCell>
                      <TableCell>{methodName(c.payment_method_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CHARGE_STATUS_META[status].className}>
                          {CHARGE_STATUS_META[status].label}
                        </Badge>
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
    </div>
  );
}
