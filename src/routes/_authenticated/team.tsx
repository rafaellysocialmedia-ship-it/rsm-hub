import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { inviteMember, changeMemberRole, removeMember } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Equipe · Social Media Hub" },
      { name: "description", content: "Gerencie membros da equipe, convites e permissões." },
    ],
  }),
  component: TeamPage,
});

type AppRole = "administrator" | "team" | "client";
const ROLE_META: Record<AppRole, { label: string; tone: string }> = {
  administrator: { label: "Administrador", tone: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  team: { label: "Equipe", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  client: { label: "Cliente", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

function TeamPage() {
  const qc = useQueryClient();
  const { hasRole, loading, user } = useAuth();
  const isAdmin = hasRole("administrator");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles, error: rErr } = await supabase.from("user_roles").select("user_id, role");
      if (rErr) throw rErr;
      const staff = (roles ?? []).filter((r) => r.role === "administrator" || r.role === "team");
      const ids = Array.from(new Set(staff.map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").in("id", ids);
      if (pErr) throw pErr;
      return ids.map((id) => ({
        id,
        profile: profiles?.find((p) => p.id === id),
        roles: staff.filter((r) => r.user_id === id).map((r) => r.role as AppRole),
      }));
    },
    enabled: !loading && isAdmin,
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("team");
  const invite = useServerFn(inviteMember);
  const changeRole = useServerFn(changeMemberRole);
  const remove = useServerFn(removeMember);

  const inviteMut = useMutation({
    mutationFn: async () => invite({ data: { email: inviteEmail, role: inviteRole } }),
    onSuccess: () => {
      toast.success("Convite enviado por email");
      setInviteOpen(false);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRoleMut = useMutation({
    mutationFn: async (args: { userId: string; role: AppRole }) => changeRole({ data: args }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="flex flex-1 items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Apenas administradores</p>
            <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar a equipe.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Equipe</span>
          <h1 className="text-2xl font-semibold tracking-tight">Membros e permissões</h1>
          <p className="text-sm text-muted-foreground">Convide colegas, altere papéis e revogue acessos.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Convidar membro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Convidar novo membro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colega@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Papel</label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Equipe</SelectItem>
                    <SelectItem value="administrator">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending}>
                {inviteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar convite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Membros ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : members.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum membro ainda. Convide o primeiro colega.</p>
          ) : (
            members.map((m) => {
              const role: AppRole = m.roles.includes("administrator") ? "administrator" : "team";
              const isMe = m.id === user?.id;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{(m.profile?.name ?? m.profile?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.profile?.name ?? "Sem nome"} {isMe && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                  </div>
                  <Badge variant="outline" className={ROLE_META[role].tone}>{ROLE_META[role].label}</Badge>
                  <Select
                    value={role}
                    onValueChange={(v) => changeRoleMut.mutate({ userId: m.id, role: v as AppRole })}
                    disabled={isMe}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Equipe</SelectItem>
                      <SelectItem value="administrator">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isMe && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover {m.profile?.name ?? m.profile?.email}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O acesso será revogado imediatamente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeMut.mutate(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Convidados recebem um email com link para definir a senha. Após aceitar, o papel escolhido é aplicado automaticamente.</p>
        </CardContent>
      </Card>
    </div>
  );
}
