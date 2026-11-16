import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  SERVICE_CATALOG,
  SERVICE_SITUATIONS,
  formatDate,
  formatMoney,
  situationMeta,
  type ClientService,
} from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import {
  SERVICE_CHURN_REASONS,
  parseServiceChurn,
  stripServiceChurn,
  withServiceChurn,
} from "@/lib/service-churn";
import { EmptyState, SectionCard } from "./master-shared";
import { PostBalanceCard } from "./post-balance-card";
import { monthsActive, monthsActiveLabel, deliveryState } from "@/lib/digital-assets";
import { countMonthPosts, formatMonth } from "@/lib/post-quota";

export function ServicesTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [serviceKey, setServiceKey] = useState(SERVICE_CATALOG[0].key);
  const [situation, setSituation] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [amount, setAmount] = useState("");
  const [billingDay, setBillingDay] = useState("");
  const [focusBilling, setFocusBilling] = useState(false);
  // Churn de um único serviço (o cliente continua ativo nos demais).
  const [churning, setChurning] = useState<ClientService | null>(null);
  const [churnDate, setChurnDate] = useState("");
  const [churnReason, setChurnReason] = useState("");
  const [churnDetails, setChurnDetails] = useState("");
  const [removing, setRemoving] = useState<ClientService | null>(null);
  const openChurn = (service: ClientService) => {
    const previous = parseServiceChurn(service.notes);
    setChurnDate(previous?.date ?? new Date().toLocaleDateString("en-CA"));
    setChurnReason(previous?.reason ?? "");
    setChurnDetails(previous?.details ?? "");
    setChurning(service);
  };
  const openNew = () => {
    setServiceKey(SERVICE_CATALOG[0].key);
    setSituation("active");
    setStartDate("");
    setAmount("");
    setBillingDay("");
    setFocusBilling(false);
    setOpen(true);
  };
  const openEdit = (service: ClientService, focusDueDay = false) => {
    setServiceKey(service.service_key);
    setSituation(service.situation);
    setStartDate(service.start_date ?? "");
    setAmount(service.amount == null ? "" : String(service.amount));
    setBillingDay(service.billing_day == null ? "" : String(service.billing_day));
    setFocusBilling(focusDueDay);
    setOpen(true);
  };

  const { data: services = [] } = useQuery({
    queryKey: ["client-services", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_services")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientService[];
    },
  });

  const { data: quota } = useQuery({
    queryKey: ["client-quota", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("monthly_post_quota")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data?.monthly_post_quota ?? 0) as number;
    },
  });

  const { data: monthPosts = [] } = useQuery({
    queryKey: ["client-month-posts", clientId],
    queryFn: async () => {
      const ref = new Date();
      const first = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("posts")
        .select("client_id,status,scheduled_date")
        .eq("client_id", clientId)
        .gte("scheduled_date", first)
        .lte("scheduled_date", last);
      if (error) throw error;
      return data ?? [];
    },
  });

  const usedThisMonth = countMonthPosts(monthPosts as never, clientId);

  const upsert = useMutation({
    mutationFn: async () => {
      if (billingDay && (!Number.isInteger(Number(billingDay)) || Number(billingDay) < 1 || Number(billingDay) > 28)) {
        throw new Error("O vencimento deve ser um dia entre 1 e 28.");
      }
      const label = SERVICE_CATALOG.find((s) => s.key === serviceKey)?.label ?? serviceKey;
      const { error } = await supabase.from("client_services").upsert(
        {
          client_id: clientId,
          service_key: serviceKey,
          label,
          situation,
          start_date: startDate || null,
          amount: amount ? Number(amount) : null,
          billing_day: billingDay ? Number(billingDay) : null,
          created_by: user?.id ?? null,
        } as never,
        { onConflict: "client_id,service_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-services", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      toast.success("Serviço salvo");
      setOpen(false);
      setStartDate("");
      setAmount("");
      setBillingDay("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeSituation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("client_services")
        .update({ situation: value } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-services", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const churnService = useMutation({
    mutationFn: async () => {
      if (!churning) return;
      if (!churnDate || !churnReason)
        throw new Error("Informe a data e o motivo do encerramento.");
      if (churnReason === "Outro" && !churnDetails.trim())
        throw new Error("Para o motivo Outro, descreva o que aconteceu.");
      const { error } = await supabase
        .from("client_services")
        .update({
          situation: "cancelled",
          notes: withServiceChurn(churning.notes, {
            date: churnDate,
            reason: churnReason,
            details: churnDetails,
          }),
        } as never)
        .eq("id", churning.id);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ["client-services", "client-timeline", "header-facts", "retention"])
        qc.invalidateQueries({ queryKey: [key] });
      toast.success("Serviço encerrado. As próximas mensalidades dele não serão geradas.");
      setChurning(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: async (service: ClientService) => {
      const { error } = await supabase
        .from("client_services")
        .update({ situation: "active", notes: stripServiceChurn(service.notes) || null } as never)
        .eq("id", service.id);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ["client-services", "client-timeline", "header-facts", "retention"])
        qc.invalidateQueries({ queryKey: [key] });
      toast.success("Serviço reativado. A mensalidade volta a ser gerada no próximo ciclo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-services", clientId] });
      toast.success("Serviço removido");
      setRemoving(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
    <SectionCard
      collapsible
      title="Serviços contratados"
      description="Valor e vencimento de cada serviço. Para registrar o churn de um só serviço, use Encerrar serviço."
      actions={
        canEdit ? (
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        ) : undefined
      }
    >
      {services.length === 0 ? (
        <EmptyState>Nenhum serviço registrado para este cliente.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {services.map((s) => {
            const meta = situationMeta(s.situation);
            const months = monthsActive(s.start_date);
            const isPostService = s.service_key === "social_media";
            const ended = s.situation === "cancelled";
            const churn = ended ? parseServiceChurn(s.notes) : null;
            const delivery =
              isPostService && !ended ? deliveryState(usedThisMonth, quota ?? 0) : null;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{s.label || s.service_key}</p>
                    <Badge variant="outline" className="bg-muted/50 text-[11px] font-normal">
                      {monthsActiveLabel(months)}
                    </Badge>
                    {delivery && (
                      <Badge variant="outline" className={`text-[11px] font-normal ${delivery.tone}`}>
                        {delivery.label} · {formatMonth()}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Início: {formatDate(s.start_date)} · Valor: {formatMoney(s.amount)}
                  </p>
                  {ended && (
                    <p className="mt-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs">
                      <span className="font-medium text-destructive">Serviço encerrado</span>
                      {churn
                        ? ` em ${formatDate(churn.date)} · ${churn.reason}${churn.details ? ` · ${churn.details}` : ""}`
                        : " · motivo não registrado"}
                    </p>
                  )}
                  <div className={`mt-2 flex-wrap items-center gap-2 ${ended ? "hidden" : "flex"}`}>
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${s.billing_day ? "border-border/70 bg-muted/40 text-foreground" : s.situation === "active" && s.auto_billing ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" : "border-border/60 bg-muted/30 text-muted-foreground"}`}>
                      {s.situation === "active" && s.auto_billing && !s.billing_day
                        ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                        : <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />}
                      {s.billing_day ? `Vencimento: todo dia ${s.billing_day}` : "Vencimento não configurado"}
                    </span>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openEdit(s, true)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {s.billing_day ? "Alterar vencimento" : "Configurar vencimento"}
                      </Button>
                    )}
                  </div>
                  {s.situation === "active" && s.auto_billing && Number(s.amount) > 0 && !s.billing_day && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      A cobrança automática utiliza o dia 5 provisoriamente até a configuração.
                    </p>
                  )}
                </div>
                {canEdit ? (
                  <Select
                    value={s.situation}
                    onValueChange={(v) =>
                      // "Cancelado" passa pelo registro de churn para guardar data e motivo.
                      v === "cancelled" ? openChurn(s) : changeSituation.mutate({ id: s.id, value: v })
                    }
                  >
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_SITUATIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={meta.tone}>
                    {meta.label}
                  </Badge>
                )}
                {canEdit &&
                  (ended ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      disabled={reactivate.isPending}
                      onClick={() => reactivate.mutate(s)}
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" /> Reativar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Registrar churn somente deste serviço"
                      onClick={() => openChurn(s)}
                    >
                      <UserMinus className="size-3.5" aria-hidden="true" /> Encerrar serviço
                    </Button>
                  ))}
                {canEdit && (
                   <Button size="icon" variant="ghost" className="h-8 w-8"
                     aria-label={`Editar ${s.label || s.service_key}`} title="Editar serviço e vencimento"
                     onClick={() => openEdit(s)}>
                     <Pencil className="h-4 w-4" />
                   </Button>
                 )}
                 {canEdit && (
                   <Button
                     size="icon"
                     variant="ghost"
                     className="h-8 w-8 text-destructive"
                    aria-label={`Excluir ${s.label || s.service_key}`}
                    title="Excluir o serviço do cadastro (não é churn)"
                    onClick={() => setRemoving(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{focusBilling ? "Configurar vencimento do serviço" : "Serviço contratado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Serviço</Label>
              <Select value={serviceKey} onValueChange={setServiceKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATALOG.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Situação</Label>
              <Select value={situation} onValueChange={setSituation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_SITUATIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Data de início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-[#b283f3]/40 bg-[#b283f3]/10 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 shrink-0 text-[#42145d] dark:text-[#b283f3]" aria-hidden="true" />
              <Label htmlFor="service-billing-day" className="text-sm font-semibold">
                Dia de vencimento da mensalidade
              </Label>
            </div>
            <Input
              id="service-billing-day"
              aria-describedby="service-billing-help"
              type="number"
              min={1}
              max={28}
              step={1}
              value={billingDay}
              autoFocus={focusBilling}
              onChange={(e) => setBillingDay(e.target.value)}
              placeholder="Ex.: 10"
              className="max-w-40 bg-background text-base"
            />
            <p id="service-billing-help" className="text-xs text-muted-foreground">
              Informe um dia de 1 a 28. Sem configuração, a cobrança automática utiliza o dia 5 provisoriamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!churning} onOpenChange={(o) => !o && !churnService.isPending && setChurning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar {churning?.label || churning?.service_key}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O churn vale só para este serviço. O cliente continua ativo e os outros serviços seguem
            normalmente.
          </p>
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service-churn-date" className="text-xs text-muted-foreground">
                Data do encerramento
              </Label>
              <Input
                id="service-churn-date"
                type="date"
                value={churnDate}
                onChange={(e) => setChurnDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Motivo</Label>
              <Select value={churnReason} onValueChange={setChurnReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CHURN_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service-churn-details" className="text-xs text-muted-foreground">
                Detalhes {churnReason === "Outro" ? "(obrigatório)" : "(opcional)"}
              </Label>
              <Textarea
                id="service-churn-details"
                rows={3}
                maxLength={500}
                value={churnDetails}
                onChange={(e) => setChurnDetails(e.target.value)}
              />
            </div>
            <ul className="list-disc space-y-1 rounded-lg border bg-muted/30 py-2.5 pl-7 pr-3 text-xs text-muted-foreground">
              <li>As próximas mensalidades deste serviço deixam de ser geradas.</li>
              <li>Cobranças já lançadas e pagamentos continuam no financeiro.</li>
              <li>O serviço fica no histórico e pode ser reativado depois.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChurning(null)} disabled={churnService.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => churnService.mutate()}
              disabled={churnService.isPending}
            >
              {churnService.isPending ? "Salvando…" : "Encerrar serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && !remove.isPending && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.label || removing?.service_key}?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir apaga o serviço do cadastro, sem deixar registro. Se o cliente parou de
              contratar este serviço, use “Encerrar serviço” para guardar a data e o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (removing) remove.mutate(removing.id);
              }}
            >
              Excluir do cadastro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
    <PostBalanceCard clientId={clientId} canEdit={canEdit} />
    </div>
  );
}
