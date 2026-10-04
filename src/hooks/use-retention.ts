import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
export function useRetention() {
  const { hasRole } = useAuth();
  const enabled = hasRole("administrator") || hasRole("team");
  return useQuery({
    queryKey: ["retention", "overview"],
    enabled,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retention_overview")
        .select("*")
        .order("score", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function useRetentionActions(clientId?: string) {
  const { hasRole } = useAuth();
  return useQuery({
    queryKey: ["retention", "actions", clientId],
    enabled: hasRole("administrator") || hasRole("team"),
    refetchInterval: 60000,
    queryFn: async () => {
      let q = supabase.from("retention_actions").select("*").order("due_date");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function useRetentionMutation<T = void>(fn: (value: T) => Promise<unknown>, message: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["retention"] });
      toast.success(message);
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar. Tente novamente."),
  });
}
export function useRetentionTeam() {
  const { hasRole } = useAuth();
  return useQuery({
    queryKey: ["retention", "team"],
    enabled: hasRole("administrator") || hasRole("team"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_retention_staff");
      if (error) throw error;
      return data ?? [];
    },
  });
}
