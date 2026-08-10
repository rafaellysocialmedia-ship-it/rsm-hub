import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useContracts, useFinanceAccess, useFinanceClients } from "@/hooks/use-finance";
import {
  CONTRACT_STATUS_META,
  dateBR,
  money,
  nextDueDate,
  periodicityLabel,
  type FinanceContract,
} from "@/lib/finance-core";
import { ContractDialog } from "@/components/finance/contract-dialog";

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

export const Route = createFileRoute("/_authenticated/finance/contracts")({
  head: () => ({
    meta: [
      { title: "Contratos · Financeiro" },
      {
        name: "description",
        content:
          "Contratos por cliente com valor, periodicidade, dia de vencimento e geração de cobranças.",
      },
      { property: "og:title", content: "Contratos · Financeiro" },
      { property: "og:description", content: "Gestão de contratos e recorrências da agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Página não encontrada</div>
  ),
});

function ContractsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const access = useFinanceAccess();
  const { data: contracts = [], isLoading } = useContracts();
  const { data: clients = [] } = useFinanceClients();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceContract | null>(null);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(
    () =>
      contracts.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          clientName(c.client_id).toLowerCase().includes(q) ||
          (c.contract_number ?? "").toLowerCase().includes(q) ||
          (c.service_label ?? "").toLowerCase().includes(q)
        );
      }),
    [contracts, search, clients],
  );

  const generateCharge = useMutation({
    mutationFn: async (contract: FinanceContract) => {
      const due = nextDueDate(contract);
      const { error } = await supabase.from("finance_charges").insert({
        client_id: contract.client_id,
        contract_id: contract.id,
        service_key: contract.service_key,
        service_label: contract.service_label,
        description: `${contract.service_label ?? "Contrato"} · ${periodicityLabel(contract.periodicity)}`,
        amount: contract.amount,
        due_date: due,
        responsible_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-charges"] });
      qc.invalidateQueries({ queryKey: ["finance-history"] });
      toast.success("Cobrança gerada a partir do contrato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!access.loading && !access.canViewContracts) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        Você não possui permissão para acessar os contratos.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Vinculados aos clientes da Central de Gestão de Clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/finance/receivables">Contas a receber</Link>
          </Button>
          {access.canEditContracts && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo contrato
            </Button>
          )}
        </div>
      </header>

      <Input
        placeholder="Buscar por cliente, número ou serviço"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
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
                    Nenhum contrato cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{clientName(c.client_id)}</TableCell>
                    <TableCell>{c.contract_number ?? "—"}</TableCell>
                    <TableCell>{c.service_label ?? "—"}</TableCell>
                    <TableCell>{money(c.amount)}</TableCell>
                    <TableCell>{periodicityLabel(c.periodicity)}</TableCell>
                    <TableCell>{c.due_day ? `Dia ${c.due_day}` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateBR(c.start_date)} → {dateBR(c.end_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CONTRACT_STATUS_META[c.status].className}>
                        {CONTRACT_STATUS_META[c.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {access.canEditContracts && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Gerar cobrança"
                            onClick={() => generateCharge.mutate(c)}
                            disabled={generateCharge.isPending}
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                        {access.canEditContracts && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Editar"
                            onClick={() => {
                              setEditing(c);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContractDialog open={open} onOpenChange={setOpen} contract={editing} />
    </div>
  );
}
