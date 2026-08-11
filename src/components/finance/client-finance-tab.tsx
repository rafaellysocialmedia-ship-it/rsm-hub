import { useMemo, useState } from "react";
import { Plus, Receipt } from "lucide-react";

import {
  CHARGE_STATUS_META,
  CONTRACT_STATUS_META,
  dateBR,
  effectiveStatus,
  money,
  periodicityLabel,
  type FinanceCharge,
} from "@/lib/finance-core";
import {
  useCharges,
  useClientServices,
  useContracts,
  useFinanceAccess,
} from "@/hooks/use-finance";
import { ChargeDialog } from "@/components/finance/charge-dialog";
import { PaymentDialog } from "@/components/finance/payment-dialog";
import { FinanceHistoryTimeline } from "@/components/finance/finance-history-timeline";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Aba interna (somente equipe autorizada) com a situação financeira do cliente. */
export function ClientFinanceTab({ clientId }: { clientId: string }) {
  const access = useFinanceAccess();
  const { data: charges = [] } = useCharges(clientId);
  const { data: contracts = [] } = useContracts(clientId);
  const { data: services = [] } = useClientServices(clientId);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [paying, setPaying] = useState<FinanceCharge | null>(null);

  const totals = useMemo(() => {
    let received = 0;
    let pending = 0;
    let overdue = 0;
    for (const c of charges) {
      const st = effectiveStatus(c);
      if (st === "paid") received += Number(c.amount_received ?? c.amount ?? 0);
      else if (st === "pending") pending += Number(c.amount ?? 0);
      else if (st === "overdue") overdue += Number(c.amount ?? 0);
    }
    return { received, pending, overdue };
  }, [charges]);

  if (access.loading) return null;
  if (!access.canView) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Você não tem permissão para visualizar informações financeiras.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Recebido" value={money(totals.received)} tone="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard label="Pendente" value={money(totals.pending)} tone="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Vencido" value={money(totals.overdue)} tone="text-destructive" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Serviços contratados</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado na ficha do cliente.</p>
          ) : (
            <ul className="divide-y divide-border">
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{s.label ?? s.service_key}</span>
                  <span className="text-muted-foreground">
                    {s.amount != null ? money(Number(s.amount)) : "—"} · {s.situation}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contracts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">
                    {c.service_label ?? c.service_key} · {money(Number(c.amount))}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {periodicityLabel(c.periodicity)}
                    <Badge variant="outline" className={CONTRACT_STATUS_META[c.status].className}>
                      {CONTRACT_STATUS_META[c.status].label}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Cobranças</CardTitle>
          {access.canCreate && (
            <Button size="sm" onClick={() => setChargeOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova cobrança
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma cobrança registrada.
                  </TableCell>
                </TableRow>
              ) : (
                charges.map((c) => {
                  const st = effectiveStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[240px] truncate">{c.description}</TableCell>
                      <TableCell>{money(Number(c.amount))}</TableCell>
                      <TableCell>{dateBR(c.due_date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CHARGE_STATUS_META[st].className}>
                          {CHARGE_STATUS_META[st].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {st !== "paid" && st !== "cancelled" && access.canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => setPaying(c)}>
                            <Receipt className="mr-1.5 h-4 w-4" /> Registrar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <FinanceHistoryTimeline clientId={clientId} />
        </CardContent>
      </Card>

      <ChargeDialog open={chargeOpen} onOpenChange={setChargeOpen} fixedClientId={clientId} />
      <PaymentDialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)} charge={paying} />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
