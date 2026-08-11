import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type PermissionAction = "view" | "create" | "edit" | "delete";

export type PermissionRow = { module_key: string; action: string };

export type ModuleRow = {
  key: string;
  label: string;
  parent_key: string | null;
  sector_key: string | null;
  route: string | null;
  sort_order: number;
  is_active: boolean;
};

/**
 * Dynamic module permissions for the current user.
 *
 * Backwards compatible by design: modules that do not exist in the catalog
 * (new or legacy screens) fall back to the legacy role model, so nothing that
 * works today can break.
 */
export function usePermissions() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const isAdmin = hasRole("administrator");
  const isStaff = isAdmin || hasRole("team");

  const { data: modules, isLoading: loadingModules } = useQuery({
    queryKey: ["app-modules"],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_modules")
        .select("key,label,parent_key,sector_key,route,sort_order,is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ModuleRow[];
    },
  });

  const { data: perms, isLoading: loadingPerms } = useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_permissions");
      if (error) throw error;
      return (data ?? []) as PermissionRow[];
    },
  });

  /**
   * Visibility overrides configured by the administrator
   * ("Gerenciar Visualizações"). RLS only returns the rows that apply to the
   * current user (own role, own user id, own client).
   */
  const { data: visibility } = useQuery({
    queryKey: ["module-visibility-mine", user?.id],
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_visibility")
        .select("module_key,visible");
      if (error) throw error;
      return (data ?? []) as { module_key: string; visible: boolean }[];
    },
  });

  const hidden = useMemo(() => {
    const s = new Set<string>();
    (visibility ?? []).forEach((v) => { if (!v.visible) s.add(v.module_key); });
    return s;
  }, [visibility]);

  const loading = authLoading || loadingModules || loadingPerms;


  const granted = useMemo(() => {
    const s = new Set<string>();
    (perms ?? []).forEach((p) => s.add(`${p.module_key}:${p.action}`));
    return s;
  }, [perms]);

  const catalog = useMemo(() => {
    const s = new Set<string>();
    (modules ?? []).forEach((m) => s.add(m.key));
    return s;
  }, [modules]);

  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    (modules ?? []).forEach((x) => m.set(x.key, x.parent_key));
    return m;
  }, [modules]);

  /** true when the admin turned this module (or its parent) off for the user */
  const isHidden = (moduleKey: string) => {
    if (hidden.size === 0) return false;
    let key: string | null | undefined = moduleKey;
    let guard = 0;
    while (key && guard++ < 5) {
      if (hidden.has(key)) return true;
      key = parentOf.get(key) ?? null;
    }
    return false;
  };

  const can = (moduleKey: string, action: PermissionAction = "view") => {
    if (isAdmin) return true;
    // visibility rules apply to everyone except the administrator
    if (isHidden(moduleKey)) return false;
    // catalog / permissions not loaded yet → keep legacy behaviour
    if (loading) return true;
    // user has no dynamic role assignment yet → keep legacy behaviour
    if (granted.size === 0) return isStaff || action === "view";
    if (granted.has(`${moduleKey}:${action}`)) return true;


    // module unknown to the catalog → legacy fallback
    if (!catalog.has(moduleKey)) return isStaff || action === "view";
    return false;
  };


  return {
    can,
    modules: modules ?? [],
    permissions: perms ?? [],
    isAdmin,
    isStaff,
    loading,
  };
}
