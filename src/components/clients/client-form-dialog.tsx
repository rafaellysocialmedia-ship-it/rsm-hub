import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CLIENT_STATUS, formatCNPJ, type Client } from "@/lib/clients";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientLogo } from "./client-logo";

const schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  cnpj: z.string().trim().max(18).optional().or(z.literal("")),
  responsible: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  segment: z.string().trim().max(80).optional().or(z.literal("")),
  plan: z.string().trim().max(80).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "paused", "prospect"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  user_id: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  name: "",
  legal_name: "",
  cnpj: "",
  responsible: "",
  phone: "",
  whatsapp: "",
  email: "",
  segment: "",
  plan: "",
  start_date: "",
  status: "active",
  notes: "",
  user_id: "",
};

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPath, setLogoPath] = useState<string | null>(client?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        client
          ? {
              name: client.name ?? "",
              legal_name: client.legal_name ?? "",
              cnpj: client.cnpj ?? "",
              responsible: client.responsible ?? "",
              phone: client.phone ?? "",
              whatsapp: client.whatsapp ?? "",
              email: client.email ?? "",
              segment: client.segment ?? "",
              plan: client.plan ?? "",
              start_date: client.start_date ?? "",
              status: client.status,
              notes: client.notes ?? "",
              user_id: client.user_id ?? "",
            }
          : empty,
      );
      setLogoPath(client?.logo_url ?? null);
    }
  }, [open, client, form]);

  // Fetch client-role users to link login
  const { data: clientUsers = [] } = useQuery({
    queryKey: ["client-role-users"],
    enabled: open,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      if (error) throw error;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [] as { id: string; name: string | null; email: string | null }[];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", ids);
      if (e2) throw e2;
      return profs ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        legal_name: values.legal_name || null,
        cnpj: values.cnpj || null,
        responsible: values.responsible || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        email: values.email || null,
        segment: values.segment || null,
        plan: values.plan || null,
        start_date: values.start_date || null,
        notes: values.notes || null,
        user_id: values.user_id ? values.user_id : null,
        logo_url: logoPath,
      };
      if (client) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(client ? "Cliente atualizado" : "Cliente criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("client-logos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      setLogoPath(path);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const watchedName = form.watch("name");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Preencha as informações do cliente. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="space-y-5"
        >
          <div className="flex items-center gap-4">
            <ClientLogo path={logoPath} name={watchedName} className="h-16 w-16" />
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Enviar logo
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG ou SVG até 2MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome *" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder="Ex: Acme Co." />
            </Field>
            <Field label="Razão Social">
              <Input {...form.register("legal_name")} />
            </Field>
            <Field label="CNPJ">
              <Input
                {...form.register("cnpj")}
                onChange={(e) => form.setValue("cnpj", formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="Responsável">
              <Input {...form.register("responsible")} />
            </Field>
            <Field label="Telefone">
              <Input {...form.register("phone")} placeholder="(11) 0000-0000" />
            </Field>
            <Field label="WhatsApp">
              <Input {...form.register("whatsapp")} placeholder="(11) 90000-0000" />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="Segmento">
              <Input {...form.register("segment")} placeholder="Ex: E-commerce" />
            </Field>
            <Field label="Plano contratado">
              <Input {...form.register("plan")} placeholder="Ex: Premium" />
            </Field>
            <Field label="Data de início">
              <Input type="date" {...form.register("start_date")} />
            </Field>
            <Field label="Status">
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as FormValues["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Vincular login do cliente">
            <Select
              value={form.watch("user_id") || "none"}
              onValueChange={(v) => form.setValue("user_id", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {clientUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email || u.id.slice(0, 8)} {u.email ? `· ${u.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ao vincular, este cliente poderá acessar o portal e aprovar publicações com o login selecionado.
            </p>
          </Field>

          <Field label="Observações">
            <Textarea rows={4} {...form.register("notes")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {client ? "Salvar alterações" : "Criar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
