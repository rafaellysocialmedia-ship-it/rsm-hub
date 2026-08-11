import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethods, useFinanceAccess } from "@/hooks/use-finance";
import type { FinancePaymentMethod } from "@/lib/finance-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/finance/payment-methods")({
  head: () => ({
    meta: [
      { title: "Formas de Pagamento · Financeiro" },
      {
        name: "description",
        content:
          "Cadastre PIX, boleto, cartões, transferência e dinheiro; ative, desative e defina a forma padrão.",
      },
      { property: "og:title", content: "Formas de Pagamento · Financeiro" },
      {
        property: "og:description",
        content: "Configuração das formas de pagamento da agência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentMethodsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Página não encontrada</div>
  ),
});

function PaymentMethodsPage() {
  const qc = useQueryClient();
  const access = useFinanceAccess();
  const { data: methods = [], isLoading } = usePaymentMethods();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancePaymentMethod | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["finance-payment-methods"] });

  const toggleActive = useMutation({
    mutationFn: async (m: FinancePaymentMethod) => {
      const { error } = await supabase
        .from("finance_payment_methods")
        .update({ is_active: !m.is_active })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Forma de pagamento atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (m: FinancePaymentMethod) => {
      const { error: clear } = await supabase
        .from("finance_payment_methods")
        .update({ is_default: false })
        .neq("id", m.id);
      if (clear) throw clear;
      const { error } = await supabase
        .from("finance_payment_methods")
        .update({ is_default: true, is_active: true })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Forma padrão definida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (access.loading) return null;
  if (!access.canView) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        O módulo financeiro é restrito à equipe autorizada.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CreditCard className="h-6 w-6 text-primary" /> Formas de Pagamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Estrutura pronta para integrações futuras com gateways de pagamento.
          </p>
        </div>
        {access.canConfigure && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova forma
          </Button>
        )}
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Forma</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (
                methods.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-muted-foreground">{m.key}</TableCell>
                    <TableCell className="text-muted-foreground">{m.gateway ?? "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={m.is_active}
                        disabled={!access.canConfigure || toggleActive.isPending}
                        onCheckedChange={() => toggleActive.mutate(m)}
                      />
                    </TableCell>
                    <TableCell>
                      {m.is_default ? (
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          Padrão
                        </Badge>
                      ) : (
                        access.canConfigure && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDefault.mutate(m)}
                            disabled={setDefault.isPending}
                          >
                            <Star className="mr-1.5 h-4 w-4" /> Definir
                          </Button>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {access.canConfigure && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(m);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MethodDialog open={open} onOpenChange={setOpen} method={editing} />
    </div>
  );
}

function MethodDialog({
  open,
  onOpenChange,
  method,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  method: FinancePaymentMethod | null;
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [gateway, setGateway] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLabel(method?.label ?? "");
    setKey(method?.key ?? "");
    setGateway(method?.gateway ?? "");
    setNotes(method?.notes ?? "");
    setActive(method?.is_active ?? true);
  }, [open, method]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Informe o nome da forma de pagamento");
      const slug =
        (key.trim() ||
          trimmed
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")).slice(0, 40);
      const payload = {
        label: trimmed.slice(0, 60),
        key: slug,
        gateway: gateway.trim() ? gateway.trim().slice(0, 40) : null,
        notes: notes.trim() ? notes.trim().slice(0, 500) : null,
        is_active: active,
      };
      if (method) {
        const { error } = await supabase
          .from("finance_payment_methods")
          .update(payload)
          .eq("id", method.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_payment_methods").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-payment-methods"] });
      toast.success(method ? "Forma atualizada" : "Forma cadastrada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{method ? "Editar forma de pagamento" : "Nova forma de pagamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pm-label">Nome</Label>
            <Input id="pm-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-key">Chave interna</Label>
            <Input
              id="pm-key"
              value={key}
              maxLength={40}
              placeholder="gerada automaticamente"
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-gateway">Gateway (futuro)</Label>
            <Input
              id="pm-gateway"
              value={gateway}
              maxLength={40}
              placeholder="asaas, stripe..."
              onChange={(e) => setGateway(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-notes">Observações</Label>
            <Textarea
              id="pm-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="pm-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="pm-active">Ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
