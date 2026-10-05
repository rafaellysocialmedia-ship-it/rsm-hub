import { ExtraQuote } from "./extra-quote";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { REQUEST_STATUS, type ClientRequest } from "@/lib/plan-completion";
import { dateLabel } from "@/lib/retention";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "./account-panels";
const selectClass = "h-10 rounded-md border bg-background px-3 text-sm";
export function ClientRequests({
  clientId,
  canEdit = false,
  defaultKind = "support",
}: {
  clientId: string;
  canEdit?: boolean;
  defaultKind?: ClientRequest["kind"];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [kind, setKind] = useState<ClientRequest["kind"]>(defaultKind),
    [due, setDue] = useState("");
  const q = useQuery({
    queryKey: ["client-requests", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  function refresh() {
    for (const key of ["client-requests", "retention"])
      void qc.invalidateQueries({ queryKey: [key] });
  }
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_requests").insert({
        client_id: clientId,
        title: title.trim(),
        description: description.trim(),
        kind,
        ...(canEdit && kind === "material" ? { status: "waiting_client" as const } : {}),
        ...(canEdit && due ? { due_date: due } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDue("");
      refresh();
      toast.success("Solicitação registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Suporte e solicitações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Converse com a RSM sobre sua conta. As solicitações e respostas ficam disponíveis aqui.
        </p>
      </div>
      <Card>
        <CardContent className="p-5">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex flex-wrap gap-3">
              <select
                aria-label="Tipo de solicitação"
                className={selectClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as ClientRequest["kind"])}
              >
                <option value="support">Dúvida / solicitação</option>
                <option value="extra">Serviço extra / orçamento</option>
                <option value="complaint">Reclamação</option>
                {canEdit && <option value="material">Solicitar material ao cliente</option>}
              </select>
              {canEdit && (
                <Input
                  aria-label="Prazo da solicitação"
                  className="w-auto"
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              )}
            </div>
            <Label htmlFor="request-title">Assunto</Label>
            <Input
              id="request-title"
              value={title}
              required
              minLength={2}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Label htmlFor="request-description">Mensagem</Label>
            <Textarea
              id="request-description"
              value={description}
              required
              minLength={2}
              maxLength={4000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Registrando…" : "Registrar solicitação"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <QueryState loading={q.isLoading} error={q.error} empty={!q.data?.length}>
        {q.data?.map((r) => (
          <RequestCard key={r.id} request={r} canEdit={canEdit} onSave={refresh} />
        ))}
      </QueryState>
    </div>
  );
}
function RequestCard({
  request: r,
  canEdit,
  onSave,
}: {
  request: ClientRequest;
  canEdit: boolean;
  onSave: () => void;
}) {
  const [response, setResponse] = useState(r.response),
    [status, setStatus] = useState(r.status);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("client_requests")
        .update({ response, status })
        .eq("id", r.id)
        .eq("updated_at", r.updated_at)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      onSave();
      toast.success("Resposta salva no painel do cliente");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap justify-between gap-2">
          <h3 className="font-medium">{r.title}</h3>
          <Badge variant="outline">{REQUEST_STATUS[r.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {dateLabel(r.created_at)}
          {r.due_date && ` · Prazo: ${dateLabel(r.due_date)}`}
        </p>
        <p className="whitespace-pre-wrap text-sm">{r.description}</p>
        {r.kind === "extra" && (
          <ExtraQuote key={r.id + String(r.updated_at)} request={r} canEdit={canEdit} />
        )}
        <RequestThread request={r} onSave={onSave} />
        {r.response && (
          <div className="rounded-lg bg-primary/5 p-4">
            <p className="mb-1 text-sm font-medium">Resposta da RSM</p>
            <p className="whitespace-pre-wrap text-sm">{r.response}</p>
          </div>
        )}
        {canEdit && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Responder / atualizar</summary>
            <div className="mt-3 space-y-3">
              <Textarea
                aria-label={"Resposta para " + r.title}
                value={response}
                maxLength={4000}
                onChange={(e) => setResponse(e.target.value)}
              />
              <select
                aria-label={"Status de " + r.title}
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientRequest["status"])}
              >
                {Object.entries(REQUEST_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <Button className="ml-3" disabled={save.isPending} onClick={() => save.mutate()}>
                Salvar resposta
              </Button>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function RequestThread({ request: r, onSave }: { request: ClientRequest; onSave: () => void }) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["request-messages", r.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_request_messages")
        .select("*")
        .eq("request_id", r.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("client_request_messages")
        .insert({ request_id: r.id, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["request-messages", r.id] });
      onSave();
      toast.success("Mensagem registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      {q.error && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as mensagens.
        </p>
      )}
      {q.data?.map((m) => (
        <div className="rounded-lg border p-3" key={m.id}>
          <p className="mb-1 text-sm text-muted-foreground">
            {m.created_by === user?.id ? "Você" : "Participante da conta"} ·{" "}
            {new Date(m.created_at).toLocaleString("pt-BR")}
          </p>
          <p className="whitespace-pre-wrap text-sm">{m.body}</p>
        </div>
      ))}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Textarea
          aria-label={"Mensagem sobre " + r.title}
          placeholder="Acrescentar mensagem…"
          rows={2}
          required
          minLength={2}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={send.isPending}>
          Registrar mensagem
        </Button>
      </form>
    </div>
  );
}

export function ClientRequestAttention({
  clientId,
  onOpen,
}: {
  clientId: string;
  onOpen: () => void;
}) {
  const q = useQuery({
    queryKey: ["client-requests", "attention", clientId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_requests")
        .select("id,title,due_date")
        .eq("client_id", clientId)
        .eq("status", "waiting_client");
      if (error) throw error;
      return data;
    },
  });
  if (!q.data?.length) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="font-medium">A RSM precisa da sua participação</h3>
        {q.data.map((r) => (
          <p key={r.id} className="text-sm">
            {r.title}
            {r.due_date && ` · Prazo: ${dateLabel(r.due_date)}`}
          </p>
        ))}
        <Button variant="outline" onClick={onOpen}>
          Ver solicitações e responder
        </Button>
      </CardContent>
    </Card>
  );
}
