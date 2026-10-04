import { useState } from "react";
import { CheckCircle2, Circle, Clock, ClipboardCheck } from "lucide-react";
import { useOnboarding, useExperienceMutation } from "@/hooks/use-client-experience";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STATUS,
  onboardingProgress,
  type OnboardingStep,
} from "@/lib/client-experience";
import { supabase } from "@/integrations/supabase/client";
import { retentionToday, dateLabel } from "@/lib/retention";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { QueryState } from "./account-panels";
export function ClientOnboarding({
  clientId,
  canEdit = false,
  compact = false,
  onOpen,
}: {
  clientId: string;
  canEdit?: boolean;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const q = useOnboarding(clientId),
    [editing, setEditing] = useState<OnboardingStep | null>(null);
  const initialize = useExperienceMutation(async () => {
    const { error } = await supabase.rpc("initialize_client_onboarding", { _client_id: clientId });
    if (error) throw error;
  }, "Onboarding iniciado");
  const steps = q.data ?? [],
    progress = onboardingProgress(steps);
  if (compact && (!steps.length || progress.percent === 100) && !q.error && !q.isLoading)
    return null;
  return (
    <QueryState loading={q.isLoading} error={q.error}>
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {canEdit ? "Onboarding da conta" : "Seu onboarding"}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {steps.length
                ? `${progress.done} de ${progress.total} etapas concluídas`
                : "As etapas iniciais serão organizadas pela RSM."}
            </p>
          </div>
          {steps.length > 0 && (
            <strong className="text-2xl text-primary">{progress.percent}%</strong>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.length > 0 ? (
            <>
              <div
                role="progressbar"
                aria-label="Progresso do onboarding"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {compact ? (
                <>
                  <p className="text-sm">
                    {
                      steps.filter(
                        (s) =>
                          s.owner_scope === "client" &&
                          !["done", "not_applicable"].includes(s.status),
                      ).length
                    }{" "}
                    etapa(s) aguardam sua participação.
                  </p>
                  <Button variant="outline" onClick={onOpen}>
                    Ver próximas etapas
                  </Button>
                </>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ONBOARDING_STEPS.map((def) => {
                    const step = steps.find((s) => s.step_key === def.key);
                    if (!step) return null;
                    const done = step.status === "done",
                      late =
                        step.due_date &&
                        step.due_date < retentionToday() &&
                        !["done", "not_applicable"].includes(step.status);
                    const Icon = done ? CheckCircle2 : step.status === "progress" ? Clock : Circle;
                    return (
                      <div key={step.step_key} className="rounded-xl border p-4">
                        <div className="flex items-start gap-3">
                          <Icon
                            className={
                              "mt-0.5 h-5 w-5 shrink-0 " +
                              (done ? "text-emerald-600" : "text-primary")
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">{def.label}</p>
                              <Badge variant={done ? "secondary" : "outline"}>
                                {ONBOARDING_STATUS[step.status]}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{def.description}</p>
                            <p className="mt-2 text-sm">
                              Responsável: {step.owner_scope === "client" ? "Cliente" : "RSM"}
                              {step.due_date && (
                                <span className={late ? "text-destructive" : ""}>
                                  {" "}
                                  · {dateLabel(step.due_date)}
                                  {late ? " · prazo vencido" : ""}
                                </span>
                              )}
                            </p>
                            {step.shared_note && (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                {step.shared_note}
                              </p>
                            )}
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => setEditing(step)}
                              >
                                Atualizar etapa
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!compact && (
                <p className="text-sm text-muted-foreground">
                  Progresso confirmado pela equipe RSM. Etapas não aplicáveis ficam fora do
                  percentual.
                </p>
              )}
            </>
          ) : (
            canEdit && (
              <Button onClick={() => initialize.mutate()} disabled={initialize.isPending}>
                {initialize.isPending ? "Iniciando…" : "Iniciar checklist de onboarding"}
              </Button>
            )
          )}
        </CardContent>
      </Card>
      {editing && <StepDialog step={editing} onClose={() => setEditing(null)} />}
    </QueryState>
  );
}
function StepDialog({ step, onClose }: { step: OnboardingStep; onClose: () => void }) {
  const [status, setStatus] = useState(step.status),
    [owner, setOwner] = useState(step.owner_scope),
    [due, setDue] = useState(step.due_date ?? ""),
    [note, setNote] = useState(step.shared_note);
  const save = useExperienceMutation(async () => {
    const { error } = await supabase
      .from("client_onboarding_steps")
      .update({ status, owner_scope: owner, due_date: due || null, shared_note: note.trim() })
      .eq("client_id", step.client_id)
      .eq("step_key", step.step_key)
      .eq("updated_at", step.updated_at)
      .select()
      .single();
    if (error)
      throw new Error(
        "Não foi possível salvar. A etapa pode ter mudado; feche e reabra para atualizar.",
      );
    onClose();
  }, "Etapa atualizada para a RSM e o cliente");
  const cls = "h-10 w-full rounded-md border bg-background px-3 text-sm";
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !save.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ONBOARDING_STEPS.find((s) => s.key === step.step_key)?.label}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label htmlFor="os-status">Situação</Label>
            <select
              id="os-status"
              className={cls}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {Object.entries(ONBOARDING_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="os-owner">Responsável pela próxima ação</Label>
            <select
              id="os-owner"
              className={cls}
              value={owner}
              onChange={(e) => setOwner(e.target.value as typeof owner)}
            >
              <option value="rsm">RSM</option>
              <option value="client">Cliente</option>
            </select>
          </div>
          <div>
            <Label htmlFor="os-due">Prazo (opcional)</Label>
            <Input id="os-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="os-note">Orientação visível ao cliente</Label>
            <Textarea
              id="os-note"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            A atualização será visível no painel do cliente. Este checklist não altera contratos,
            pagamentos ou a etapa da jornada.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar etapa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
