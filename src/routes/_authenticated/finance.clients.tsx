import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Users2 } from "lucide-react";

import {
  useCharges,
  useContracts,
  useFinanceAccess,
  useFinanceClients,
} from "@/hooks/use-finance";
import { effectiveStatus, money } from "@/lib/finance-core";

import { Badge } from "@/components/ui/badge";
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
      { title: "Clientes · Financeiro" },
      {
        name: "description",
        content:
          "Situação financeira de cada cliente: contratos ativos, recebido, pendente e valores em atraso.",
      },
      { property: "og:title", content: "Clientes · Financeiro" },
      { property: "og:description", content: "Panorama financeiro por cliente da agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceClientsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Página não encontrada</div>
  ),
});

function FinanceClientsPage() {
  const access = useFinanceAccess();
  const { data: clients = [], isLoading } = useFinanceClients();
  const { data: charges = [] } = useCharges();
  const { data: contracts = [] } = useContracts();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return clients
      .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .map((c) => {
        let received = 0;
        let pending = 0;
        let overdue = 0;
        for (const ch of charges) {
          if (ch.client_id !== c.id) continue;
          const st = effectiveStatus(ch);
          if (st === "paid") received += Number(ch.amount_received ?? ch.amount ?? 0);
          else if (st === "pending") pending += Number(ch.amount ?? 0);
          else if (st === "overdue") overdue += Number(ch.amount ?? 0);
        }
        const activeContracts = contracts.filter(
          (k) => k.client_id === c.id && k.status === "active",
        );
        const mrr = activeContracts
          .filter((k) => k.periodicity === "monthly")
          .reduce((s, k) => s + Number(k.amount ?? 0), 0);
        return { ...c, received, pending, overdue, contracts: activeContracts.length, mrr };
      })
      .sort((a, b) => b.overdue - a.overdue || b.mrr - a.mrr);
  }, [clients, charges, contracts, search]);

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
            <Users2 className="h-6 w-6 text-primary" /> Clientes · Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Panorama por cliente, sem cadastros duplicados — dados da Central de Gestão de Clientes.
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
                <TableHead>Contratos ativos</TableHead>
                <TableHead>Recorrência mensal</TableHead>
                <TableHead>Recebido</TableHead>
                <TableHead>Pendente</TableHead>
                <TableHead>Vencido</TableHead>
                <TableHead className="text-right">Ficha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.contracts}</TableCell>
                    <TableCell>{money(r.mrr)}</TableCell>
                    <TableCell className="text-emerald-600 dark:text-emerald-400">
                      {money(r.received)}
                    </TableCell>
                    <TableCell className="text-amber-600 dark:text-amber-400">
                      {money(r.pending)}
                    </TableCell>
                    <TableCell>
                      {r.overdue > 0 ? (
                        <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                          {money(r.overdue)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
