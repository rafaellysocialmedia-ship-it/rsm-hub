import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { formatDate } from "@/lib/client-master";
import { lpStatusMeta, type LandingPage } from "@/lib/traffic";
import {
  ASSET_SECTIONS,
  ASSET_STATUS,
  assetLabel,
  assetStatusMeta,
  type AssetSectionConfig,
  type DigitalAsset,
} from "@/lib/digital-assets";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { LandingPageDialog } from "@/components/traffic/landing-page-dialog";
import { EmptyState, SectionCard } from "./master-shared";

export function DigitalAssetsTab({
  clientId,
  canEdit,
}: {
  clientId: string;
  canEdit: boolean;
}) {
  return (
    <Tabs defaultValue="landing_pages" className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="landing_pages">Landing Pages</TabsTrigger>
        {ASSET_SECTIONS.map((s) => (
          <TabsTrigger key={s.key} value={s.key}>
            {s.title}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Cada seção só busca seus dados quando é aberta (Radix desmonta as inativas). */}
      <TabsContent value="landing_pages">
        <LandingPagesSection clientId={clientId} canEdit={canEdit} />
      </TabsContent>
      {ASSET_SECTIONS.map((section) => (
        <TabsContent key={section.key} value={section.key}>
          <AssetSection section={section} clientId={clientId} canEdit={canEdit} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/* ---------------------------------- LPs ---------------------------------- */

function LandingPagesSection({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const { data: staff = [] } = useStaffMembers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["landing-pages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LandingPage[];
    },
  });

  const ownerName = (id: string | null) => {
    const s = staff.find((m) => m.id === id);
    return s?.name || s?.email || "—";
  };

  return (
    <SectionCard
      title="Landing Pages"
      description="Mesmo cadastro usado no módulo de Tráfego Pago e no serviço contratado."
      collapsible
      actions={
        canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova LP
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : pages.length === 0 ? (
        <EmptyState>Nenhuma Landing Page cadastrada para este cliente.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pages.map((p) => {
            const meta = lpStatusMeta(p.status);
            const visible = (p as LandingPage & { visible_to_client?: boolean }).visible_to_client;
            const editUrl = (p as LandingPage & { edit_url?: string | null }).edit_url;
            return (
              <div key={p.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.production_url && (
                      <p className="truncate text-xs text-muted-foreground">{p.production_url}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={meta.tone}>
                    {meta.label}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Plataforma: {p.builder || "—"}</span>
                  <span>Responsável: {ownerName(p.owner_id)}</span>
                  <span>Domínio: {p.domain || "—"}</span>
                  <span>Publicação: {formatDate(p.published_at)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!p.production_url} asChild={!!p.production_url}>
                    {p.production_url ? (
                      <a href={p.production_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Abrir LP
                      </a>
                    ) : (
                      <span>
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Abrir LP
                      </span>
                    )}
                  </Button>
                  {editUrl && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={editUrl} target="_blank" rel="noreferrer">
                        Editor externo
                      </a>
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {visible ? "Visível ao cliente" : "Interno"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LandingPageDialog
        open={open}
        onOpenChange={setOpen}
        page={editing}
        fixedClientId={clientId}
      />
    </SectionCard>
  );
}

/* ------------------------------ Ativos gerais ----------------------------- */

type FormState = {
  asset_type: string;
  label: string;
  provider: string;
  identifier: string;
  url: string;
  username: string;
  category: string;
  owner_id: string;
  expires_at: string;
  status: string;
  notes: string;
  visible_to_client: boolean;
};

function emptyForm(section: AssetSectionConfig): FormState {
  return {
    asset_type: section.types[0],
    label: "",
    provider: "",
    identifier: "",
    url: "",
    username: "",
    category: section.categories?.[0] ?? "",
    owner_id: "none",
    expires_at: "",
    status: "active",
    notes: "",
    visible_to_client: false,
  };
}

function AssetSection({
  section,
  clientId,
  canEdit,
}: {
  section: AssetSectionConfig;
  clientId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff = [] } = useStaffMembers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DigitalAsset | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(section));

  const queryKey = ["client-digital-assets", clientId, section.key];

  const { data: assets = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_digital_assets")
        .select("*")
        .eq("client_id", clientId)
        .in("asset_type", section.types)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DigitalAsset[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const e = editing as DigitalAsset & {
        username?: string | null;
        category?: string | null;
        owner_id?: string | null;
        visible_to_client?: boolean;
      };
      setForm({
        asset_type: editing.asset_type,
        label: editing.label ?? "",
        provider: editing.provider ?? "",
        identifier: editing.identifier ?? "",
        url: editing.url ?? "",
        username: e.username ?? "",
        category: e.category ?? section.categories?.[0] ?? "",
        owner_id: e.owner_id ?? "none",
        expires_at: editing.expires_at ? editing.expires_at.slice(0, 10) : "",
        status: editing.status ?? "active",
        notes: editing.notes ?? "",
        visible_to_client: !!e.visible_to_client,
      });
    } else {
      setForm(emptyForm(section));
    }
  }, [open, editing, section]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        asset_type: form.asset_type,
        label: form.label.trim() || null,
        provider: form.provider.trim() || null,
        identifier: form.identifier.trim() || null,
        url: form.url.trim() || null,
        username: form.username.trim() || null,
        category: form.category || null,
        owner_id: form.owner_id === "none" ? null : form.owner_id,
        expires_at: form.expires_at || null,
        status: form.status,
        notes: form.notes.trim() || null,
        visible_to_client: form.visible_to_client,
      };
      if (editing) {
        const { error } = await supabase
          .from("client_digital_assets")
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_digital_assets")
          .insert({ ...payload, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      toast.success("Ativo salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_digital_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      toast.success("Ativo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const has = (f: string) => section.fields.includes(f as never);
  const fieldLabel = (f: keyof FormState, fallback: string) =>
    section.labels?.[f as never] ?? fallback;
  const ownerName = (id: string | null | undefined) => {
    const s = staff.find((m) => m.id === id);
    return s?.name || s?.email || "—";
  };

  return (
    <SectionCard
      title={section.title}
      description={section.description}
      collapsible
      actions={
        canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : assets.length === 0 ? (
        <EmptyState>Nenhum registro nesta seção.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {assets.map((a) => {
            const e = a as DigitalAsset & {
              username?: string | null;
              category?: string | null;
              owner_id?: string | null;
              visible_to_client?: boolean;
            };
            const meta = assetStatusMeta(a.status);
            return (
              <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{a.label || assetLabel(a.asset_type)}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {assetLabel(a.asset_type)}
                    </Badge>
                    <Badge variant="outline" className={meta.tone}>
                      {meta.label}
                    </Badge>
                    {e.visible_to_client && (
                      <Badge variant="outline" className="text-[10px]">
                        Visível ao cliente
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      e.category ? `Tipo: ${e.category}` : null,
                      a.provider ? `Provedor: ${a.provider}` : null,
                      a.identifier ? `ID: ${a.identifier}` : null,
                      e.username ? `Acesso: ${e.username}` : null,
                      a.expires_at ? `Vencimento: ${formatDate(a.expires_at)}` : null,
                      e.owner_id ? `Responsável: ${ownerName(e.owner_id)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem detalhes"}
                  </p>
                  {a.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground/80">
                      {a.notes}
                    </p>
                  )}
                </div>
                {a.url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Abrir
                    </a>
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => remove.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar registro" : `Adicionar em ${section.title}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {section.types.length > 1 && (
              <div>
                <Label>Tipo de ativo</Label>
                <Select
                  value={form.asset_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, asset_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {section.types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {assetLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Nome</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            {has("category") && section.categories && (
              <div>
                <Label>{fieldLabel("category", "Categoria")}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {section.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {has("provider") && (
                <div>
                  <Label>{fieldLabel("provider", "Provedor")}</Label>
                  <Input
                    value={form.provider}
                    onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                  />
                </div>
              )}
              {has("identifier") && (
                <div>
                  <Label>{fieldLabel("identifier", "ID")}</Label>
                  <Input
                    value={form.identifier}
                    onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
                  />
                </div>
              )}
              {has("url") && (
                <div>
                  <Label>{fieldLabel("url", "URL")}</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
              )}
              {has("username") && (
                <div>
                  <Label>{fieldLabel("username", "Usuário / e-mail")}</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
              )}
              {has("expires_at") && (
                <div>
                  <Label>{fieldLabel("expires_at", "Vencimento")}</Label>
                  <Input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>
              )}
              {has("owner") && (
                <div>
                  <Label>Responsável</Label>
                  <Select
                    value={form.owner_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Nunca registre senhas, tokens ou chaves de API aqui."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Visível para o cliente</p>
                <p className="text-xs text-muted-foreground">
                  Informações internas devem permanecer desativadas.
                </p>
              </div>
              <Switch
                checked={form.visible_to_client}
                onCheckedChange={(v) => setForm((f) => ({ ...f, visible_to_client: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
