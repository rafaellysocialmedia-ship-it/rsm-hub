import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { useTrafficClients } from "@/hooks/use-traffic";
import { LP_BUILDERS, LP_STATUS, type LandingPage, type LandingPageStatus } from "@/lib/traffic";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page?: LandingPage | null;
  fixedClientId?: string | null;
};

export function LandingPageDialog({ open, onOpenChange, page, fixedClientId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [] } = useTrafficClients();
  const { data: staff = [] } = useStaffMembers();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [prod, setProd] = useState("");
  const [staging, setStaging] = useState("");
  const [domain, setDomain] = useState("");
  const [builder, setBuilder] = useState(LP_BUILDERS[0]);
  const [status, setStatus] = useState<LandingPageStatus>("development");
  const [owner, setOwner] = useState("none");
  const [publishedAt, setPublishedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(page?.name ?? "");
    setClientId(page?.client_id ?? fixedClientId ?? "");
    setProd(page?.production_url ?? "");
    setStaging(page?.staging_url ?? "");
    setDomain(page?.domain ?? "");
    setBuilder(page?.builder ?? LP_BUILDERS[0]);
    setStatus(page?.status ?? "development");
    setOwner(page?.owner_id ?? "none");
    setPublishedAt(page?.published_at ?? "");
    setNotes(page?.notes ?? "");
    setEditUrl((page as { edit_url?: string | null } | null | undefined)?.edit_url ?? "");
    setVisible(
      (page as { visible_to_client?: boolean | null } | null | undefined)?.visible_to_client ?? false,
    );
  }, [open, page, fixedClientId]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        name: name.trim(),
        production_url: prod.trim() || null,
        staging_url: staging.trim() || null,
        domain: domain.trim() || null,
        builder,
        status,
        owner_id: owner === "none" ? null : owner,
        published_at: publishedAt || null,
        notes: notes.trim() || null,
        edit_url: editUrl.trim() || null,
        visible_to_client: visible,
      };
      if (page) {
        const { error } = await supabase.from("landing_pages").update(payload).eq("id", page.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("landing_pages")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["landing-pages"] });
      toast.success(page ? "Landing Page atualizada" : "Landing Page criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{page ? "Editar Landing Page" : "Nova Landing Page"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {!fixedClientId && (
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>URL de produção</Label>
            <Input value={prod} onChange={(e) => setProd(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>URL de edição (painel do builder)</Label>
            <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>URL de homologação (opcional)</Label>
            <Input value={staging} onChange={(e) => setStaging(e.target.value)} placeholder="https://" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Domínio</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
            <div>
              <Label>Plataforma utilizada</Label>
              <Select value={builder} onValueChange={setBuilder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LP_BUILDERS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LandingPageStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LP_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável pela criação</Label>
              <Select value={owner} onValueChange={setOwner}>
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
            <div>
              <Label>Data de publicação</Label>
              <Input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <Label>Visível para o cliente</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, o cliente vê esta Landing Page nos Ativos Digitais.
              </p>
            </div>
            <Switch checked={visible} onCheckedChange={setVisible} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!name.trim() || !clientId || save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
