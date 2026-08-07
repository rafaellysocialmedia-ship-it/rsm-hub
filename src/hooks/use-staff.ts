import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  cargo: string | null;
  avatar_url: string | null;
};

/** Colaboradores internos (administradores e equipe) para vínculos e menções. */
export function useStaffMembers(enabled = true) {
  return useQuery({
    queryKey: ["staff-members"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<StaffMember[]> => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["administrator", "team"]);
      if (error) throw error;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, name, email, cargo, avatar_url")
        .in("id", ids);
      if (e2) throw e2;
      return (profs ?? []) as StaffMember[];
    },
  });
}
