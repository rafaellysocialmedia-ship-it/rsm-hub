import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Client } from "@/lib/clients";

/**
 * Acesso ao módulo de Tráfego Pago.
 * Equipe/administrador: acesso total.
 * Cliente: liberado apenas se o serviço "paid_traffic" estiver contratado.
 */
export function useTrafficAccess() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");

  const { data, isLoading } = useQuery({
    queryKey: ["traffic-access", user?.id],
    enabled: !!user && !isStaff,
    queryFn: async () => {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      const list = (clients ?? []) as Client[];
      if (list.length === 0) return { client: null, contracted: false };
      const { data: services, error: e2 } = await supabase
        .from("client_services")
        .select("client_id, service_key, situation")
        .in(
          "client_id",
          list.map((c) => c.id),
        );
      if (e2) throw e2;
      const contracted = (services ?? []).some(
        (s) => s.service_key === "paid_traffic" && s.situation !== "cancelled",
      );
      return { client: list[0], contracted };
    },
  });

  return {
    isStaff,
    loading: authLoading || (!isStaff && isLoading),
    client: data?.client ?? null,
    allowed: isStaff || !!data?.contracted,
  };
}

/** Clientes disponíveis para vincular campanhas / LPs (respeitando RLS). */
export function useTrafficClients() {
  return useQuery({
    queryKey: ["traffic-clients"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, status")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Client, "id" | "name" | "status">[];
    },
  });
}
