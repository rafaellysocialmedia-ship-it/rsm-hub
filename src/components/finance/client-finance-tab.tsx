import { useMemo, useState } from "react";
import { Handshake, Plus, Receipt, Undo2 } from "lucide-react";

import {
  CONTRACT_STATUS_META,
  dateBR,
  money,
  periodicityLabel,
  type FinanceCharge,
} from "@/lib/finance-core";
import { financeSummary } from "@/lib/finance-alerts";
import {
  useCharges,
  useClientServices,
  useContracts,
  useFinanceAccess,
} from "@/hooks/use-finance";
import { useFinanceRequests } from "@/hooks/use-finance-requests";
import { ChargeDialog } from "@/components/finance/charge-dialog";
import { PaymentDialog } from "@/components/finance/payment-dialog";
import { RenegotiateDialog, UndoPaymentDialog } from "@/components/finance/charge-actions";
import { ChargeStatusBadge, chargeRowClass } from "@/components/finance/finance-status";
import { ALERT_ICONS, FinanceAlert, FinanceStat } from "@/components/finance/finance-alerts";
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
export function ClientFinanceTab({
  clientId,
  onTab,
}: {
  clientId: string;
  /** Abre outra aba da página do cliente (ex.: Solicitações). */
  onTab?: (tab: string) => void;
}) {
  const access = useFinanceAccess();
  const { data: charges = [] } = useCharges(clientId);
  const { data: contracts = [] } = useContracts(clientId);
  const { data: services = [] } = useClientServices(clientId);
  const requests = useFinanceRequests(clientId, access.canView);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [paying, setPaying] = useState<FinanceCharge | null>(null);
  const [undoing, setUndoing] = useState<FinanceCharge | null>(null);
  const [renegotiating, setRenegotiating] = useState<FinanceCharge[] | null>(null);
  const [requestNote, setRequestNote] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const summary = useMemo(() => financeSummary(charges), [charges]);
  const overdueCharges = summary.overdue as FinanceCharge[];
  const renegotiationRequests = (requests.data ?? []).filter((r) => r.kind === "renegotiation");
  const closeRequests = (requests.data ?? []).filter((r) => r.kind === "service_close");
  const visible = charges.filter((c) => showCancelled || c.status !== "cancelled");
  const cancelledCount = charges.length - charges.filter((c) => c.status !== "cancelled").length;

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

  const openRenegotiation = (list: FinanceCharge[], note: string | null = null) => {
    setRequestNote(note);
    setRenegotiating(list);
  };

  return (
    <div className="space-y-4">
      {/* Avisos financeiros: do mais urgente ao informativo. */}
      <section aria-label="Avisos financeiros" className="space-y-2.5">
        {renegotiationRequests.map((r) => (
          <FinanceAlert
            key={r.id}
            tone="info"
            icon={ALERT_ICONS.renegotiation}
            title={`O cliente pediu renegociação · ${dateBR(r.created_at.slice(0, 10))}`}
            actions={
              <>
                {access.canEdit && overdueCharges.length + summary.dueSoon.length > 0 && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() =>
                      openRenegotiation(
                        overdueCharges.length
                          ? overdueCharges
                          : ([summary.dueToday[0] ?? summary.dueSoon[0]] as FinanceCharge[]),
                        r.description,
                      )
                    }
                  >
                    <Handshake className="size-3.5" aria-hidden /> Renegociar
                  </Button>
                )}
                {onTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 bg-background text-xs"
                    onClick={() => onTab("support")}
                  >
                    Responder
                  </Button>
                )}
              </>
            }
          >
            {r.description}
          </FinanceAlert>
        ))}
        {closeRequests.map((r) => (
          <FinanceAlert
            key={r.id}
            tone="warning"
            icon={ALERT_ICONS.serviceClose}
            title={`${r.title.replace("[Encerrar serviço]", "Pedido de encerramento:")} · ${dateBR(r.created_at.slice(0, 10))}`}
            actions={
              onTab && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 bg-background text-xs"
                  onClick={() => onTab("support")}
                >
                  Responder
                </Button>
              )
            }
          >
            {r.description} Confira o aviso prévio do contrato antes de encerrar o serviço.
          </FinanceAlert>
        ))}
        {overdueCharges.length > 0 && (
          <FinanceAlert
            tone="danger"
            icon={ALERT_ICONS.overdue}
            title={`${overdueCharges.length} cobrança${overdueCharges.length === 1 ? "" : "s"} vencida${overdueCharges.length === 1 ? "" : "s"} · ${money(summary.overdueTotal)}`}
            actions={
              access.canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-red-500/40 bg-background text-xs"
                  onClick={() => openRenegotiation(overdueCharges)}
                >
                  <Handshake className="size-3.5" aria-hidden />
                  {overdueCharges.length > 1 ? "Renegociar todas" : "Renegociar"}
                </Button>
              )
            }
          >
            A mais antiga venceu há {summary.oldestOverdueDays} dia
            {summary.oldestOverdueDays === 1 ? "" : "s"} ({dateBR(overdueCharges[0].due_date)}).
          </FinanceAlert>
        )}
        {summary.dueToday.length + summary.dueSoon.length > 0 && (
          <FinanceAlert
            tone="warning"
            icon={ALERT_ICONS.dueSoon}
            title={
              summary.dueToday.length
                ? `Vence hoje · ${money(summary.dueToday.reduce((s, c) => s + Number(c.amount), 0))}`
                : `Vence em breve · ${money(summary.dueSoonTotal)}`
            }
          >
            {[...summary.dueToday, ...summary.dueSoon]
              .map((c) => `${c.description} em ${dateBR(c.due_date)}`)
              .join(" · ")}
          </FinanceAlert>
        )}
        {charges.length > 0 &&
          !overdueCharges.length &&
          !summary.dueToday.length &&
          !summary.dueSoon.length &&
          !requests.data?.length && (
            <FinanceAlert tone="success" icon={ALERT_ICONS.ok} title="Financeiro em dia">
              Nenhuma cobrança vencida ou vencendo nos próximos 7 dias.
            </FinanceAlert>
          )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceStat
          tone={overdueCharges.length ? "danger" : "neutral"}
          icon={ALERT_ICONS.overdue}
          label="Vencido"
          value={money(summary.overdueTotal)}
          hint={`${overdueCharges.length} cobrança${overdueCharges.length === 1 ? "" : "s"}`}
        />
        <FinanceStat
          tone={summary.dueSoon.length + summary.dueToday.length ? "warning" : "neutral"}
          icon={ALERT_ICONS.dueSoon}
          label="Próximo vencimento"
          value={summary.next ? money(summary.next.amount) : "—"}
          hint={summary.next ? dateBR(summary.next.due_date) : "Nenhuma cobrança em aberto"}
        />
        <FinanceStat
          tone="success"
          icon={ALERT_ICONS.received}
          label="Recebido no mês"
          value={money(summary.paidThisMonth)}
          hint={`${money(summary.paidThisYear)} no ano`}
        />
        <FinanceStat
          tone="neutral"
          icon={ALERT_ICONS.ok}
          label="Último pagamento"
          value={summary.lastPaid ? money(summary.lastPaid.amount_received ?? summary.lastPaid.amount) : "—"}
          hint={summary.lastPaid?.paid_date ? `Pago em ${dateBR(summary.lastPaid.paid_date)}` : "Sem pagamentos"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Cobranças</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {cancelledCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setShowCancelled(!showCancelled)}
              >
                {showCancelled ? "Ocultar canceladas" : `Mostrar canceladas (${cancelledCount})`}
              </Button>
            )}
            {access.canCreate && (
              <Button size="sm" onClick={() => setChargeOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova cobrança
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma cobrança registrada.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((c) => {
                  const open = c.status !== "paid" && c.status !== "cancelled";
                  return (
                    <TableRow key={c.id} className={chargeRowClass(c)}>
                      <TableCell className="max-w-[240px] truncate">{c.description}</TableCell>
                      <TableCell className="tabular-nums">
                        {money(Number(c.amount))}
                        {c.status === "paid" &&
                          c.amount_received != null &&
                          Number(c.amount_received) !== Number(c.amount) && (
                            <span className="block text-[11px] text-muted-foreground">
                              recebido {money(c.amount_received)}
                            </span>
                          )}
                      </TableCell>
                      <TableCell>
                        {c.competence?.slice(0, 7).split("-").reverse().join("/") || "A definir"}
                      </TableCell>
                      <TableCell>
                        {dateBR(c.due_date)}
                        {c.paid_date && (
                          <span className="block text-[11px] text-muted-foreground">
                            pago em {dateBR(c.paid_date)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChargeStatusBadge charge={c} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {open && access.canEdit && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setPaying(c)}>
                                <Receipt className="mr-1.5 h-4 w-4 text-emerald-600" /> Registrar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-violet-700 hover:text-violet-800 dark:text-violet-300"
                                onClick={() => openRenegotiation([c])}
                              >
                                <Handshake className="mr-1.5 h-4 w-4" /> Renegociar
                              </Button>
                            </>
                          )}
                          {c.status === "paid" && access.canEdit && (
                            <Button size="sm" variant="ghost" onClick={() => setUndoing(c)}>
                              <Undo2 className="mr-1.5 h-4 w-4" /> Desfazer pagamento
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Serviços contratados</CardTitle>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum serviço cadastrado na ficha do cliente.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className={s.situation === "cancelled" ? "text-muted-foreground line-through" : ""}>
                      {s.label ?? s.service_key}
                    </span>
                    <span className="text-muted-foreground">
                      {s.amount != null ? money(Number(s.amount)) : "—"}
                      {s.billing_day ? ` · dia ${s.billing_day}` : ""}
                      {s.situation === "cancelled" ? " · encerrado" : ""}
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
      </div>

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
      <UndoPaymentDialog charge={undoing} onClose={() => setUndoing(null)} />
      <RenegotiateDialog
        charges={renegotiating}
        requestNote={requestNote}
        onClose={() => {
          setRenegotiating(null);
          setRequestNote(null);
        }}
      />
    </div>
  );
}
