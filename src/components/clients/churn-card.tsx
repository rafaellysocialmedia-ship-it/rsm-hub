import { ListSkeleton } from "@/components/skeletons";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinanceAccess } from "@/hooks/use-finance";
import { money } from "@/lib/finance-core";
import {
  noticeLabel,
  parseNotice,
  stripNotice,
  withNotice,
  type NoticeMode,
} from "@/lib/notice-period";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const reasons = [
  "Questões financeiras",
  "Insatisfação com os resultados",
  "Insatisfação com o atendimento",
  "Mudança de estratégia",
  "Contratou outro fornecedor",
  "Encerramento da empresa",
  "Não renovou o contrato",
  "Outro",
];

const NOTICE_OPTIONS: { value: NoticeMode; label: string; hint: string }[] = [
  {
    value: "serve",
    label: "Cumprir aviso prévio",
    hint: "O cliente paga o período de aviso combinado em contrato.",
  },
  { value: "waived", label: "Aviso prévio dispensado", hint: "A RSM abriu mão do aviso prévio." },
  { value: "none", label: "Não se aplica", hint: "O contrato não prevê aviso prévio." },
];

const NOTICE_DESCRIPTION = "Aviso prévio";

type Churn = {
  name: string;
  churned: boolean;
  churn_date: string | null;
  churn_reason: string | null;
  churn_notes: string | null;
};

const REFRESH_KEYS = [
  "retention",
  "clients",
  "management-clients",
  "management-client",
  "client-churn",
  "journey-events",
  "finance-contracts",
  "finance-charges",
  "finance-history",
  "finance-clients",
  "client-services",
  "meetings-clients",
  "dash-posts",
  "dash-approvals",
  "dash-tasks",
  "dash-meetings",
  "dash-activity",
  "posts",
  "tasks",
  "posts-control-clients",
  "traffic-clients",
  "header-facts",
];

