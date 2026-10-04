import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryState } from "./account-panels";
import { POST_FORMATS } from "@/lib/posts";
import { localDate } from "@/lib/account-workspace";
import { toast } from "sonner";
export function Deliveries({ clientId, canEdit = false }: { clientId: string; canEdit?: boolean }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(localDate().slice(0, 7)),
    [quotas, setQuotas] = useState<Record<string, number>>({}),
    [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: ["delivery-progress", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const [c, p] = await Promise.all([
        supabase
          .from("clients")
          .select("format_quotas,monthly_post_quota")
          .eq("id", clientId)
          .single(),
        supabase
          .from("portal_posts")
          .select("format,status,scheduled_date,extra_request_id")
          .eq("client_id", clientId),
      ]);
      if (c.error) throw c.error;
      if (p.error) throw p.error;
      return { client: c.data, posts: p.data };
    },
  });
  useEffect(() => {
    if (q.data && !editing) setQuotas(q.data.client.format_quotas as Record<string, number>);
  }, [q.data, editing]);
  const save = useMutation({
    mutationFn: async () => {
      if (Object.values(quotas).some((n) => !Number.isInteger(n) || n < 0))
        throw new Error("Use quantidades inteiras, iguais ou maiores que zero.");
      const { error } = await supabase
        .from("clients")
        .update({ format_quotas: quotas })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["delivery-progress", clientId] });
      toast.success("Distribuição por formato salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const posts =
    q.data?.posts.filter(
      (p) => p.scheduled_date?.startsWith(month) && !["archived", "rejected"].includes(p.status),
    ) ?? [];
  const formats = [
    ...new Set([
      ...POST_FORMATS,
      ...posts.map((p) => p.format || "Não definido"),
      ...Object.keys(quotas),
    ]),
  ];
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Entregas por formato</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plano atual: {q.data?.client.monthly_post_quota ?? "quantidade não informada"}{" "}
            conteúdos/mês. A distribuição abaixo complementa o saldo mensal existente.
          </p>
        </div>
        <Input
          className="w-auto"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Mês das entregas"
        />
      </header>
      <QueryState loading={q.isLoading} error={q.error}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3 pr-3">Formato</th>
                <th>Contratado*</th>
                <th>Em produção</th>
                <th>Entregue</th>
                <th>Extras**</th>
              </tr>
            </thead>
            <tbody>
              {formats.map((f) => {
                const rows = posts.filter((p) => (p.format || "Não definido") === f);
                return (
                  <tr className="border-b" key={f}>
                    <td className="py-3 pr-3">{f}</td>
                    <td>
                      {editing ? (
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          aria-label={`Contratado ${f}`}
                          className="w-20"
                          value={quotas[f] ?? ""}
                          onChange={(e) =>
                            setQuotas((v) => ({ ...v, [f]: Number(e.target.value) }))
                          }
                        />
                      ) : (
                        (quotas[f] ?? "A definir")
                      )}
                    </td>
                    <td>
                      {rows.filter((p) => !p.extra_request_id && p.status !== "published").length}
                    </td>
                    <td>
                      {rows.filter((p) => !p.extra_request_id && p.status === "published").length}
                    </td>
                    <td>{rows.filter((p) => p.extra_request_id).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          * Distribuição vigente do plano, sem reescrever os saldos históricos. ** Extras com
          orçamento aceito, separados do plano. Entregue significa publicação confirmada no sistema;
          aprovação isolada não conta como entrega.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => (editing ? save.mutate() : setEditing(true))}
            >
              {editing ? "Salvar distribuição" : "Definir formatos contratados"}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
