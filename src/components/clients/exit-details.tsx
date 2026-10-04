import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ExitDetails as Details } from "@/lib/plan-completion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "@/components/workspace/account-panels";
export function ExitDetails({ clientId }: { clientId: string }) {
  const q = useQuery({
    queryKey: ["exit-details", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_exit_details")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pendências e possibilidade de retorno</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState loading={q.isLoading} error={q.error}>
          {!q.isLoading && (
            <ExitEditor
              key={q.data?.updated_at ?? "new"}
              clientId={clientId}
              row={q.data ?? null}
            />
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
function ExitEditor({ clientId, row }: { clientId: string; row: Details | null }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(row?.last_month?.slice(0, 7) ?? ""),
    [pending, setPending] = useState(row?.pending_items ?? ""),
    [chance, setChance] = useState<Details["return_chance"]>(row?.return_chance ?? "unknown");
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        last_month: month ? month + "-01" : null,
        pending_items: pending,
        return_chance: chance,
      };
      const result = row
        ? await supabase
            .from("client_exit_details")
            .update(payload)
            .eq("client_id", clientId)
            .eq("updated_at", row.updated_at)
            .select("client_id")
            .single()
        : await supabase.from("client_exit_details").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["exit-details", clientId] });
      toast.success("Detalhes de encerramento salvos");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="block space-y-2 text-sm">
        <span>Última mensalidade (competência)</span>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Pendências para encerrar a conta</span>
        <Textarea value={pending} maxLength={2000} onChange={(e) => setPending(e.target.value)} />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Chance de retorno</span>
        <select
          className="h-10 w-full rounded-md border bg-background px-3"
          value={chance}
          onChange={(e) => setChance(e.target.value as Details["return_chance"])}
        >
          {Object.entries({
            unknown: "Não avaliada",
            low: "Baixa",
            medium: "Média",
            high: "Alta",
          }).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        Registro interno. Não altera cobranças nem pagamentos.
      </p>
      <Button type="submit" disabled={save.isPending}>
        Salvar detalhes
      </Button>
    </form>
  );
}
