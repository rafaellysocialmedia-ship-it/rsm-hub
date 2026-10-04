import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export function useOnboarding(clientId: string) {
  return useQuery({
    queryKey: ["experience", "onboarding", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_onboarding_steps")
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function useMonthlyReports(clientId: string) {
  return useQuery({
    queryKey: ["experience", "reports", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_monthly_reports")
        .select("*")
        .eq("client_id", clientId)
        .order("report_month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function useExperienceMutation<T = void>(fn: (v: T) => Promise<unknown>, message: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["experience", "portal-timeline", "account-activity", "client-timeline"])
        void qc.invalidateQueries({ queryKey: [key] });
      toast.success(message);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
