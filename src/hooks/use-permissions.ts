import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type PermissionAction = "view" | "create" | "edit" | "delete";

export type PermissionRow = { module_key: string; action: string };

/**
 * Dynamic module permissions for the current user.
 *
 * Backwards compatible by design: if the permission catalog has no entry for a
 * given module (new/legacy screens), access falls back to the legacy role model
 * so nothing that works today can break.
 */
export function usePermissions() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const isAdmin = hasRole("administrator");
  const isStaff = isAdmin || hasRole("team");

  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_permissions");
      if (error) throw error;
      return (data ?? []) as PermissionRow[];
    },
  });

  const set = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((p) => s.add(`${p.module_key}:${p.action}`));
    return s;
  }, [data]);

  const knownModules = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((p) => s.add(p.module_key));
    return s;
  }, [data]);

  const can = (moduleKey: string, action: PermissionAction = "view") => {
    if (isAdmin) return true;
    // no catalog data yet → fall back to legacy behaviour
    if (isLoading || set.size === 0) return true;
    if (set.has(`${moduleKey}:${action}`)) return true;
    // module not present in the catalog at all → legacy fallback
    if (!knownModules.has(moduleKey)) return isStaff || action === "view";
    return false;
  };

  return {
    can,
    permissions: data ?? [],
    isAdmin,
    isStaff,
    loading: authLoading || isLoading,
  };
}
