import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { BriefingSection, BriefingTemplateRow } from "@/lib/briefings";
import { newId } from "@/lib/briefings";

export const Route = createFileRoute("/_authenticated/briefings/template")({
  component: BriefingTemplateEditor,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

function BriefingTemplateEditor() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sections, setSections] = useState<BriefingSection[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["briefing-template"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("briefing_template")
        .select("id, name, sections")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BriefingTemplateRow | null;
    },
  });

  useEffect(() => {
    if (data) {
      setTemplateId(data.id);
      setSections(data.sections ?? []);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (templateId) {
        const { error } = await (supabase as any)
          .from("briefing_template")
          .update({ sections, updated_by: user?.id ?? null })
          .eq("id", templateId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("briefing_template")
          .insert({ name: "Template padrão", sections, updated_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefing-template"] });
      toast.success("Template salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSection = () =>
    setSections((prev) => [...prev, { id: newId("s"), title: "Nova seção", questions: [] }]);

  const removeSection = (sIdx: number) =>
    setSections((prev) => prev.filter((_, i) => i !== sIdx));

  const editSectionTitle = (sIdx: number, title: string) =>
    setSections((prev) => {
      const next = [...prev];
      next[sIdx] = { ...next[sIdx], title };
      return next;
    });

  const addQuestion = (sIdx: number) =>
    setSections((prev) => {
      const next = [...prev];
      next[sIdx] = {
        ...next[sIdx],
        questions: [...next[sIdx].questions, { id: newId(), text: "Nova pergunta" }],
      };
      return next;
    });

  const editQuestion = (sIdx: number, qIdx: number, text: string) =>
    setSections((prev) => {
      const next = [...prev];
      const qs = [...next[sIdx].questions];
      qs[qIdx] = { ...qs[qIdx], text };
      next[sIdx] = { ...next[sIdx], questions: qs };
      return next;
    });

  const removeQuestion = (sIdx: number, qIdx: number) =>
    setSections((prev) => {
      const next = [...prev];
      next[sIdx] = {
        ...next[sIdx],
        questions: next[sIdx].questions.filter((_, i) => i !== qIdx),
      };
      return next;
    });

  const moveSection = (sIdx: number, dir: -1 | 1) =>
    setSections((prev) => {
      const target = sIdx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[sIdx], next[target]] = [next[target], next[sIdx]];
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/briefings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Briefings
            </Link>
          </Button>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar template
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perguntas do briefing</h1>
        <p className="text-sm text-muted-foreground">
          Este é o template usado ao criar um novo briefing. Alterações não afetam briefings já criados.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((s, sIdx) => (
          <Card key={s.id}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => moveSection(sIdx, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => moveSection(sIdx, 1)}
                  >
                    ▼
                  </button>
                </div>
                <Input
                  value={s.title}
                  onChange={(e) => editSectionTitle(sIdx, e.target.value)}
                  className="flex-1 font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeSection(sIdx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 pl-6">
                {s.questions.map((q, qIdx) => (
                  <div key={q.id} className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={q.text}
                      onChange={(e) => editQuestion(sIdx, qIdx, e.target.value)}
                      className="flex-1 text-sm"
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
                ))}
                <Button variant="outline" size="sm" onClick={() => addQuestion(sIdx)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Adicionar pergunta
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" onClick={addSection} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar seção
        </Button>
      </div>
    </div>
  );
}
