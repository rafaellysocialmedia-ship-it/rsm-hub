import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Handshake, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { dateBR, money } from "@/lib/finance-core";
import {
  RENEGOTIATION_PREFIX,
  SERVICE_CLOSE_PREFIX,
  financeSummary,
  requestKind,
  type ChargeLike,
} from "@/lib/finance-alerts";
import { safeExternalUrl, type PortalAccount } from "@/lib/account-workspace";
import { REQUEST_STATUS } from "@/lib/plan-completion";
import { ALERT_ICONS, FinanceAlert, FinanceStat } from "@/components/finance/finance-alerts";
import { ChargeStatusBadge, chargeRowClass } from "@/components/finance/finance-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PortalCharge = PortalAccount["charges"][number];

const NOT_MONTHLY = new Set(["Aviso prévio", "Acordo de renegociação"]);

function friendlyError(error: Error) {
  return /row-level security|violates/i.test(error.message)
    ? "Não foi possível enviar agora. Se sua conta estiver encerrada ou pausada, fale com a RSM pelo WhatsApp."
    : error.message;
}

/** Pedidos de renegociação e encerramento feitos pelo próprio cliente. */
function useMyFinanceRequests(clientId: string) {
  return useQuery({
    queryKey: ["client-requests", clientId, "portal-finance"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_requests")
        .select("id,title,description,status,response,created_at,updated_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({ ...r, kind: requestKind(r.title) }))
        .filter((r) => r.kind !== null);
    },
  });
}

function useCreateRequest(clientId: string, onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      const { error } = await supabase.from("client_requests").insert({
        client_id: clientId,
        kind: "support",
        title: title.slice(0, 200),
        description: description.slice(0, 4000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-requests"] });
      onDone();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });
}

/** Mensalidade atual: soma das mensalidades do mês mais recente cobrado. */
function currentMonthly(account: PortalAccount) {
  const monthly = account.charges.filter(
    (c) => c.status !== "cancelled" && !NOT_MONTHLY.has(c.service_label ?? ""),
  );
  const latest = monthly.map((c) => c.due_date.slice(0, 7)).sort().at(-1);
  if (latest) {
    return monthly
      .filter((c) => c.due_date.startsWith(latest))
      .reduce((s, c) => s + Number(c.amount), 0);
  }
  const contracts = account.contracts.filter(
    (c) => c.status === "active" && c.periodicity === "monthly",
  );
  return contracts.length ? contracts.reduce((s, c) => s + Number(c.amount), 0) : null;
}

/** Aviso curto para o início do portal. Não mostra nada quando está tudo em dia. */
export function PortalFinanceNotice({
  account,
  onOpen,
}: {
  account: PortalAccount;
  onOpen: () => void;
}) {
  const summary = useMemo(() => financeSummary(account.charges as ChargeLike[]), [account.charges]);
  if (!account.can_view_finance) return null;
  if (summary.overdue.length)
    return (
      <FinanceAlert
        tone="danger"
        icon={ALERT_ICONS.overdue}
        title={`${summary.overdue.length === 1 ? "Você tem 1 mensalidade vencida" : `Você tem ${summary.overdue.length} mensalidades vencidas`} · ${money(summary.overdueTotal)}`}
        actions={
          <Button size="sm" variant="outline" className="h-8 bg-background text-xs" onClick={onOpen}>
            Ver financeiro
          </Button>
        }
      >
        Vencimento em {dateBR(summary.overdue[0].due_date)}. Se precisar de outra condição, você
        pode pedir uma renegociação.
      </FinanceAlert>
    );
  const soon = summary.dueToday[0] ?? summary.dueSoon[0];
  if (soon)
    return (
      <FinanceAlert
        tone="warning"
        icon={ALERT_ICONS.dueSoon}
        title={
          summary.dueToday.length
            ? `Sua mensalidade vence hoje · ${money(soon.amount)}`
            : `Sua mensalidade vence em ${dateBR(soon.due_date)} · ${money(soon.amount)}`
        }
        actions={
          <Button size="sm" variant="outline" className="h-8 bg-background text-xs" onClick={onOpen}>
            Ver financeiro
          </Button>
        }
      />
    );
  return null;
}

export function PortalFinance({ account }: { account: PortalAccount }) {
  const charges = account.charges as (PortalCharge & ChargeLike)[];
  const summary = useMemo(() => financeSummary(charges), [charges]);
  const requests = useMyFinanceRequests(account.id);
  const [asking, setAsking] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const monthly = currentMonthly(account);
  const year = new Date().getFullYear();
  const open = charges
    .filter((c) => c.status !== "paid" && c.status !== "cancelled")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paid = summary.paid as typeof charges;
  const cancelled = charges.filter((c) => c.status === "cancelled");
  const renegotiation = (requests.data ?? []).find((r) => r.kind === "renegotiation");
  const pendingRenegotiation = renegotiation && renegotiation.status !== "done";

  const row = (c: (typeof charges)[number], actions = true) => (
    <li
      key={c.id}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 ${chargeRowClass(c)}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{c.service_label || "Mensalidade"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Vencimento {dateBR(c.due_date)}
          {c.paid_date && ` · Pago em ${dateBR(c.paid_date)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold tabular-nums">{money(c.amount)}</span>
        <ChargeStatusBadge charge={c} />
        {actions && safeExternalUrl(c.payment_url) && (
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <a href={safeExternalUrl(c.payment_url)!} target="_blank" rel="noopener noreferrer">
              Pagar <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <section aria-label="Avisos do financeiro" className="space-y-2.5">
        {summary.overdue.length > 0 && (
          <FinanceAlert
            tone="danger"
            icon={ALERT_ICONS.overdue}
            title={`${summary.overdue.length === 1 ? "1 mensalidade vencida" : `${summary.overdue.length} mensalidades vencidas`} · ${money(summary.overdueTotal)}`}
          >
            A mais antiga venceu em {dateBR(summary.overdue[0].due_date)}. Se não conseguir pagar
            nesse valor ou data, peça uma renegociação abaixo.
          </FinanceAlert>
        )}
        {summary.dueToday.length + summary.dueSoon.length > 0 && (
          <FinanceAlert
            tone="warning"
            icon={ALERT_ICONS.dueSoon}
            title={
              summary.dueToday.length
                ? `Vence hoje · ${money(summary.dueToday.reduce((s, c) => s + Number(c.amount), 0))}`
                : `Próximo vencimento em ${dateBR(summary.dueSoon[0].due_date)} · ${money(summary.dueSoon[0].amount)}`
            }
          >
            Avisamos aqui sempre que uma mensalidade estiver a até 7 dias do vencimento.
          </FinanceAlert>
        )}
        {pendingRenegotiation && (
          <FinanceAlert
            tone="info"
            icon={ALERT_ICONS.renegotiation}
            title={`Pedido de renegociação enviado em ${dateBR(renegotiation.created_at.slice(0, 10))} · ${REQUEST_STATUS[renegotiation.status as keyof typeof REQUEST_STATUS] ?? renegotiation.status}`}
          >
            {renegotiation.response
              ? `Resposta da RSM: ${renegotiation.response}`
              : "A RSM vai analisar e responder por aqui."}
          </FinanceAlert>
        )}
        {charges.length > 0 && !open.length && (
          <FinanceAlert tone="success" icon={ALERT_ICONS.ok} title="Tudo em dia">
            Nenhuma mensalidade em aberto. Obrigado!
          </FinanceAlert>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceStat
          tone="neutral"
          icon={ALERT_ICONS.received}
          label="Mensalidade"
          value={monthly != null ? money(monthly) : "A definir"}
          hint={account.plan ? `Plano ${account.plan}` : undefined}
        />
        <FinanceStat
          tone={summary.overdue.length ? "danger" : summary.dueSoon.length || summary.dueToday.length ? "warning" : "neutral"}
          icon={ALERT_ICONS.dueSoon}
          label="Próximo vencimento"
          value={summary.overdue[0] ? dateBR(summary.overdue[0].due_date) : summary.next ? dateBR(summary.next.due_date) : "Nenhum"}
          hint={summary.overdue[0] ? "Vencido" : summary.next ? money(summary.next.amount) : "Nada em aberto"}
        />
        <FinanceStat
          tone="success"
          icon={ALERT_ICONS.ok}
          label={`Pago em ${year}`}
          value={money(summary.paidThisYear)}
          hint={`${paid.filter((c) => (c.paid_date ?? "").startsWith(String(year))).length} mensalidades`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Em aberto</CardTitle>
          {open.length > 0 && !pendingRenegotiation && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAsking(true)}>
              <Handshake className="size-4" aria-hidden /> Pedir renegociação
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {open.length ? (
            <ul className="divide-y">{open.map((c) => row(c))}</ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Nenhuma mensalidade em aberto.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Mensalidades pagas</CardTitle>
          {cancelled.length > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowCancelled(!showCancelled)}>
              {showCancelled ? "Ocultar canceladas" : `Ver canceladas (${cancelled.length})`}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {paid.length ? (
            <ul className="divide-y">{paid.map((c) => row(c, false))}</ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
          )}
          {showCancelled && cancelled.length > 0 && (
            <ul className="mt-3 divide-y border-t pt-2">{cancelled.map((c) => row(c, false))}</ul>
          )}
        </CardContent>
      </Card>

      <ServiceCloseCard account={account} />

      <RenegotiationRequestDialog
        open={asking}
        onOpenChange={setAsking}
        clientId={account.id}
        charges={open}
      />
    </div>
  );
}

const PAYMENT_WISHES = [
  "Parcelar o valor",
  "Mudar a data de vencimento",
  "Pagar uma parte agora e o restante depois",
  "Outra proposta",
];

function RenegotiationRequestDialog({
  open,
  onOpenChange,
  clientId,
  charges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  charges: ChargeLike[];
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [wish, setWish] = useState(PAYMENT_WISHES[0]);
  const [message, setMessage] = useState("");
  const defaults = charges.filter((c) => c.due_date <= today).map((c) => c.id);
  const ids = selected ?? (defaults.length ? defaults : charges.slice(0, 1).map((c) => c.id));
  const chosen = charges.filter((c) => ids.includes(c.id));
  const total = chosen.reduce((s, c) => s + Number(c.amount), 0);
  const close = () => {
    onOpenChange(false);
    setSelected(null);
    setMessage("");
    setWish(PAYMENT_WISHES[0]);
  };
  const send = useCreateRequest(clientId, () => {
    toast.success("Pedido de renegociação enviado. A RSM vai responder por aqui.");
    close();
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : !send.isPending && close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pedir renegociação</DialogTitle>
          <DialogDescription>
            Conte o que fica melhor para você. A RSM analisa o pedido e responde por aqui; nada muda
            nas suas mensalidades até a resposta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quais mensalidades?</legend>
            {charges.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 rounded-md border p-2 text-sm">
                <Checkbox
                  checked={ids.includes(c.id)}
                  onCheckedChange={(v) =>
                    setSelected(v ? [...ids, c.id] : ids.filter((id) => id !== c.id))
                  }
                />
                <span className="flex-1">
                  {c.service_label || "Mensalidade"} · venc. {dateBR(c.due_date)}
                </span>
                <span className="font-medium tabular-nums">{money(c.amount)}</span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label>O que você gostaria?</Label>
            <Select value={wish} onValueChange={setWish}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_WISHES.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renegotiation-message">Sua proposta</Label>
            <Textarea
              id="renegotiation-message"
              rows={3}
              maxLength={1500}
              placeholder="Ex.: consigo pagar em 2 parcelas, nos dias 10 e 25."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={send.isPending || !chosen.length || message.trim().length < 2}
            onClick={() =>
              send.mutate({
                title: `${RENEGOTIATION_PREFIX} ${chosen.length === 1 ? "1 mensalidade" : `${chosen.length} mensalidades`} · ${money(total)}`,
                description:
                  `${wish}. ${message.trim()}\n\nMensalidades: ` +
                  chosen
                    .map((c) => `${c.service_label || "Mensalidade"} venc. ${dateBR(c.due_date)} (${money(c.amount)})`)
                    .join("; "),
              })
            }
          >
            {send.isPending ? "Enviando…" : "Enviar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CLOSE_REASONS = [
  "Questões financeiras",
  "Não estou vendo os resultados que esperava",
  "Vou pausar o marketing por um tempo",
  "Vou fazer internamente",
  "Contratei outra empresa",
  "Outro motivo",
];

/** Cartão para o cliente pedir o encerramento de um serviço pela plataforma. */
export function ServiceCloseCard({ account }: { account: PortalAccount }) {
  const requests = useMyFinanceRequests(account.id);
  const [open, setOpen] = useState(false);
  const services = useMemo(() => {
    const labels = new Set<string>();
    for (const c of account.charges)
      if (c.service_label && !NOT_MONTHLY.has(c.service_label)) labels.add(c.service_label);
    for (const c of account.contracts)
      if (c.status === "active" && c.service_label) labels.add(c.service_label);
    return [...labels].sort();
  }, [account.charges, account.contracts]);
  const pending = (requests.data ?? []).find(
    (r) => r.kind === "service_close" && r.status !== "done",
  );

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <LogOut className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Encerrar serviço</p>
          <p className="text-xs text-muted-foreground">
            {pending
              ? `Pedido enviado em ${dateBR(pending.created_at.slice(0, 10))} · ${REQUEST_STATUS[pending.status as keyof typeof REQUEST_STATUS] ?? pending.status}.${pending.response ? ` Resposta da RSM: ${pending.response}` : " A RSM vai entrar em contato."}`
              : "Se quiser encerrar um dos serviços contratados, envie o pedido por aqui. A RSM entra em contato para combinar o encerramento."}
          </p>
        </div>
        {!pending && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Pedir encerramento
          </Button>
        )}
      </CardContent>
      <ServiceCloseDialog
        open={open}
        onOpenChange={setOpen}
        clientId={account.id}
        services={services}
      />
    </Card>
  );
}

function ServiceCloseDialog({
  open,
  onOpenChange,
  clientId,
  services,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  services: string[];
}) {
  const options = [...services, "Todos os serviços"];
  const [service, setService] = useState(options[0]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const close = () => {
    onOpenChange(false);
    setReason("");
    setMessage("");
  };
  const send = useCreateRequest(clientId, () => {
    toast.success("Pedido de encerramento enviado. A RSM vai entrar em contato.");
    close();
  });
  const needsText = reason === "Outro motivo";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : !send.isPending && close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar serviço</DialogTitle>
          <DialogDescription>
            O pedido não encerra o serviço na hora. A RSM vai conversar com você e seguir o aviso
            prévio previsto no contrato.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Qual serviço?</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-message">
              Quer contar mais? {needsText ? "(obrigatório)" : "(opcional)"}
            </Label>
            <Textarea
              id="close-message"
              rows={3}
              maxLength={1500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={send.isPending}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={send.isPending || !reason || (needsText && message.trim().length < 2)}
            onClick={() =>
              send.mutate({
                title: `${SERVICE_CLOSE_PREFIX} ${service}`,
                description: `Motivo: ${reason}.${message.trim() ? ` ${message.trim()}` : ""}`,
              })
            }
          >
            {send.isPending ? "Enviando…" : "Enviar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
