import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Bell, Building2, User as UserIcon, Palette } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações · Social Media Hub" },
      { name: "description", content: "Ajuste seu perfil, workspace, notificações e aparência." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("administrator");
  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Configurações</span>
        <h1 className="text-2xl font-semibold tracking-tight">Preferências e workspace</h1>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile"><UserIcon className="mr-1.5 h-3.5 w-3.5" /> Perfil</TabsTrigger>
          {isAdmin && <TabsTrigger value="workspace"><Building2 className="mr-1.5 h-3.5 w-3.5" /> Workspace</TabsTrigger>}
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" /> Notificações</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="mr-1.5 h-3.5 w-3.5" /> Aparência</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4"><ProfileTab /></TabsContent>
        {isAdmin && <TabsContent value="workspace" className="mt-4"><WorkspaceTab /></TabsContent>}
        <TabsContent value="notifications" className="mt-4"><NotificationsTab /></TabsContent>
        <TabsContent value="appearance" className="mt-4"><AppearanceTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({ name: "", cargo: "", phone: "", company: "", avatar_url: "" });
  useEffect(() => {
    if (profile) setForm({
      name: profile.name ?? "",
      cargo: profile.cargo ?? "",
      phone: profile.phone ?? "",
      company: profile.company ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perfil atualizado"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newPassword, setNewPassword] = useState("");
  const changePwd = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Mínimo 6 caracteres");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Senha alterada"); setNewPassword(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Perfil pessoal</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {form.avatar_url && <AvatarImage src={form.avatar_url} />}
            <AvatarFallback>{(form.name || user?.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1.5">
            <Label>URL do avatar</Label>
            <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input value={user?.email ?? ""} disabled /></Field>
          <Field label="Cargo"><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Empresa"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
        </div>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Alterar senha</p>
          <div className="flex gap-2">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha (mín. 6)" />
            <Button variant="outline" onClick={() => changePwd.mutate()} disabled={changePwd.isPending || newPassword.length < 6}>Trocar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkspaceTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: ws } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workspace_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ name: "", logo_url: "", timezone: "America/Sao_Paulo", primary_color: "" });
  useEffect(() => {
    if (ws) setForm({
      name: ws.name ?? "",
      logo_url: ws.logo_url ?? "",
      timezone: ws.timezone ?? "America/Sao_Paulo",
      primary_color: ws.primary_color ?? "",
    });
  }, [ws]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workspace_settings").update({ ...form, updated_by: user?.id ?? null }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Workspace atualizado"); qc.invalidateQueries({ queryKey: ["workspace-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome do workspace"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="URL do logo"><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Fuso horário">
            <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                <SelectItem value="America/Manaus">Manaus (AMT)</SelectItem>
                <SelectItem value="America/Rio_Branco">Rio Branco (ACT)</SelectItem>
                <SelectItem value="America/New_York">Nova York (EST)</SelectItem>
                <SelectItem value="Europe/Lisbon">Lisboa (WET)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cor primária (hex)"><Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} placeholder="#7c3aed" /></Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: prefs } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("notification_preferences").select("*").eq("user_id", user!.id).maybeSingle();
      return data ?? { notify_approvals: true, notify_comments: true, notify_tasks: true, notify_publish: true, notify_files: true };
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({ notify_approvals: true, notify_comments: true, notify_tasks: true, notify_publish: true, notify_files: true });
  useEffect(() => {
    if (prefs) setForm({
      notify_approvals: prefs.notify_approvals,
      notify_comments: prefs.notify_comments,
      notify_tasks: prefs.notify_tasks,
      notify_publish: prefs.notify_publish,
      notify_files: prefs.notify_files,
    });
  }, [prefs]);

  const save = useMutation({
    mutationFn: async (patch: Partial<typeof form>) => {
      const next = { ...form, ...patch };
      setForm(next);
      const { error } = await supabase.from("notification_preferences").upsert({ user_id: user!.id, ...next });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const items: [keyof typeof form, string, string][] = [
    ["notify_approvals", "Aprovações", "Quando um cliente aprova, rejeita ou pede alterações"],
    ["notify_comments", "Comentários", "Novos comentários em publicações"],
    ["notify_tasks", "Tarefas", "Novas atribuições e prazos"],
    ["notify_publish", "Publicações", "Quando um post é agendado ou publicado"],
    ["notify_files", "Arquivos", "Novos arquivos na biblioteca"],
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Notificações</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map(([k, label, desc]) => (
          <div key={k} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch checked={form[k]} onCheckedChange={(v) => save.mutate({ [k]: v } as never)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Aparência</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Tema</p>
            <p className="text-xs text-muted-foreground">Escolha entre claro, escuro ou seguir o sistema</p>
          </div>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
