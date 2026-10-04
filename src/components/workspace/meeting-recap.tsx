import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MeetingRecap as Recap } from "@/lib/plan-completion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function MeetingRecap({ meetingId, canEdit }: { meetingId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: ["meeting-recap", meetingId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_recaps")
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-3">
      {q.error && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o resumo.
        </p>
      )}
      {q.data && (
        <div className="space-y-3 rounded-lg bg-muted/50 p-4">
          {(
            [
              ["summary", "Resumo"],
              ["decisions", "Decisões"],
              ["next_steps", "Próximos passos"],
            ] as const
          ).map(
            ([k, label]) =>
              q.data?.[k] && (
                <div key={k}>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{q.data[k]}</p>
                </div>
              ),
          )}
        </div>
      )}
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          disabled={q.isLoading || !!q.error}
          onClick={() => setEditing(true)}
        >
          {q.data ? "Atualizar resumo compartilhado" : "Compartilhar resumo com o cliente"}
        </Button>
      )}
      {editing && (
        <RecapEditor
          meetingId={meetingId}
          recap={q.data ?? null}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
function RecapEditor({
  meetingId,
  recap: r,
  onClose,
}: {
  meetingId: string;
  recap: Recap | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    summary: r?.summary ?? "",
    decisions: r?.decisions ?? "",
    next_steps: r?.next_steps ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const result = r
        ? await supabase
            .from("meeting_recaps")
            .update(form)
            .eq("meeting_id", meetingId)
            .eq("updated_at", r.updated_at)
            .select("meeting_id")
            .single()
        : await supabase.from("meeting_recaps").insert({ ...form, meeting_id: meetingId });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      for (const key of ["meeting-recap", "client-timeline", "portal-timeline"])
        void qc.invalidateQueries({ queryKey: [key] });
      toast.success("Resumo disponível no painel do cliente");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resumo da reunião</DialogTitle>
          <DialogDescription>
            Ao salvar, este conteúdo ficará visível para o cliente no painel.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {(
            [
              ["summary", "Resumo"],
              ["decisions", "Decisões"],
              ["next_steps", "Próximos passos"],
            ] as const
          ).map(([key, label]) => (
            <label className="block space-y-2 text-sm" key={key}>
              <span>{label}</span>
              <Textarea
                required={key === "summary"}
                minLength={key === "summary" ? 2 : undefined}
                maxLength={4000}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <Button type="submit" disabled={save.isPending}>
            Salvar no painel do cliente
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
