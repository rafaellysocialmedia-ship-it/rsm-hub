import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ThreadList } from "@/components/ai/thread-list";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: AiIndex,
});

function AiIndex() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["ai-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_threads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const { data, error } = await supabase
        .from("ai_threads")
        .insert({ user_id: user.id, title: "Nova conversa" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["ai-threads"] });
      nav({ to: "/ai/$threadId", params: { threadId: t.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_threads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-threads"] }),
  });

  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      <ThreadList
        threads={threads}
        activeId={null}
        loading={isLoading}
        onNew={() => create.mutate()}
        onDelete={(id) => del.mutate(id)}
      />
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-semibold">Comece uma nova conversa</h2>
          <p className="text-sm text-muted-foreground">
            Peça ideias de post, roteiros de Reels, legendas, hashtags, análises ou qualquer coisa
            de marketing digital.
          </p>
        </div>
        <Button size="lg" onClick={() => create.mutate()} disabled={create.isPending}>
          <MessageSquarePlus className="mr-2 h-4 w-4" /> Nova conversa
        </Button>
      </div>
    </div>
  );
}
