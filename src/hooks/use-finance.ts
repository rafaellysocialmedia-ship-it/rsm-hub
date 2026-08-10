import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import type {
  FinanceCharge,
  FinanceContract,
  FinanceHistoryEvent,
  FinancePaymentMethod,
} from "@/lib/finance-core";
import type { ClientService } from "@/lib/client-master";

/** Acesso ao módulo financeiro interno (clientes nunca têm acesso). */
export function useFinanceAccess() {
  const { can, isAdmin, isStaff, loading } = usePermissions();
  return {
    loading,
    isAdmin,
    canView: isStaff && can("finance.dashboard", "view"),
    canCreate: isStaff && can("finance.receivables", "create"),
    canEdit: isStaff && can("finance.receivables", "edit"),
    canCancel: isStaff && can("finance.receivables", "delete"),
    canViewContracts: isStaff && can("finance.contracts", "view"),
    canEditContracts: isStaff && can("finance.contracts", "edit"),
    canConfigure: isStaff && can("finance.payment_methods", "edit"),
  };
}

export function usePaymentMethods(activeOnly = false) {
  return useQuery({
    queryKey: ["finance-payment-methods", activeOnly],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let q = supabase.from("finance_payment_methods").select("*").order("sort_order");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FinancePaymentMethod[];
    },
  });
}

export function useCharges(clientId?: string) {
  return useQuery({
    queryKey: ["finance-charges", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("finance_charges").select("*").order("due_date", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FinanceCharge[];
    },
  });
}

export function useContracts(clientId?: string) {
  return useQuery({
    queryKey: ["finance-contracts", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("finance_contracts").select("*").order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FinanceContract[];
    },
  });
}

export function useFinanceHistory(clientId?: string) {
  return useQuery({
    queryKey: ["finance-history", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("finance_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FinanceHistoryEvent[];
    },
  });
}

export function useFinanceClients() {
  return useQuery({
    queryKey: ["finance-clients"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, status, plan")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Serviços contratados do cliente (fonte única: Central de Clientes). */
export function useClientServices(clientId?: string | null) {
  return useQuery({
    queryKey: ["client-services", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_services")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ClientService[];
    },
  });
}
