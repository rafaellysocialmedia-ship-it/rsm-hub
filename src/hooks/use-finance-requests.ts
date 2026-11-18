import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { requestKind } from "@/lib/finance-alerts";

export type FinanceRequest = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  status: "open" | "waiting_client" | "done";
  created_at: string;
  kind: "renegotiation" | "service_close";
};

/** Pedidos de renegociação e de encerramento de serviço ainda não concluídos. */
export function useFinanceRequests(clientId?: string, enabled = true) {
  return useQuery({
    queryKey: ["client-requests", "finance", clientId ?? "all"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("client_requests")
        .select("id,client_id,title,description,status,created_at")
        .neq("status", "done")
        .order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      // Filtra pelo assunto aqui: os pedidos abertos são poucos e o prefixo
      // tem colchetes, que complicam o filtro na consulta.
      return (data ?? [])
        .map((r) => ({ ...r, kind: requestKind(r.title) }))
        .filter((r): r is FinanceRequest => r.kind !== null);
    },
  });
}
