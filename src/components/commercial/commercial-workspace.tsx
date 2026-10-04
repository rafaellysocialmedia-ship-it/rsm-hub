import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinanceAccess } from "@/hooks/use-finance";
import { PROPOSAL_STAGES, type CommercialProposal } from "@/lib/plan-completion";
import { retentionToday, dateLabel } from "@/lib/retention";
import { money } from "@/lib/finance-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QueryState } from "@/components/workspace/account-panels";
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export function CommercialWorkspace() {
  const { hasRole } = useAuth();
  const access = useFinanceAccess();
  const qc = useQueryClient();
  const allowed = (hasRole("administrator") || hasRole("team")) && access.canView;
  const [editing, setEditing] = useState<CommercialProposal | null | undefined>(undefined),
    [conversion, setConversion] = useState<CommercialProposal | null>(null),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["commercial"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_proposals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  function refresh() {
    void qc.invalidateQueries({ queryKey: ["commercial"] });
  }
  if (!allowed) return <p className="p-8">O comercial exige acesso financeiro da equipe RSM.</p>;
  const rows = (q.data ?? []).filter(
    (p) =>
      (filter === "all" || p.stage === filter) &&
      `${p.prospect_name} ${p.company} ${p.plan}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Comercial da RSM</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Da primeira conversa ao início da operação.
          </p>
        </div>
        {access.canEdit && (
          <Button onClick={() => setEditing(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova oportunidade
          </Button>
        )}
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            "Em negociação",
            (q.data ?? []).filter((p) => ["lead", "draft", "sent"].includes(p.stage)).length,
          ],
          ["Aguardando conversão", (q.data ?? []).filter((p) => p.stage === "accepted").length],
          ["Clientes conquistados", (q.data ?? []).filter((p) => p.stage === "converted").length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <strong className="mt-2 block text-3xl">{value}</strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Buscar proposta"
          placeholder="Buscar nome, empresa ou plano"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Etapa comercial"
          className={selectClass + " sm:max-w-64"}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todas as etapas</option>
          {Object.entries(PROPOSAL_STAGES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <QueryState loading={q.isLoading} error={q.error} empty={!rows.length}>
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex flex-wrap justify-between gap-2">
                  <CardTitle className="text-lg">{p.prospect_name}</CardTitle>
                  <Badge variant="outline">{PROPOSAL_STAGES[p.stage]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{p.company || p.email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  {p.plan} · <strong>{money(p.amount)}/mês</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Início: {dateLabel(p.start_date)} · Primeiro vencimento:{" "}
                  {dateLabel(p.first_due_date)}
                </p>
                {p.scope && <p className="line-clamp-3 whitespace-pre-wrap text-sm">{p.scope}</p>}
                <div className="flex flex-wrap gap-2">
                  {p.stage !== "converted" && access.canEdit && (
                    <Button variant="outline" onClick={() => setEditing(p)}>
                      Abrir proposta
                    </Button>
                  )}
                  {p.stage === "accepted" && access.canEdit && (
                    <Button onClick={() => setConversion(p)}>
                      <FileCheck className="mr-2 h-4 w-4" />
                      Converter em cliente
                    </Button>
                  )}
                  {p.client_id && (
                    <Button asChild variant="outline">
                      <Link to="/management/clients/$clientId" params={{ clientId: p.client_id }}>
                        Abrir cliente
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>
      {editing !== undefined && (
        <ProposalEditor
          proposal={editing}
          onClose={() => {
            setEditing(undefined);
            refresh();
          }}
        />
      )}
      {conversion && (
        <Conversion
          proposal={conversion}
          onClose={() => {
            setConversion(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
function ProposalEditor({
  proposal: p,
  onClose,
}: {
  proposal: CommercialProposal | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    prospect_name: p?.prospect_name ?? "",
    company: p?.company ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    plan: p?.plan ?? "",
    scope: p?.scope ?? "",
    amount: p?.amount.toString() ?? "",
    start_date: p?.start_date ?? retentionToday(),
    end_date: p?.end_date ?? "",
    first_due_date: p?.first_due_date ?? retentionToday(),
    stage: p?.stage ?? "lead",
    acceptance_note: p?.acceptance_note ?? "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Informe uma mensalidade válida");
      const payload = { ...form, amount, end_date: form.end_date || null };
      const result = p
        ? await supabase
            .from("commercial_proposals")
            .update(payload)
            .eq("id", p.id)
            .eq("updated_at", p.updated_at)
            .select("id")
            .single()
        : await supabase.from("commercial_proposals").insert(payload).select("id").single();
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Proposta salva");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p ? "Proposta comercial" : "Nova oportunidade"}</DialogTitle>
          <DialogDescription>
            Registre o contato, a oferta e a evolução da negociação.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["prospect_name", "Nome do contato", "text"],
                ["company", "Empresa", "text"],
                ["email", "E-mail", "email"],
                ["phone", "Telefone", "tel"],
                ["plan", "Plano / serviço", "text"],
                ["amount", "Mensalidade (R$)", "text"],
                ["start_date", "Início", "date"],
                ["end_date", "Término (opcional)", "date"],
                ["first_due_date", "Primeiro vencimento", "date"],
              ] as const
            ).map(([k, label, type]) => (
              <div key={k}>
                <Label htmlFor={"proposal-" + k}>{label}</Label>
                <Input
                  id={"proposal-" + k}
                  type={type}
                  required={[
                    "prospect_name",
                    "plan",
                    "amount",
                    "start_date",
                    "first_due_date",
                  ].includes(k)}
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
            <div>
              <Label htmlFor="proposal-stage">Etapa</Label>
              <select
                id="proposal-stage"
                className={selectClass}
                value={form.stage}
                onChange={(e) => set("stage", e.target.value)}
              >
                {Object.entries(PROPOSAL_STAGES)
                  .filter(([k]) => k !== "converted")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="proposal-scope">Escopo e condições</Label>
            <Textarea
              id="proposal-scope"
              rows={4}
              value={form.scope}
              maxLength={8000}
              onChange={(e) => set("scope", e.target.value)}
            />
          </div>
          {form.stage === "accepted" && (
            <div>
              <Label htmlFor="proposal-acceptance">Registro do aceite</Label>
              <Textarea
                id="proposal-acceptance"
                required
                minLength={5}
                maxLength={2000}
                placeholder="Quem aceitou, quando e por qual canal?"
                value={form.acceptance_note}
                onChange={(e) => set("acceptance_note", e.target.value)}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                O aceite é registrado pela equipe e não substitui a assinatura do contrato.
              </p>
            </div>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar proposta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Conversion({
  proposal: p,
  onClose,
}: {
  proposal: CommercialProposal;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [existing, setExisting] = useState(""),
    [auto, setAuto] = useState(false);
  const prospects = useQuery({
    queryKey: ["commercial-prospects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("status", "prospect")
        .eq("churned", false);
      if (error) throw error;
      return data;
    },
  });
  const convert = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("convert_commercial_proposal", {
        _id: p.id,
        _expected_updated_at: p.updated_at,
        ...(existing ? { _existing_client_id: existing } : {}),
        _auto_billing: auto,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      for (const key of [
        "commercial",
        "clients",
        "management-clients",
        "finance-contracts",
        "finance-charges",
        "retention",
        "experience",
      ])
        void qc.invalidateQueries({ queryKey: [key] });
      toast.success("Cliente, contrato, mensalidade e onboarding criados");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !convert.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar conta de {p.prospect_name}</DialogTitle>
          <DialogDescription>Confira os dados que serão levados para a operação.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            {p.plan} · <strong>{money(p.amount)}/mês</strong>
          </p>
          <p className="text-sm">
            Primeira cobrança: {dateLabel(p.first_due_date)}. O contrato para assinatura ficará
            pendente. O checklist e as pastas de arquivos serão criados.
          </p>
          <Label htmlFor="existing-prospect">Cadastro do cliente</Label>
          <select
            id="existing-prospect"
            className={selectClass}
            value={existing}
            onChange={(e) => setExisting(e.target.value)}
          >
            <option value="">Criar novo cliente</option>
            {prospects.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Reaproveitar prospect: {c.name}
              </option>
            ))}
          </select>
          {prospects.error && (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar prospects. Reabra esta janela para tentar novamente.
            </p>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            <span>
              Gerar as próximas mensalidades automaticamente, até o término do contrato ou
              encerramento da conta. Vencimento recorrente no dia{" "}
              {Math.min(Number(p.first_due_date.slice(-2)), 28)}.
            </span>
          </label>
          <Button
            className="w-full"
            onClick={() => convert.mutate()}
            disabled={convert.isPending || prospects.isLoading || !!prospects.error}
          >
            {convert.isPending ? "Criando conta…" : "Confirmar conversão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
