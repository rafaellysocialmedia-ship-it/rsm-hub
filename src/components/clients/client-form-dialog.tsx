import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePaymentMethods } from "@/hooks/use-finance";
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
import { ClientLabel } from "./client-label";

const schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  cnpj: z.string().trim().max(18).optional().or(z.literal("")),
  responsible: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  segment: z.string().trim().max(80).optional().or(z.literal("")),
  calendar_label_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma cor hexadecimal válida").optional().or(z.literal("")),
  plan: z.string().trim().max(80).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "paused", "prospect"]),
  monthly_post_quota: z.union([z.string(), z.number()]).optional(),
  profile_project_deadline: z.string().optional().or(z.literal("")),
  editorial_deadline: z.string().optional().or(z.literal("")),
  default_payment_method_id: z.string().optional().or(z.literal("")),
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
  calendar_label_color: "",
  plan: "",
  start_date: "",
  status: "active",
  monthly_post_quota: "",
  profile_project_deadline: "",
  editorial_deadline: "",
  default_payment_method_id: "",
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
  const { data: paymentMethods = [] } = usePaymentMethods(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (open) {
      const extra = client as (Client & { default_payment_method_id?: string | null }) | null | undefined;
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
               calendar_label_color: client.calendar_label_color ?? "",
              plan: client.plan ?? "",
              start_date: client.start_date ?? "",
              status: client.status,
              monthly_post_quota: client.monthly_post_quota ?? "",
              profile_project_deadline: (client as unknown as { profile_project_deadline?: string | null }).profile_project_deadline ?? "",
              editorial_deadline: (client as unknown as { editorial_deadline?: string | null }).editorial_deadline ?? "",
              default_payment_method_id: extra?.default_payment_method_id ?? "",
              notes: client.notes ?? "",
              user_id: client.user_id ?? "",
            }
          : empty,
      );
      setLogoPath(client?.logo_url ?? null);
    }
  }, [open, client, form]);

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
      const quotaNum = values.monthly_post_quota === "" || values.monthly_post_quota == null
        ? null
        : Number(values.monthly_post_quota) || null;
      const payload = {
        ...values,
        legal_name: values.legal_name || null,
        cnpj: values.cnpj || null,
        responsible: values.responsible || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        email: values.email || null,
        segment: values.segment || null,
         calendar_label_color: values.calendar_label_color || null,
        plan: values.plan || null,
        start_date: values.start_date || null,
        monthly_post_quota: quotaNum,
        profile_project_deadline: values.profile_project_deadline || null,
        editorial_deadline: values.editorial_deadline || null,
        default_payment_method_id: values.default_payment_method_id || null,
        notes: values.notes || null,
        user_id: values.user_id ? values.user_id : null,
        logo_url: logoPath,
      };
      if (client) {
        const { error } = await supabase.from("clients").update(payload as never).eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert({ ...payload, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["calendar-client-labels"] });
      qc.invalidateQueries({ queryKey: ["management-clients"] });
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {client
              ? "Atualize os dados do cliente. Cada bloco explica para que serve a informação."
              : "Para começar basta o nome. Depois de criar, a página do cliente mostra o que ainda falta preencher."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
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
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Enviar logo
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG ou SVG até 2MB</p>
            </div>
          </div>

          <FormSection
            title="1. Identificação"
            description="Como o cliente aparece no sistema. Só o nome é obrigatório; o restante pode ser completado depois."
          >
            <Field
              label="Nome *"
              hint="Nome usado no dia a dia, no calendário e nas listas."
              error={form.formState.errors.name?.message}
            >
              <Input {...form.register("name")} placeholder="Ex.: Dra. Ana Souza" />
            </Field>
            <Field label="Segmento" hint="Área de atuação do cliente.">
              <Input {...form.register("segment")} placeholder="Ex.: Advocacia" />
            </Field>
            <Field label="Razão social" hint="Nome da empresa no contrato e na nota fiscal.">
              <Input {...form.register("legal_name")} />
            </Field>
            <Field label="CNPJ">
              <Input
                {...form.register("cnpj")}
                onChange={(e) => form.setValue("cnpj", formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field
              label="Situação do cliente"
              hint="Ativo = em atendimento. Prospect = ainda em negociação. Pausado e Inativo param as mensalidades automáticas."
            >
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
            <Field
              label="Cor no calendário"
              hint="Cor da etiqueta deste cliente no calendário. Sem escolha, o sistema define uma cor."
              error={form.formState.errors.calendar_label_color?.message}
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  aria-label="Escolher cor da etiqueta do cliente"
                  className="h-10 w-12 cursor-pointer rounded border bg-background p-1"
                  value={form.watch("calendar_label_color") || "#42145d"}
                  onChange={(event) =>
                    form.setValue("calendar_label_color", event.target.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
                <ClientLabel
                  id={client?.id ?? "new"}
                  name={form.watch("name") || "Prévia do cliente"}
                  color={form.watch("calendar_label_color")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    form.setValue("calendar_label_color", "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  Cor automática
                </Button>
              </div>
            </Field>
          </FormSection>

          <FormSection
            title="2. Contato"
            description="Quem a equipe procura para aprovar conteúdos e resolver pendências."
          >
            <Field label="Pessoa de contato" hint="Nome de quem responde pelo cliente.">
              <Input {...form.register("responsible")} placeholder="Ex.: Ana Souza" />
            </Field>
            <Field label="WhatsApp" hint="Canal principal para falar com o cliente.">
              <Input {...form.register("whatsapp")} placeholder="(85) 90000-0000" />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} placeholder="cliente@exemplo.com" />
            </Field>
            <Field label="Telefone fixo">
              <Input {...form.register("phone")} placeholder="(85) 0000-0000" />
            </Field>
          </FormSection>

          <FormSection
            title="3. Plano e entregas"
            description="O que foi contratado. Os serviços, valores e vencimentos são cadastrados depois, na página do cliente, em Cadastro."
          >
            <Field label="Plano contratado" hint="Nome do plano vendido.">
              <Input {...form.register("plan")} placeholder="Ex.: Exclusive" />
            </Field>
            <Field label="Data de início" hint="Primeiro dia de atendimento.">
              <Input type="date" {...form.register("start_date")} />
            </Field>
            <Field
              label="Publicações por mês"
              hint="Quantas publicações o plano inclui por mês. O calendário usa este número para avisar quando faltar ou passar."
            >
              <Input
                type="number"
                min={0}
                placeholder="Ex.: 12"
                {...form.register("monthly_post_quota")}
              />
            </Field>
            <Field
              label="Forma de pagamento padrão"
              hint="Usada nas mensalidades geradas automaticamente."
            >
              <Select
                value={form.watch("default_payment_method_id") || "none"}
                onValueChange={(v) =>
                  form.setValue("default_payment_method_id", v === "none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não definida —</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Prazo do projeto de perfil"
              hint="Data combinada para entregar o projeto do perfil. Deixe em branco se não houver."
            >
              <Input type="date" {...form.register("profile_project_deadline")} />
            </Field>
            <Field
              label="Prazo do editorial"
              hint="Data combinada para entregar a linha editorial. Deixe em branco se não houver."
            >
              <Input type="date" {...form.register("editorial_deadline")} />
            </Field>
          </FormSection>

          <FormSection
            title="4. Acesso do cliente ao portal"
            description="Opcional. Com um login vinculado, o cliente entra no portal para ver o calendário e aprovar publicações."
            columns={1}
          >
            <Field
              label="Login do cliente"
              hint="A conta precisa ter sido criada antes, com perfil de cliente."
            >
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
            </Field>
          </FormSection>

          <FormSection
            title="5. Observações internas"
            description="Anotações da equipe. O cliente não vê este campo."
            columns={1}
          >
            <Field label="Observações">
              <Textarea rows={3} {...form.register("notes")} />
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
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

function FormSection({
  title,
  description,
  columns = 2,
  children,
}: {
  title: string;
  description: string;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-border/70 p-4">
      <legend className="px-1.5 text-sm font-semibold">{title}</legend>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      <div className={`grid grid-cols-1 gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {children}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && !error && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
