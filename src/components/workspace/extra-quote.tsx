import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/finance-core";
import type { ClientRequest } from "@/lib/plan-completion";
import { toast } from "sonner";
export function ExtraQuote({ request: r, canEdit }: { request: ClientRequest; canEdit: boolean }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(r.quote_amount == null ? "" : String(r.quote_amount)),
    [scope, setScope] = useState(r.quote_scope),
    [confirm, setConfirm] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      if (canEdit) {
        if (!scope.trim() || !amount || Number(amount) < 0)
          throw new Error("Informe escopo e valor.");
        const { error } = await supabase
          .from("client_requests")
          .update({ quote_amount: Number(amount), quote_scope: scope.trim() })
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("accept_extra_quote", {
          _id: r.id,
          _revision: r.quote_revision,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-requests"] });
      setConfirm(false);
      toast.success(
        canEdit ? "Orçamento salvo. Alterações exigem novo aceite." : "Aceite registrado",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="my-3 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <h4 className="text-sm font-semibold">Serviço extra · orçamento separado do plano</h4>
      {canEdit ? (
        <>
          <label className="block text-sm">
            Escopo
            <Textarea value={scope} onChange={(e) => setScope(e.target.value)} maxLength={4000} />
          </label>
          <label className="block text-sm">
            Valor (R$)
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Salvar orçamento
          </Button>
        </>
      ) : r.quote_amount != null ? (
        <>
          <p className="whitespace-pre-wrap text-sm">{r.quote_scope}</p>
          <p className="font-semibold">{money(r.quote_amount)}</p>
        </>
      ) : (
        <p className="text-sm">Aguardando orçamento da equipe.</p>
      )}
      {r.accepted_at ? (
        <p className="text-sm text-emerald-800">
          Aceito em {new Date(r.accepted_at).toLocaleString("pt-BR")} · versão {r.accepted_revision}
        </p>
      ) : (
        <p className="text-sm text-amber-800">Aguardando aceite · versão {r.quote_revision}</p>
      )}
      {!canEdit &&
        !r.accepted_at &&
        r.quote_amount != null &&
        r.quote_scope &&
        r.status !== "done" &&
        (confirm ? (
          <div>
            <p className="mb-2 text-sm">
              Confirmar contratação de {r.title} por {money(r.quote_amount)}?
            </p>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Confirmar aceite
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirm(true)}>Revisar e aceitar orçamento</Button>
        ))}
    </section>
  );
}
