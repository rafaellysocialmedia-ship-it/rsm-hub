import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type CommemorativeDate = {
  id: string;
  name: string;
  month: number;
  day: number;
  category: string | null;
  emoji: string | null;
};

const sb = supabase as unknown as typeof supabase;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Sugestões de símbolos que remetem à comemoração (ex.: Dia do Advogado → ⚖️). */
export const EMOJI_SUGGESTIONS: { emoji: string; hint: string }[] = [
  { emoji: "⚖️", hint: "Advogado / Justiça" },
  { emoji: "🩺", hint: "Médico / Saúde" },
  { emoji: "🦷", hint: "Dentista" },
  { emoji: "🎓", hint: "Educação / Professor" },
  { emoji: "💇", hint: "Beleza / Cabeleireiro" },
  { emoji: "💅", hint: "Manicure / Estética" },
  { emoji: "🏋️", hint: "Educação física" },
  { emoji: "🍽️", hint: "Gastronomia" },
  { emoji: "☕", hint: "Café" },
  { emoji: "🐶", hint: "Pet / Animais" },
  { emoji: "🏗️", hint: "Engenharia / Obra" },
  { emoji: "📐", hint: "Arquitetura" },
  { emoji: "💻", hint: "Tecnologia / Programador" },
  { emoji: "📸", hint: "Fotografia" },
  { emoji: "🚗", hint: "Automotivo" },
  { emoji: "🛍️", hint: "Varejo / Consumidor" },
  { emoji: "💰", hint: "Finanças / Contador" },
  { emoji: "❤️", hint: "Namorados / Amor" },
  { emoji: "👩", hint: "Dia da Mulher / Mãe" },
  { emoji: "👨", hint: "Dia dos Pais / Homem" },
  { emoji: "🧒", hint: "Dia das Crianças" },
  { emoji: "🎄", hint: "Natal" },
  { emoji: "🎃", hint: "Halloween" },
  { emoji: "🎉", hint: "Festa / Genérico" },
  { emoji: "🇧🇷", hint: "Data cívica" },
  { emoji: "🌱", hint: "Meio ambiente" },
];

type FormState = {
  id: string | null;
  name: string;
  month: number;
  day: number;
  category: string;
  emoji: string;
};

const emptyForm = (month?: number, day?: number): FormState => ({
  id: null,
  name: "",
  month: month ?? new Date().getMonth() + 1,
  day: day ?? new Date().getDate(),
  category: "",
  emoji: "🎉",
});

export function CommemorativeDatesDialog({
  open,
  onOpenChange,
  initialMonth,
  initialDay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialMonth?: number;
  initialDay?: number;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyForm(initialMonth, initialDay));
  const [monthFilter, setMonthFilter] = useState<number>(initialMonth ?? new Date().getMonth() + 1);

  const { data: dates = [] } = useQuery({
    queryKey: ["commemorative-dates"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("commemorative_dates" as never)
        .select("id, name, month, day, category, emoji");
      if (error) throw error;
      return (data ?? []) as unknown as CommemorativeDate[];
    },
  });

  const listed = useMemo(
    () => dates.filter((d) => d.month === monthFilter).sort((a, b) => a.day - b.day),
    [dates, monthFilter],
  );

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        name: f.name.trim(),
        month: f.month,
        day: f.day,
        category: f.category.trim() || null,
        emoji: f.emoji || "🎉",
      };
      if (f.id) {
        const { error } = await sb.from("commemorative_dates" as never).update(payload as never).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("commemorative_dates" as never).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, f) => {
      toast.success(f.id ? "Data atualizada" : "Data comemorativa adicionada");
      setForm(emptyForm(f.month, f.day));
      qc.invalidateQueries({ queryKey: ["commemorative-dates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("commemorative_dates" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Data removida");
      qc.invalidateQueries({ queryKey: ["commemorative-dates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Datas comemorativas</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Dia do Advogado"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Dia</Label>
                <Input
                  type="number" min={1} max={31}
                  value={form.day}
                  onChange={(e) => setForm((f) => ({ ...f, day: Number(e.target.value) }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Mês</Label>
                <select
                  value={form.month}
                  onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria (opcional)</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ex.: Profissões"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Símbolo</Label>
              <Input
                value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                className="w-20 text-center text-lg"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {EMOJI_SUGGESTIONS.map((s) => (
                  <button
                    key={s.emoji}
                    type="button"
                    title={s.hint}
                    onClick={() => setForm((f) => ({ ...f, emoji: s.emoji }))}
                    className={cn(
                      "rounded border border-border px-1.5 py-0.5 text-base transition-colors hover:bg-muted",
                      form.emoji === s.emoji && "border-primary bg-primary/10",
                    )}
                  >
                    {s.emoji}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter className="justify-start gap-2 sm:justify-start">
              <Button
                onClick={() => save.mutate(form)}
                disabled={!form.name.trim() || save.isPending}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> {form.id ? "Salvar alterações" : "Adicionar data"}
              </Button>
              {form.id && (
                <Button variant="ghost" onClick={() => setForm(emptyForm(form.month, form.day))}>
                  Cancelar
                </Button>
              )}
            </DialogFooter>
          </div>

          {/* List */}
          <div className="space-y-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
              {listed.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Nenhuma data cadastrada neste mês
                </p>
              ) : (
                listed.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span className="text-base">{d.emoji ?? "🎉"}</span>
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">
                      {String(d.day).padStart(2, "0")}/{String(d.month).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setForm({
                        id: d.id, name: d.name, month: d.month, day: d.day,
                        category: d.category ?? "", emoji: d.emoji ?? "🎉",
                      })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => remove.mutate(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
