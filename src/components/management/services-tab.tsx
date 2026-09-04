import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  SERVICE_CATALOG,
  SERVICE_SITUATIONS,
  formatDate,
  formatMoney,
  situationMeta,
  type ClientService,
} from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PostBalanceCard } from "./post-balance-card";
import { monthsActive, monthsActiveLabel, deliveryState } from "@/lib/digital-assets";
import { countMonthPosts, formatMonth } from "@/lib/post-quota";

export function ServicesTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [serviceKey, setServiceKey] = useState(SERVICE_CATALOG[0].key);
  const [situation, setSituation] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [amount, setAmount] = useState("");

  const { data: services = [] } = useQuery({
    queryKey: ["client-services", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_services")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientService[];
    },
  });

  const { data: quota } = useQuery({
    queryKey: ["client-quota", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("monthly_post_quota")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data?.monthly_post_quota ?? 0) as number;
    },
  });

  const { data: monthPosts = [] } = useQuery({
    queryKey: ["client-month-posts", clientId],
    queryFn: async () => {
      const ref = new Date();
      const first = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("posts")
        .select("client_id,status,scheduled_date")
        .eq("client_id", clientId)
        .gte("scheduled_date", first)
        .lte("scheduled_date", last);
      if (error) throw error;
      return data ?? [];
    },
  });

  const usedThisMonth = countMonthPosts(monthPosts as never, clientId);

  const upsert = useMutation({
    mutationFn: async () => {
      const label = SERVICE_CATALOG.find((s) => s.key === serviceKey)?.label ?? serviceKey;
      const { error } = await supabase.from("client_services").upsert(
        {
          client_id: clientId,
          service_key: serviceKey,
          label,
          situation,
          start_date: startDate || null,
          amount: amount ? Number(amount) : null,
          created_by: user?.id ?? null,
        } as never,
        { onConflict: "client_id,service_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-services", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      toast.success("Serviço salvo");
      setOpen(false);
      setStartDate("");
      setAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeSituation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("client_services")
        .update({ situation: value } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-services", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-services", clientId] });
      toast.success("Serviço removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
    <PostBalanceCard clientId={clientId} canEdit={canEdit} />
    <SectionCard
      collapsible
      title="Serviços contratados"
      description="Valores ficam registrados aqui e serão integrados ao financeiro futuramente."
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        ) : undefined
      }
    >
      {services.length === 0 ? (
        <EmptyState>Nenhum serviço registrado para este cliente.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {services.map((s) => {
            const meta = situationMeta(s.situation);
            const months = monthsActive(s.start_date);
            const isPostService = s.service_key === "social_media";
            const delivery = isPostService ? deliveryState(usedThisMonth, quota ?? 0) : null;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{s.label || s.service_key}</p>
                    <Badge variant="outline" className="bg-muted/50 text-[11px] font-normal">
                      {monthsActiveLabel(months)}
                    </Badge>
                    {delivery && (
                      <Badge variant="outline" className={`text-[11px] font-normal ${delivery.tone}`}>
                        {delivery.label} · {formatMonth()}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Início: {formatDate(s.start_date)} · Valor: {formatMoney(s.amount)}
                  </p>
                </div>
                {canEdit ? (
                  <Select
                    value={s.situation}
                    onValueChange={(v) => changeSituation.mutate({ id: s.id, value: v })}
                  >
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_SITUATIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={meta.tone}>
                    {meta.label}
                  </Badge>
                )}
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove.mutate(s.id)}
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
            <DialogTitle>Serviço contratado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Serviço</Label>
              <Select value={serviceKey} onValueChange={setServiceKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATALOG.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Situação</Label>
              <Select value={situation} onValueChange={setSituation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_SITUATIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Data de início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
    </div>
  );
}
