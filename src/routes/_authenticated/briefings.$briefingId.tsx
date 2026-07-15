import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, CheckCircle2, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BriefingRow, BriefingSection } from "@/lib/briefings";
import { briefingCompletion, newId } from "@/lib/briefings";

export const Route = createFileRoute("/_authenticated/briefings/$briefingId")({
  component: BriefingDetail,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Briefing não encontrado</div>,
});

function BriefingDetail() {
  const { briefingId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: briefing, isLoading } = useQuery({
    queryKey: ["briefing", briefingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("briefings")
        .select("*")
        .eq("id", briefingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Briefing não encontrado");
      return data as BriefingRow;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [sections, setSections] = useState<BriefingSection[]>([]);
  const [status, setStatus] = useState<"draft" | "completed">("draft");

  useEffect(() => {
    if (briefing) {
      setTitle(briefing.title);
      setMeetingDate(briefing.meeting_date ?? "");
      setNotes(briefing.notes ?? "");
      setClientId(briefing.client_id ?? "");
      setSections(briefing.sections ?? []);
      setStatus(briefing.status);
    }
  }, [briefing]);

  const completion = useMemo(() => briefingCompletion(sections), [sections]);

  const saveMutation = useMutation({
    mutationFn: async (patch?: Partial<{ status: "draft" | "completed" }>) => {
      const payload = {
        title: title.trim() || "Briefing",
        meeting_date: meetingDate || null,
        notes: notes || null,
        client_id: clientId || null,
        sections,
        status: patch?.status ?? status,
      };
      const { error } = await (supabase as any).from("briefings").update(payload).eq("id", briefingId);
      if (error) throw error;
      if (patch?.status) setStatus(patch.status);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["briefing", briefingId] });
      qc.invalidateQueries({ queryKey: ["briefings"] });
      toast.success(vars?.status === "completed" ? "Briefing concluído" : "Alterações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("briefings").delete().eq("id", briefingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefings"] });
      toast.success("Briefing removido");
      navigate({ to: "/briefings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAnswer = (sIdx: number, qIdx: number, value: string) => {
    setSections((prev) => {
      const next = [...prev];
      const s = { ...next[sIdx] };
      const qs = [...s.questions];
      qs[qIdx] = { ...qs[qIdx], answer: value };
      s.questions = qs;
      next[sIdx] = s;
      return next;
    });
  };

  const addQuestion = (sIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      const s = { ...next[sIdx] };
      s.questions = [...s.questions, { id: newId(), text: "Nova pergunta", answer: "" }];
      next[sIdx] = s;
      return next;
    });
  };

  const editQuestionText = (sIdx: number, qIdx: number, text: string) => {
    setSections((prev) => {
      const next = [...prev];
      const s = { ...next[sIdx] };
      const qs = [...s.questions];
      qs[qIdx] = { ...qs[qIdx], text };
      s.questions = qs;
      next[sIdx] = s;
      return next;
    });
  };

  const removeQuestion = (sIdx: number, qIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      const s = { ...next[sIdx] };
      s.questions = s.questions.filter((_, i) => i !== qIdx);
      next[sIdx] = s;
      return next;
    });
  };

  const exportMarkdown = () => {
    const client = clients.find((c) => c.id === clientId)?.name ?? "—";
    let md = `# ${title}\n\n**Cliente:** ${client}\n**Data da reunião:** ${meetingDate || "—"}\n\n`;
    sections.forEach((s) => {
      md += `\n## ${s.title}\n\n`;
      s.questions.forEach((q) => {
        md += `**${q.text}**\n${q.answer?.trim() || "_(sem resposta)_"}\n\n`;
      });
    });
    if (notes) md += `\n## Observações\n\n${notes}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9-_]+/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !briefing) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/briefings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Briefings
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportMarkdown}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir briefing?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da reunião</Label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="flex items-end justify-between gap-2">
              <Badge variant={status === "completed" ? "default" : "secondary"}>
                {status === "completed" ? "Concluído" : "Rascunho"}
              </Badge>
              <div className="text-right text-xs text-muted-foreground">
                {completion.answered}/{completion.total} respondidas · {completion.pct}%
              </div>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${completion.pct}%` }} />
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={sections.slice(0, 1).map((s) => s.id)} className="space-y-2">
        {sections.map((s, sIdx) => {
          const answered = s.questions.filter((q) => (q.answer ?? "").trim().length > 0).length;
          return (
            <AccordionItem key={s.id} value={s.id} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                  <span className="text-left font-medium">{s.title}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {answered}/{s.questions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                {s.questions.map((q, qIdx) => (
                  <div key={q.id} className="space-y-1.5 rounded-md border border-dashed p-3">
                    <div className="flex items-start gap-2">
                      <Input
                        value={q.text}
                        onChange={(e) => editQuestionText(sIdx, qIdx, e.target.value)}
                        className="h-8 flex-1 text-sm font-medium"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeQuestion(sIdx, qIdx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      value={q.answer ?? ""}
                      onChange={(e) => updateAnswer(sIdx, qIdx, e.target.value)}
                      placeholder="Resposta…"
                    />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addQuestion(sIdx)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Adicionar pergunta
                </Button>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <Label>Observações internas</Label>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur">
        <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
        <Button
          onClick={() =>
            saveMutation.mutate({ status: status === "completed" ? "draft" : "completed" })
          }
          disabled={saveMutation.isPending}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {status === "completed" ? "Reabrir" : "Concluir"}
        </Button>
      </div>
    </div>
  );
}
