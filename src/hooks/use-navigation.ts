import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { usePermissions } from "./use-permissions";
import { toast } from "sonner";
import { isSafeFavorite, type Favorite } from "@/lib/navigation";
import { localDate } from "@/lib/account-workspace";
export function useNavigationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["navigation-preferences", user?.id];
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navigation_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { user_id: user!.id, sidebar_open: true, favorites: [] };
    },
  });
  const update = useMutation({
    mutationFn: async (patch: { sidebar_open?: boolean; favorites?: Favorite[] }) => {
      if (!user) throw Error("Entre novamente.");
      const { data, error } = await supabase
        .from("navigation_preferences")
        .upsert({
          user_id: user.id,
          sidebar_open: q.data?.sidebar_open ?? true,
          favorites: q.data?.favorites ?? [],
          ...patch,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => qc.setQueryData(key, data),
    onError: () => toast.error("Não foi possível salvar sua preferência. Tente novamente."),
  });
  const favorites = ((q.data?.favorites ?? []) as Favorite[]).filter(
    (f) =>
      f &&
      typeof f.href === "string" &&
      typeof f.label === "string" &&
      typeof f.module === "string" &&
      isSafeFavorite(f.href),
  );
  return {
    ...q,
    favorites,
    update,
    toggle: (item: Favorite) => {
      if (!isSafeFavorite(item.href)) return;
      const exists = favorites.some((f) => f.href === item.href);
      update.mutate({
        favorites: exists
          ? favorites.filter((f) => f.href !== item.href)
          : [...favorites, item].slice(0, 50),
      });
    },
  };
}
export function useNavigationCounts() {
  const { user, hasRole } = useAuth();
  const { can, loading } = usePermissions();
  const staff = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "invalidate" &&
        ["tasks", "portal-posts", "posts", "staff-approvals", "portal-approvals"].includes(
          String(event.query.queryKey[0]),
        )
      )
        void qc.invalidateQueries({ queryKey: ["navigation-counts"] });
    });
    return unsub;
  }, [qc, user]);
  return useQuery({
    queryKey: [
      "navigation-counts",
      user?.id,
      staff,
      can("workspace.tasks"),
      can("social.approvals"),
    ],
    enabled: !!user && !loading,
    refetchInterval: 15000,
    queryFn: async () => {
      let tasks: number | null = 0,
        approvals: number | null = 0;
      const clients = staff
        ? await supabase.from("clients").select("id").eq("status", "active").eq("churned", false)
        : null;
      const ids = clients?.data?.map((c) => c.id) ?? [];
      if (staff && can("workspace.tasks")) {
        if (clients?.error) tasks = null;
        else {
          const r = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assignee_id", user!.id)
            .neq("status", "done")
            .lt("due_date", localDate())
            .or(
              `client_id.is.null,client_id.in.(${ids.length ? ids.join(",") : "00000000-0000-0000-0000-000000000000"})`,
            );
          tasks = r.error ? null : (r.count ?? 0);
        }
      }
      if (can("social.approvals")) {
        let request = supabase
          .from("portal_posts")
          .select("id", { count: "exact", head: true })
          .in("status", ["review", "changes_requested"]);
        if (staff) request = request.in("client_id", ids);
        const r = await request;
        approvals = r.error || clients?.error ? null : (r.count ?? 0);
      }
      if (!staff) {
        const permissions = await supabase
          .from("client_portal_settings")
          .select("can_approve,can_request_changes");
        if (permissions.error) approvals = null;
        else if (!permissions.data?.some((p) => p.can_approve || p.can_request_changes))
          approvals = 0;
      }
      return { tasks, approvals };
    },
  });
}
