import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { FinanceStatus, FinanceTransaction, FinanceType } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]),
  description: z.string().min(2, "Descreva a transação"),
  amount: z.coerce.number().min(0.01, "Informe um valor"),
  category: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  issue_date: z.string().min(1, "Data obrigatória"),
  due_date: z.string().optional().nullable(),
  paid_date: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recurrence_monthly: z.boolean(),
});

type FormValues = z.infer<typeof schema>;


type ClientLite = { id: string; name: string };

export function FinanceDialog({
  open,
  onOpenChange,
  transaction,
  clients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: FinanceTransaction | null;
  clients: ClientLite[];
}) {
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "income",
      status: "pending",
      description: "",
      amount: 0,
      category: "",
      client_id: null,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      paid_date: null,
      payment_method: "",
      notes: "",
      recurrence_monthly: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      form.reset({
        type: transaction.type,
        status: transaction.status,
        description: transaction.description,
        amount: Number(transaction.amount),
        category: transaction.category ?? "",
        client_id: transaction.client_id,
        issue_date: transaction.issue_date,
        due_date: transaction.due_date,
        paid_date: transaction.paid_date,
        payment_method: transaction.payment_method ?? "",
        notes: transaction.notes ?? "",
        recurrence_monthly: transaction.recurrence === "monthly" && transaction.recurrence_active !== false,
      });
    } else {
      form.reset({
        type: "income",
        status: "pending",
        description: "",
        amount: 0,
        category: "",
        client_id: null,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        paid_date: null,
        payment_method: "",
        notes: "",
        recurrence_monthly: false,

      });
    }
  }, [open, transaction, form]);

  const { data: sessionUserId } = useQuery({
    queryKey: ["session-uid"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = {
        type: v.type as FinanceType,
        status: v.status as FinanceStatus,
        description: v.description,
        amount: v.amount,
        category: v.category || null,
        client_id: v.client_id || null,
        issue_date: v.issue_date,
        due_date: v.due_date || null,
        paid_date: v.status === "paid" ? v.paid_date || v.issue_date : v.paid_date || null,
        payment_method: v.payment_method || null,
        notes: v.notes || null,
        recurrence: v.recurrence_monthly ? "monthly" : null,
        recurrence_active: v.recurrence_monthly,
      };
      if (transaction) {
        const { error } = await supabase
          .from("finance_transactions")
          .update(payload)
          .eq("id", transaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("finance_transactions")
          .insert({ ...payload, created_by: sessionUserId ?? undefined });
        if (error) throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success(transaction ? "Transação atualizada" : "Transação criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editar transação" : "Nova transação"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="grid grid-cols-2 gap-4"
          >
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex.: Mensalidade Setembro" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Assinatura, Anúncios, Design..." />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Cliente</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem cliente</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emissão</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="PIX, Boleto, Cartão..." />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            {(!transaction || !transaction.recurrence_parent_id) && (
              <div className="col-span-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <FormField
                  control={form.control}
                  name="recurrence_monthly"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <div>
                        <FormLabel>Mensalidade recorrente</FormLabel>
                        <p className="text-[11px] text-muted-foreground">
                          O lançamento é recriado automaticamente todo mês, sempre com a mesma
                          descrição (sem numeração de parcelas). Desative para encerrar.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}


            <DialogFooter className="col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
