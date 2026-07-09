import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Meeting = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  meeting_date: string;
  meeting_time: string | null;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

const schema = z.object({
  title: z.string().min(2, "Título obrigatório"),
  description: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  meeting_date: z.string().min(1, "Data obrigatória"),
  meeting_time: z.string().optional().nullable(),
  duration_minutes: z.coerce.number().min(5).max(600),
  location: z.string().optional().nullable(),
  meeting_url: z.string().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meeting: Meeting | null;
  clients: { id: string; name: string }[];
};

export function MeetingDialog({ open, onOpenChange, meeting, clients }: Props) {
  const qc = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      client_id: null,
      meeting_date: new Date().toISOString().slice(0, 10),
      meeting_time: "10:00",
      duration_minutes: 30,
      location: "",
      meeting_url: "",
      status: "scheduled",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (meeting) {
      form.reset({
        title: meeting.title,
        description: meeting.description ?? "",
        client_id: meeting.client_id,
        meeting_date: meeting.meeting_date,
        meeting_time: meeting.meeting_time?.slice(0, 5) ?? "",
        duration_minutes: meeting.duration_minutes,
        location: meeting.location ?? "",
        meeting_url: meeting.meeting_url ?? "",
        status: meeting.status,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        client_id: null,
        meeting_date: new Date().toISOString().slice(0, 10),
        meeting_time: "10:00",
        duration_minutes: 30,
        location: "",
        meeting_url: "",
        status: "scheduled",
      });
    }
  }, [open, meeting, form]);

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      const payload = {
        title: v.title,
        description: v.description || null,
        client_id: v.client_id || null,
        meeting_date: v.meeting_date,
        meeting_time: v.meeting_time || null,
        duration_minutes: v.duration_minutes,
        location: v.location || null,
        meeting_url: v.meeting_url || null,
        status: v.status,
      };
      if (meeting) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", meeting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meetings").insert({ ...payload, created_by: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success(meeting ? "Reunião atualizada" : "Reunião criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{meeting ? "Editar reunião" : "Nova reunião"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Título</FormLabel>
                <FormControl><Input {...field} placeholder="Ex.: Kickoff mensal" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="client_id" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Cliente</FormLabel>
                <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="meeting_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Data</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="meeting_time" render={({ field }) => (
              <FormItem>
                <FormLabel>Hora</FormLabel>
                <FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="duration_minutes" render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (min)</FormLabel>
                <FormControl><Input type="number" min={5} max={600} {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendada</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>Local</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="Escritório, presencial..." /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="meeting_url" render={({ field }) => (
              <FormItem>
                <FormLabel>Link (Meet/Zoom)</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="https://..." /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Pauta / observações</FormLabel>
                <FormControl><Textarea rows={4} {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter className="col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
