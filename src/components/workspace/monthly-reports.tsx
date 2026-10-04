import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, Send, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMonthlyReports, useExperienceMutation } from "@/hooks/use-client-experience";
import {
  monthLabel,
  metricLabel,
  type ReportMetrics,
  type MonthlyReport,
} from "@/lib/client-experience";
import { retentionToday, dateLabel } from "@/lib/retention";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryState } from "./account-panels";
function previousMonth(month: string) {
  const [y, m] = month.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
export function MonthlyReports({
  clientId,
  clientName,
  canEdit = false,
}: {
  clientId: string;
  clientName: string;
  canEdit?: boolean;
}) {
  const q = useMonthlyReports(clientId),
    [selected, setSelected] = useState(""),
    [draftMonth, setDraftMonth] = useState(previousMonth(retentionToday()));
  const report = q.data?.find((r) => r.report_month === selected) ?? q.data?.[0];
  const published = (
    <div className="space-y-5">
      <QueryState loading={q.isLoading} error={q.error}>
        {!q.data?.length ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {canEdit
                ? "Nenhum relatório compartilhado ainda. Prepare um rascunho e publique quando estiver pronto."
                : "Seu relatório mensal aparecerá aqui quando a RSM o disponibilizar."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Relatórios compartilhados pela RSM</p>
              <select
                aria-label="Selecionar relatório publicado"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={report?.report_month ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {q.data.map((r) => (
                  <option key={r.id} value={r.report_month}>
                    {monthLabel(r.report_month)}
                  </option>
                ))}
              </select>
            </div>
            {report && (
              <PublishedReport
                report={report}
                clientName={clientName}
                previous={q.data.find((r) =>
                  r.report_month.startsWith(previousMonth(report.report_month)),
                )}
              />
            )}
            {q.data.length > 1 && <ReportEvolution reports={q.data} />}
          </>
        )}
      </QueryState>
    </div>
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatórios mensais
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultados das publicações, análise da RSM e próximos passos.
          </p>
        </div>
        {(
          <Button variant="outline" asChild>
            <Link to="/analytics">{canEdit ? "Registrar métricas" : "Ver métricas detalhadas"}</Link>
          </Button>
        )}
      </div>
      {canEdit ? (
        <Tabs defaultValue="published">
          <TabsList>
            <TabsTrigger value="published">Compartilhados</TabsTrigger>
            <TabsTrigger value="draft">Preparar relatório</TabsTrigger>
          </TabsList>
          <TabsContent value="published" className="mt-4">
            {published}
          </TabsContent>
          <TabsContent value="draft" className="mt-4 space-y-4">
            <div className="max-w-xs">
              <Label htmlFor="report-month">Mês do relatório</Label>
              <Input
                id="report-month"
                type="month"
                value={draftMonth}
                onChange={(e) => setDraftMonth(e.target.value)}
              />
            </div>
            {draftMonth && (
              <ReportEditor
                key={clientId + draftMonth}
                clientId={clientId}
                month={draftMonth}
                alreadyPublished={
                  q.data?.some((r) => r.report_month.startsWith(draftMonth)) ?? false
                }
              />
            )}
          </TabsContent>
        </Tabs>
      ) : (
        published
      )}
    </section>
  );
}
function MetricSummary({ metrics: m }: { metrics: ReportMetrics }) {
  const items: [string, number | null | undefined, string?][] = [
    ["Publicações", m.published_posts],
    ["Alcance somado", m.reach],
    ["Impressões", m.impressions],
    ["Interações", m.interactions],
    ["Visualizações de vídeo", m.video_views],
    ["Seguidores ganhos atribuídos", m.followers_gained],
    ["Taxa de interação / alcance", m.engagement_rate, "%"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(([label, value, suffix]) => (
          <div key={label} className="rounded-xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{metricLabel(value, suffix)}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Cobertura: {m.posts_with_metrics} de {m.published_posts} publicações com métricas. Última
        coleta: {dateLabel(m.latest_collection)}.
      </p>
      {m.posts_with_metrics < m.published_posts && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm">
          As métricas estão parciais. Publicações sem coleta não entram nos totais de desempenho.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Usamos a coleta mais recente de cada publicação por rede. O alcance é a soma dos posts, não
        pessoas únicas no mês. Seguidores ganhos são os atribuídos às publicações; não representam o
        total de seguidores do perfil.
      </p>
    </div>
  );
}
function PublishedReport({
  report: r,
  clientName,
  previous,
}: {
  report: MonthlyReport;
  clientName: string;
  previous?: MonthlyReport;
}) {
  return (
    <Card className="overflow-hidden">
      <header className="border-b bg-primary/5 p-5 sm:p-7">
        <p className="text-sm font-medium text-primary">RSM · Relatório de resultados</p>
        <h3 className="mt-2 text-2xl font-semibold capitalize">{monthLabel(r.report_month)}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} · Compartilhado em {dateLabel(r.published_at)}
        </p>
      </header>
      <CardContent className="space-y-6 p-5 sm:p-7">
        <MetricSummary metrics={r.metrics} />
        {previous && (
          <div className="rounded-xl border p-4">
            <h4 className="font-medium">Comparação com {monthLabel(previous.report_month)}</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["Publicações", r.metrics.published_posts, previous.metrics.published_posts],
                ["Interações", r.metrics.interactions, previous.metrics.interactions],
                ["Impressões", r.metrics.impressions, previous.metrics.impressions],
              ].map(([label, current, past]) => {
                const delta =
                  typeof current === "number" && typeof past === "number" ? current - past : null;
                return (
                  <div key={label as string}>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 font-medium">
                      {delta === null
                        ? "Sem comparação"
                        : `${delta > 0 ? "+" : ""}${delta.toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Diferença entre as versões publicadas. Coberturas de coleta diferentes podem afetar a
              comparação.
            </p>
          </div>
        )}
        {r.metrics.top_posts.length > 0 && (
          <section>
            <h4 className="font-semibold">Conteúdos com mais interações</h4>
            <div className="mt-3 space-y-2">
              {r.metrics.top_posts.map((p, i) => (
                <div key={p.id} className="flex items-start gap-3 rounded-xl border p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {metricLabel(p.interactions)} interações · {metricLabel(p.reach)} de alcance
                      somado
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="rounded-xl bg-primary/5 p-5">
          <h4 className="font-semibold">Análise da RSM</h4>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed">{r.analysis}</p>
        </section>
        {r.next_steps && (
          <section>
            <h4 className="font-semibold">Próximos passos</h4>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed">{r.next_steps}</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
function ReportEvolution({ reports }: { reports: MonthlyReport[] }) {
  const rows = [...reports].slice(0, 6).reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evolução dos meses compartilhados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-3 pr-4 font-medium">Mês</th>
                <th className="pb-3 pr-4 font-medium">Posts</th>
                <th className="pb-3 pr-4 font-medium">Com métricas</th>
                <th className="pb-3 pr-4 font-medium">Alcance somado</th>
                <th className="pb-3 font-medium">Interações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap py-3 pr-4 capitalize">
                    {monthLabel(r.report_month)}
                  </td>
                  <td className="py-3 pr-4">{r.metrics.published_posts}</td>
                  <td className="py-3 pr-4">{r.metrics.posts_with_metrics}</td>
                  <td className="py-3 pr-4">{metricLabel(r.metrics.reach)}</td>
                  <td className="py-3">{metricLabel(r.metrics.interactions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
function ReportEditor({
  clientId,
  month,
  alreadyPublished,
}: {
  clientId: string;
  month: string;
  alreadyPublished: boolean;
}) {
  const qc = useQueryClient(),
    [analysis, setAnalysis] = useState(""),
    [next, setNext] = useState(""),
    [dirty, setDirty] = useState(false);
  const key = ["experience", "draft", clientId, month];
  const draft = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_report_drafts")
        .select("*")
        .eq("client_id", clientId)
        .eq("report_month", month + "-01")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const metrics = useQuery({
    queryKey: ["experience", "report-preview", clientId, month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_report_metrics", {
        _client_id: clientId,
        _month: month + "-01",
      });
      if (error) throw error;
      return data as unknown as ReportMetrics;
    },
  });
  useEffect(() => {
    if (!dirty && draft.data) {
      setAnalysis(draft.data.analysis);
      setNext(draft.data.next_steps);
    }
  }, [draft.data, dirty]);
  const save = useExperienceMutation(async () => {
    const fields = { analysis: analysis.trim(), next_steps: next.trim() };
    const result = draft.data
      ? await supabase
          .from("client_report_drafts")
          .update(fields)
          .eq("client_id", clientId)
          .eq("report_month", month + "-01")
          .eq("updated_at", draft.data.updated_at)
          .select()
          .single()
      : await supabase
          .from("client_report_drafts")
          .insert({ ...fields, client_id: clientId, report_month: month + "-01" })
          .select()
          .single();
    if (result.error)
      throw new Error(
        "Não foi possível salvar. Recarregue o rascunho para verificar se outra pessoa o alterou.",
      );
    qc.setQueryData(key, result.data);
    setDirty(false);
  }, "Rascunho salvo. O cliente ainda não vê estas alterações.");
  const publish = useExperienceMutation(async () => {
    if (dirty || !draft.data) throw new Error("Salve o rascunho antes de publicar.");
    const { error } = await supabase.rpc("publish_monthly_report", {
      _client_id: clientId,
      _month: month + "-01",
      _expected_updated_at: draft.data.updated_at,
    });
    if (error) throw error;
  }, "Relatório disponibilizado no painel do cliente");
  return (
    <QueryState loading={draft.isLoading} error={draft.error}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg capitalize">{monthLabel(month)}</CardTitle>
            <Badge variant="outline">Rascunho privado</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {alreadyPublished
              ? "Existe uma versão publicada. Ela permanece visível enquanto você prepara este rascunho."
              : "Prepare a análise e revise os dados antes de compartilhar com o cliente."}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <QueryState loading={metrics.isLoading} error={metrics.error}>
            {metrics.data && <MetricSummary metrics={metrics.data} />}
          </QueryState>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void metrics.refetch()}
            disabled={metrics.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar prévia das métricas
          </Button>
          <div>
            <Label htmlFor="report-analysis">Análise da RSM</Label>
            <Textarea
              id="report-analysis"
              rows={6}
              maxLength={8000}
              value={analysis}
              onChange={(e) => {
                setAnalysis(e.target.value);
                setDirty(true);
              }}
              placeholder="O que os resultados mostram? Quais aprendizados devem orientar o próximo mês?"
            />
          </div>
          <div>
            <Label htmlFor="report-next">Próximos passos</Label>
            <Textarea
              id="report-next"
              rows={4}
              maxLength={8000}
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setDirty(true);
              }}
              placeholder="Prioridades e ações para o próximo período."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={save.isPending || publish.isPending || (!dirty && !!draft.data)}
              onClick={() => save.mutate()}
            >
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button
              disabled={
                save.isPending ||
                publish.isPending ||
                dirty ||
                !draft.data?.analysis.trim() ||
                metrics.isError ||
                metrics.isLoading
              }
              onClick={() => publish.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              {publish.isPending
                ? "Publicando…"
                : alreadyPublished
                  ? "Publicar nova versão"
                  : "Publicar no painel do cliente"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            A publicação registra as métricas disponíveis naquele momento. Coletas futuras só entram
            após publicar uma nova versão. Nenhuma mensagem externa é enviada.
          </p>
        </CardContent>
      </Card>
    </QueryState>
  );
}
