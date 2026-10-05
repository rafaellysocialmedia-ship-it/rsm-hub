import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const sb = supabase as unknown as typeof supabase;

export function NotificationsMenu() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(20);
  const unreadQuery = useQuery({
    queryKey: ["notifications", user?.id, "unread-count"],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id, "list", limit],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await sb
        .from("notifications" as never)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await sb
        .from("notifications" as never)
        .update({ read: true } as never)
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onError: () => toast.error("Não foi possível marcar as notificações."),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markOne = async (id: string) => {
    const { error } = await sb
      .from("notifications" as never)
      .update({ read: true } as never)
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível marcar como lida.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markOne(n.id);
    setOpen(false);
    if (n.link) {
      // Links may include ?search and #hash — TanStack Router's `to` expects a
      // plain pathname, so parse them out and pass separately.
      try {
        const [pathAndSearch, hash] = n.link.split("#");
        const [pathname, searchStr] = pathAndSearch.split("?");
        const search: Record<string, string> = {};
        if (searchStr) {
          for (const [k, v] of new URLSearchParams(searchStr)) search[k] = v;
        }
        // Persist the target post so the destination page can open it in a
        // popup even if the search params get dropped during navigation.
        if (search.open) {
          sessionStorage.setItem(
            "pending-open-post",
            JSON.stringify({
              id: search.open,
              comment: search.comment ?? (search.comments ? "last" : null),
            }),
          );
        }
        await router.navigate({ to: pathname, search, hash });
        window.dispatchEvent(
          new CustomEvent("notification:navigate", { detail: { pathname, search, hash } }),
        );
      } catch {
        window.location.href = n.link;
      }
    }
  };

  const unread = unreadQuery.data ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={
            unreadQuery.error
              ? "Notificações: falha ao carregar contagem"
              : `Notificações: ${unread} não lidas`
          }
          title="Notificações"
          variant="ghost"
          size="icon"
          className="relative h-11 w-11"
        >
          <Bell className="h-4 w-4" />
          {unreadQuery.error && <span aria-hidden>!</span>}
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="mr-1 h-3 w-3" /> Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm">Carregando…</p>
          ) : error ? (
            <p role="alert" className="p-4 text-sm">
              Falha ao carregar. <button onClick={() => void refetch()}>Tentar novamente</button>
            </p>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              Sem notificações no momento
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={`block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 transition-colors hover:bg-muted/60 ${n.read ? "opacity-60" : "bg-muted/30"}`}
              >
                <div className="font-medium">{n.title}</div>
                {n.body && (
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </div>
              </button>
            ))
          )}
        </div>
        {items.length === limit && (
          <Button variant="ghost" onClick={() => setLimit((n) => n + 20)}>
            Carregar mais
          </Button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
