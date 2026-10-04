import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STRATEGY_FIELDS } from "@/lib/account-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QueryState } from "./account-panels";

export function AccountStrategy({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const query = useQuery({
    queryKey: ["client-strategy", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_strategies")
        .select("fields")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data?.fields ?? {}) as Record<string, string>;
    },
  });
  useEffect(() => {
    if (query.data && !dirty) setFields(query.data);
  }, [query.data, dirty]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("client_strategies")
        .upsert(
          { client_id: clientId, fields, updated_at: new Date().toISOString() },
          { onConflict: "client_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["client-strategy", clientId] });
      toast.success("Estratégia salva");
    },
    onError: () => toast.error("Não foi possível salvar a estratégia."),
  });
  return (
    <QueryState loading={query.isLoading} error={query.error}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Estratégia da conta</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Diretrizes internas para orientar a produção e o atendimento.
            </p>
          </div>
          {canEdit && (
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Salvando…" : "Salvar estratégia"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          {STRATEGY_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`strategy-${key}`} className="mb-2 block text-sm font-medium">
                {label}
              </label>
              <Textarea
                id={`strategy-${key}`}
                value={fields[key] ?? ""}
                disabled={!canEdit}
                rows={3}
                onChange={(e) => {
                  setFields((f) => ({ ...f, [key]: e.target.value }));
                  setDirty(true);
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </QueryState>
  );
}
