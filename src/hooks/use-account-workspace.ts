import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PortalAccount } from "@/lib/account-workspace";

export function useAccountSync(clientId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!clientId) return;
    let channel = supabase.channel(`account-workspace-${clientId}-${crypto.randomUUID()}`);
    const keys = [
      "experience",
      "retention",
      "posts",
      "portal-posts",
      "portal-home-posts",
      "staff-approvals-posts",
      "staff-approvals",
      "portal-approvals",
      "meetings",
      "client-next-meeting",
      "tasks",
      "client-timeline",
      "portal-timeline",
      "finance-charges",
      "finance-contracts",
      "portal-account",
      "account-activity",
      "portal-calendar-posts",
      "client-workspace-files",
    ];
    for (const table of [
      "client_onboarding_steps",
      "client_monthly_reports",
      "posts",
      "post_approvals",
      "meetings",
      "tasks",
      "client_timeline",
      "finance_charges",
      "finance_contracts",
      "files",
      "client_contracts",
    ]) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `client_id=eq.${clientId}` },
        () => keys.forEach((key) => void qc.invalidateQueries({ queryKey: [key] })),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, qc]);
}

export function usePortalAccount(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portal-account", "account-activity", "portal-calendar-posts", user?.id],
    enabled: enabled && !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_account_workspace");
      if (error) throw error;
      return data as unknown as PortalAccount | null;
    },
  });
}

export function useAccountMeetings(clientId: string) {
  return useQuery({
    queryKey: ["meetings", "client", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "id,client_id,title,description,meeting_date,meeting_time,duration_minutes,location,meeting_url,status",
        )
        .eq("client_id", clientId)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAccountFiles(clientId: string) {
  return useQuery({
    queryKey: ["client-workspace-files", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id,name,category,storage_path,size_bytes,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
