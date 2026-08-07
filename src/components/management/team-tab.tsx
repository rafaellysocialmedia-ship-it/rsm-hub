import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { TEAM_ROLE_LABELS, type ClientTeamMember } from "@/lib/client-master";
import { initials } from "@/lib/clients";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, SectionCard } from "./master-shared";

export function TeamTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff = [] } = useStaffMembers();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [roleLabel, setRoleLabel] = useState(TEAM_ROLE_LABELS[0]);

  const { data: members = [] } = useQuery({
    queryKey: ["client-team", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_team_members")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientTeamMember[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Selecione um colaborador");
      const { error } = await supabase.from("client_team_members").insert({
        client_id: clientId,
        user_id: userId,
        role_label: roleLabel,
        created_by: user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-team", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      toast.success("Colaborador vinculado");
      setOpen(false);
      setUserId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-team", clientId] });
      toast.success("Vínculo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Equipe responsável"
      description="Colaboradores vinculados a este cliente"
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Vincular
          </Button>
        ) : undefined
      }
    >
      {members.length === 0 ? (
        <EmptyState>Nenhum colaborador vinculado ainda.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {members.map((m) => {
            const p = staff.find((s) => s.id === m.user_id);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <Avatar className="h-9 w-9">
                  {p?.avatar_url && <AvatarImage src={p.avatar_url} alt={p.name ?? ""} />}
                  <AvatarFallback className="bg-gradient-brand text-xs text-white">
                    {initials(p?.name ?? p?.email ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p?.name || p?.email || m.user_id.slice(0, 8)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p?.cargo || "—"}</p>
                </div>
                <Badge variant="outline">{m.role_label}</Badge>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove.mutate(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Colaborador</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.email || s.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Função no projeto</Label>
              <Select value={roleLabel} onValueChange={setRoleLabel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLE_LABELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
