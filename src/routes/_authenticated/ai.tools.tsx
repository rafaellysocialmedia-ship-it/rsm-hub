import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Loader2, Sparkles, Hash, Lightbulb, Pencil, Film, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runAiGenerator, type GeneratorKind } from "@/lib/ai-generators.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai/tools")({
  component: AiToolsPage,
});

type ToolDef = {
  kind: GeneratorKind;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  topicLabel: string;
  topicPlaceholder: string;
  multiline?: boolean;
};

const TOOLS: ToolDef[] = [
  {
    kind: "caption",
    label: "Legenda",
    description: "3 opções de legenda com hook e CTA.",
    icon: FileText,
    topicLabel: "Sobre o quê é o post?",
    topicPlaceholder: "Ex: lançamento de curso de social media",
  },
  {
    kind: "ideas",
    label: "Ideias de pauta",
    description: "8 ideias acionáveis para o nicho.",
    icon: Lightbulb,
    topicLabel: "Tema ou nicho",
    topicPlaceholder: "Ex: clínica de estética facial",
  },
  {
    kind: "hashtags",
    label: "Hashtags",
    description: "Conjuntos curto, médio e longo.",
    icon: Hash,
    topicLabel: "Tema/nicho do post",
    topicPlaceholder: "Ex: café especial em SP",
  },
  {
    kind: "rewrite",
    label: "Reescrever",
    description: "3 variações melhoradas.",
    icon: Pencil,
    topicLabel: "Texto original",
    topicPlaceholder: "Cole o texto que quer reescrever",
    multiline: true,
  },
  {
    kind: "script",
    label: "Roteiro Reels/Shorts",
    description: "Estrutura HOOK → DEV → CTA.",
    icon: Film,
    topicLabel: "Tema ou produto",
    topicPlaceholder: "Ex: dicas para acordar cedo",
  },
];

function AiToolsPage() {
  const [selected, setSelected] = useState<GeneratorKind>("caption");
  const tool = TOOLS.find((t) => t.kind === selected)!;
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-0 md:grid-cols-[280px_1fr]">
      <aside className="border-b border-border bg-card p-3 md:border-b-0 md:border-r">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Geradores
        </p>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
          {TOOLS.map((t) => {
            const active = t.kind === selected;
            return (
              <button
                key={t.kind}
                onClick={() => setSelected(t.kind)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                  active
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="hidden text-xs text-muted-foreground md:block">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="overflow-y-auto p-6">
        <GeneratorForm tool={tool} />
      </div>
    </div>
  );
}

function GeneratorForm({ tool }: { tool: ToolDef }) {
  const [topic, setTopic] = useState("");
  const [network, setNetwork] = useState<string>("");
  const [tone, setTone] = useState<string>("");
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState<string>("");

  const run = useServerFn(runAiGenerator);
  const mut = useMutation({
    mutationFn: async () => {
      const res = await run({ data: { kind: tool.kind, topic, network, tone, extra } });
      return res.text;
    },
    onSuccess: (text) => setResult(text),
    onError: (e: Error) => toast.error(e.message || "Erro ao gerar"),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    toast.success("Copiado!");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <tool.icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>{tool.label}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{tool.topicLabel}</Label>
            {tool.multiline ? (
              <Textarea
                rows={5}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={tool.topicPlaceholder}
              />
            ) : (
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={tool.topicPlaceholder}
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rede social</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="X">X (Twitter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tom de voz</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue placeholder="Natural" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="descontraído">Descontraído</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="inspiracional">Inspiracional</SelectItem>
                  <SelectItem value="educacional">Educacional</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="humor">Humor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contexto extra (opcional)</Label>
            <Textarea
              rows={2}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Ex: público 25-40, marca leve, promoção 30% off..."
            />
          </div>
          <Button
            onClick={() => mut.mutate()}
            disabled={!topic.trim() || mut.isPending}
            className="w-full"
          >
            {mut.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Gerar</>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Resultado</CardTitle>
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar tudo
            </Button>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
