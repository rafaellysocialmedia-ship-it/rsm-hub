import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Users2 } from "lucide-react";

import {
  useCharges,
  useFinanceAccess,
  useFinanceClients,
} from "@/hooks/use-finance";
import { money, dateBR } from "@/lib/finance-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/finance/clients")({
  head: () => ({
    meta: [
      { title: "Carteira Financeira · RSM Gestão de Marketing" },
      {
        name: "description",
        content: "Histórico consolidado do que cada cliente já pagou.",
      },
    ],
  }),
  component: FinanceClientsPage,
});

function FinanceClientsPage() {
  const access = useFinanceAccess();
  const { data: clients = [], isLoading } = useFinanceClients();
  const { data: charges = [] } = useCharges();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return clients
      .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .map((c) => {
        const paid = charges.filter((ch) => ch.client_id === c.id && ch.status === "paid");
        const received = paid.reduce(
          (sum, ch) => sum + Number(ch.amount_received ?? ch.amount ?? 0),
          0,
        );
        const lastPayment = paid
          .map((ch) => ch.paid_date)
          .filter((d): d is string => !!d)
          .sort()
          .at(-1) ?? null;
        return { ...c, received, lastPayment, payments: paid.length };
      })
      .filter((c) => c.received > 0)
      .sort((a, b) => b.received - a.received);
  }, [clients, charges, search]);

  const totalPaid = useMemo(() => rows.reduce((sum, row) => sum + row.received, 0), [rows]);

  if (access.loading) return null;
  if (!access.canView) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        O módulo financeiro é restrito à equipe autorizada.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users2 className="h-6 w-6 text-primary" /> Carteira financeira
          </h1>
          <p className="text-sm text-muted-foreground">
            Somente valores efetivamente recebidos dos clientes · total {money(totalPaid)}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Total já pago</TableHead>
                <TableHead>Pagamentos</TableHead>
                <TableHead>Último pagamento</TableHead>
                <TableHead className="text-right">Ficha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum pagamento recebido ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {money(r.received)}
                    </TableCell>
                    <TableCell>{r.payments}</TableCell>
                    <TableCell>{r.lastPayment ? dateBR(r.lastPayment) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/management/clients/$clientId" params={{ clientId: r.id }}>
                          Abrir
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
