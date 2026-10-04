import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useOnboarding } from "@/hooks/use-client-experience";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { QueryState } from "./account-panels";
import { MaterialUpload } from "./material-upload";
import { toast } from "sonner";
const steps = [
  {
    key: "account",
    label: "Dados da conta",
    fields: [
      ["responsible", "Pessoa de contato"],
      ["email", "E-mail de contato"],
      ["phone", "Telefone"],
    ],
  },
  {
    key: "briefing",
    label: "Briefing",
    fields: [
      ["goals", "Objetivos do serviço"],
      ["audience", "Público e prioridades"],
      ["references", "Referências e concorrentes"],
    ],
  },
  {
    key: "identity",
    label: "Identidade e materiais",
    fields: [
      ["voice", "Tom de voz"],
      ["guidelines", "Cores, orientações e restrições"],
    ],
  },
  {
    key: "access",
    label: "Acessos e conexões",
    fields: [
      ["networks", "Redes e links dos perfis"],
      ["access_status", "Permissões concedidas e conexões pendentes"],
    ],
  },
  {
    key: "approvers",
    label: "Aprovadores",
    fields: [
      ["name", "Nome do aprovador indicado"],
      ["email", "E-mail do aprovador"],
      ["process", "Prazo e orientações de aprovação"],
    ],
  },
  {
    key: "kickoff",
    label: "Reunião inicial",
    fields: [
      ["availability", "Disponibilidade de dias e horários"],
      ["agenda", "Pontos para alinhar na reunião"],
    ],
  },
];
export function AccountIntake({ clientId, staff = false }: { clientId: string; staff?: boolean }) {
  const q = useOnboarding(clientId);
  const qc = useQueryClient();
  const [index, setIndex] = useState(0),
    [fields, setFields] = useState<Record<string, string>>({}),
    [dirty, setDirty] = useState(false);
  const step = steps[index];
  useEffect(() => {
    if (!dirty) setFields(q.data?.find((s) => s.step_key === step.key)?.responses ?? {});
  }, [q.data, step.key, dirty]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_account_intake", {
        _client_id: clientId,
        _step: step.key,
        _responses: fields,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["experience", "onboarding", clientId] });
      void qc.invalidateQueries({ queryKey: ["clients", clientId] });
      toast.success("Respostas salvas. Você pode continuar depois.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const answered = steps.filter((s) =>
    Object.values(q.data?.find((x) => x.step_key === s.key)?.responses ?? {}).some(Boolean),
  ).length;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <header>
        <h2 className="text-lg font-semibold">
          {staff ? "Informações enviadas pelo cliente" : "Vamos preparar sua conta"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {answered} de 6 etapas com informações salvas. A equipe confirma a conclusão no
          acompanhamento abaixo.
        </p>
        <progress
          aria-label="Etapas com respostas"
          className="mt-3 h-2 w-full accent-primary"
          value={answered}
          max={6}
        />
      </header>
      <nav aria-label="Etapas de entrada" className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <Button
            key={s.key}
            size="sm"
            variant={i === index ? "default" : "outline"}
            disabled={dirty || save.isPending}
            onClick={() => setIndex(i)}
          >
            {i + 1}. {s.label}
          </Button>
        ))}
      </nav>
      <QueryState loading={q.isLoading} error={q.error}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h3 className="font-medium">{step.label}</h3>
          {step.key === "access" && (
            <p className="text-sm text-muted-foreground">
              Não informe senhas. Compartilhe apenas perfis e o estado das permissões. Conexões
              oficiais dependem da disponibilidade de cada provedor e são configuradas pela equipe.
            </p>
          )}
          {step.key === "approvers" && (
            <p className="text-sm text-muted-foreground">
              A indicação não concede acesso automaticamente. A equipe deve vincular o usuário
              autorizado nas configurações da conta.
            </p>
          )}
          {step.fields.map(([key, label]) => (
            <label className="block text-sm font-medium" key={key}>
              {label}
              {["email", "phone", "responsible", "name"].includes(key) ? (
                <Input
                  className="mt-2"
                  type={key === "email" ? "email" : "text"}
                  maxLength={300}
                  value={fields[key] ?? ""}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, [key]: e.target.value }));
                    setDirty(true);
                  }}
                />
              ) : (
                <Textarea
                  className="mt-2"
                  maxLength={3000}
                  value={fields[key] ?? ""}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, [key]: e.target.value }));
                    setDirty(true);
                  }}
                />
              )}
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!dirty || save.isPending} type="submit">
              {save.isPending ? "Salvando…" : "Salvar e continuar depois"}
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => setDirty(false)}>
                Descartar alterações desta etapa
              </Button>
            )}
            {!dirty && index < 5 && (
              <Button type="button" variant="outline" onClick={() => setIndex((i) => i + 1)}>
                Próxima etapa
              </Button>
            )}
          </div>
        </form>
        {step.key === "identity" && !staff && (
          <div className="mt-5">
            <MaterialUpload clientId={clientId} />
          </div>
        )}
      </QueryState>
    </section>
  );
}