export function ChurnCard({ clientId }: { clientId: string }) {
  const { hasRole, user } = useAuth();
  const finance = useFinanceAccess();
  const canManage = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const [churned, setChurned] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [noticeMode, setNoticeMode] = useState<NoticeMode>("none");
  const [noticeAmount, setNoticeAmount] = useState("");
  const [noticeUntil, setNoticeUntil] = useState("");
  const [launchCharge, setLaunchCharge] = useState(true);
  const [chargeDue, setChargeDue] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-churn", clientId],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("name,churned,churn_date,churn_reason,churn_notes")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data as unknown as Churn;
    },
  });

  // Cobrança de aviso prévio já lançada para este cliente (evita duplicar).
  const noticeCharge = useQuery({
    queryKey: ["finance-charges", "notice", clientId],
    enabled: canManage && finance.canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_charges")
        .select("id,amount,due_date,status")
        .eq("client_id", clientId)
        .eq("description", NOTICE_DESCRIPTION)
        .neq("status", "cancelled")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  useEffect(() => {
    if (!data) return;
    setChurned(data.churned);
    setDate(data.churn_date ?? "");
    setReason(data.churn_reason ?? "");
    setNotes(stripNotice(data.churn_notes));
    const notice = parseNotice(data.churn_notes);
    setNoticeMode(notice.mode);
    setNoticeAmount(notice.mode === "serve" && notice.amount ? String(notice.amount) : "");
    setNoticeUntil(notice.mode === "serve" ? (notice.until ?? "") : "");
    setChargeDue(notice.mode === "serve" ? (notice.until ?? "") : "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (churned && (!date || !reason || (reason === "Outro" && !notes.trim())))
        throw new Error(
          "Preencha a data e o motivo do churn. Para Outro, descreva o motivo.",
        );
      const amount = Number(noticeAmount.replace(",", "."));
      if (churned && noticeMode === "serve" && (!Number.isFinite(amount) || amount <= 0))
        throw new Error("Informe o valor do aviso prévio, ou marque como dispensado.");
      const notice =
        noticeMode === "serve"
          ? { mode: "serve" as const, amount, until: noticeUntil || null }
          : noticeMode === "waived"
            ? { mode: "waived" as const }
            : { mode: "none" as const };
      const shouldCharge =
        churned &&
        noticeMode === "serve" &&
        launchCharge &&
        finance.canCreate &&
        !noticeCharge.data;
      if (shouldCharge && !chargeDue) throw new Error("Informe o vencimento da cobrança do aviso prévio.");

      const { error } = await supabase
        .from("clients")
        .update({
          churned,
          churn_date: date || null,
          churn_reason: reason || null,
          churn_notes: (churned ? withNotice(notes, notice) : notes.trim()) || null,
          ...(churned ? { status: "inactive" as const, journey_stage: "offboarded" as const } : {}),
        } as never)
        .eq("id", clientId)
        .select("id")
        .single();
      if (error) throw error;

      if (shouldCharge) {
        const charge = await supabase.from("finance_charges").insert({
          client_id: clientId,
          service_key: null,
          service_label: NOTICE_DESCRIPTION,
          description: NOTICE_DESCRIPTION,
          amount,
          due_date: chargeDue,
          status: "pending",
          notes: `Lançada no churn do cliente${noticeUntil ? ` · aviso prévio até ${noticeUntil.split("-").reverse().join("/")}` : ""}.`,
          responsible_id: user?.id ?? null,
          created_by: user?.id ?? null,
        });
        if (charge.error)
          throw new Error(
            `O churn foi salvo, mas a cobrança do aviso prévio não foi lançada: ${charge.error.message}`,
          );
      }
      return shouldCharge;
    },
    onSuccess: (charged) => {
      toast.success(
        charged ? "Churn salvo e cobrança do aviso prévio lançada no financeiro" : "Churn atualizado",
      );
      for (const key of REFRESH_KEYS) qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      for (const key of REFRESH_KEYS) qc.invalidateQueries({ queryKey: [key] });
    },
  });

  if (!canManage) return null;
  const savedNotice = data?.churned ? noticeLabel(parseNotice(data.churn_notes)) : null;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Churn do cliente</CardTitle>
        {savedNotice && <p className="text-sm text-muted-foreground">{savedNotice}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive">Não foi possível carregar o churn.</p>
        ) : isLoading ? (
          <ListSkeleton rows={2} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch
                id={`churn-${clientId}`}
                checked={churned}
                onCheckedChange={(v) => {
                  setChurned(v);
                  if (v && !date) setDate(new Date().toLocaleDateString("en-CA"));
                }}
              />
              <Label htmlFor={`churn-${clientId}`}>Cliente deu churn</Label>
            </div>

            {(churned || date || reason || notes) && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor={`churn-date-${clientId}`}>Data do encerramento</Label>
                  <Input
                    id={`churn-date-${clientId}`}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Motivo do churn</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <fieldset className="space-y-3 rounded-lg border p-3">
                  <legend className="px-1 text-sm font-medium">Aviso prévio</legend>
                  <RadioGroup
                    value={noticeMode}
                    onValueChange={(v) => setNoticeMode(v as NoticeMode)}
                    className="gap-2"
                  >
                    {NOTICE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        htmlFor={`notice-${option.value}-${clientId}`}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 hover:bg-muted/40"
                      >
                        <RadioGroupItem
                          id={`notice-${option.value}-${clientId}`}
                          value={option.value}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-medium">{option.label}</span>
                          <span className="block text-xs text-muted-foreground">{option.hint}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>

                  {noticeMode === "serve" && (
                    <div className="space-y-3 border-t pt-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`notice-amount-${clientId}`}>Valor do aviso prévio (R$)</Label>
                          <Input
                            id={`notice-amount-${clientId}`}
                            inputMode="decimal"
                            placeholder="Ex.: 800"
                            value={noticeAmount}
                            onChange={(e) => setNoticeAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`notice-until-${clientId}`}>Aviso prévio até</Label>
                          <Input
                            id={`notice-until-${clientId}`}
                            type="date"
                            value={noticeUntil}
                            onChange={(e) => {
                              setNoticeUntil(e.target.value);
                              if (!chargeDue) setChargeDue(e.target.value);
                            }}
                          />
                        </div>
                      </div>

                      {finance.canCreate &&
                        (noticeCharge.data ? (
                          <p className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
                            Cobrança do aviso prévio já lançada no financeiro:{" "}
                            {money(noticeCharge.data.amount)}, vencimento{" "}
                            {noticeCharge.data.due_date.split("-").reverse().join("/")}. Para mudar o
                            valor, edite a cobrança em Cobranças.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={launchCharge}
                                onCheckedChange={(v) => setLaunchCharge(v === true)}
                              />
                              Lançar a cobrança do aviso prévio no financeiro ao salvar
                            </label>
                            {launchCharge && (
                              <div className="max-w-xs">
                                <Label htmlFor={`notice-due-${clientId}`}>Vencimento da cobrança</Label>
                                <Input
                                  id={`notice-due-${clientId}`}
                                  type="date"
                                  value={chargeDue}
                                  onChange={(e) => setChargeDue(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </fieldset>

                <div>
                  <Label htmlFor={`churn-notes-${clientId}`}>Detalhes e observações</Label>
                  <Textarea
                    id={`churn-notes-${clientId}`}
                    value={notes}
                    maxLength={2000}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Registrar churn deixa o cliente inativo, encerra sua jornada e desativa as
              mensalidades automáticas dos contratos e serviços. Cobranças já lançadas e pagamentos
              são preservados.
            </p>
            <p className="text-sm text-muted-foreground">
              Desmarcar churn não reativa as mensalidades automaticamente.
            </p>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar churn"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
