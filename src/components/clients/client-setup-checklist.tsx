import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Circle, ClipboardCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/clients";
import { Button } from "@/components/ui/button";

type Item = {
  key: string;
  label: string;
  /** Why the team needs it — shown while the item is pending. */
  why: string;
  done: boolean;
  /** Where it is filled: the edit dialog or a section of Cadastro. */
  target: "edit" | "info" | "services" | "accounts";
};

const TARGET_LABEL: Record<Item["target"], string> = {
  edit: "Preencher",
  info: "Abrir Informações",
  services: "Abrir Serviços",
  accounts: "Abrir Acessos",
};

/** What is still missing in a client's registration, in plain language. */
export function useClientSetup(client: Client) {
  const extra = client as Client & {
    account_manager_id?: string | null;
    default_payment_method_id?: string | null;
  };
  const query = useQuery({
    queryKey: ["client-setup", client.id],
    queryFn: async () => {
      const [services, accounts] = await Promise.all([
        supabase
          .from("client_services")
          .select("service_key,situation,amount,billing_day")
          .eq("client_id", client.id),
        supabase
          .from("client_accounts")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id),
      ]);
      if (services.error) throw services.error;
      if (accounts.error) throw accounts.error;
      return { services: services.data ?? [], accounts: accounts.count ?? 0 };
    },
  });
  const current = (query.data?.services ?? []).filter((s) => s.situation !== "cancelled");
  const active = current.filter((s) => s.situation === "active");
  const hasSocial = current.some((s) => s.service_key === "social_media");

  const items: Item[] = [
    {
      key: "contact",
      label: "Contato do cliente",
      why: "Nome de quem responde pelo cliente e um WhatsApp ou email.",
      done: !!client.responsible && !!(client.whatsapp || client.email || client.phone),
      target: "edit",
    },
    {
      key: "plan",
      label: "Plano e segmento",
      why: "Qual plano foi vendido e a área de atuação do cliente.",
      done: !!client.plan && !!client.segment,
      target: "edit",
    },
    {
      key: "start",
      label: "Data de início",
      why: "Marca o começo do atendimento e do saldo de publicações.",
      done: !!client.start_date,
      target: "edit",
    },
    {
      key: "services",
      label: "Serviços contratados",
      why: "Cadastre cada serviço que o cliente contratou.",
      done: current.length > 0,
      target: "services",
    },
    {
      key: "billing",
      label: "Valor e vencimento dos serviços",
      why: "Cada serviço ativo precisa de valor e dia de vencimento para gerar a mensalidade certa.",
      done: active.length > 0 && active.every((s) => Number(s.amount) > 0 && !!s.billing_day),
      target: "services",
    },
    ...(hasSocial || (client.monthly_post_quota ?? 0) > 0
      ? [
          {
            key: "quota",
            label: "Publicações por mês",
            why: "Quantidade do plano; o calendário usa para avisar quando faltar ou passar.",
            done: (client.monthly_post_quota ?? 0) > 0,
            target: "edit" as const,
          },
        ]
      : []),
    {
      key: "payment",
      label: "Forma de pagamento padrão",
      why: "Vai preenchida nas mensalidades automáticas.",
      done: !!extra.default_payment_method_id,
      target: "edit",
    },
    {
      key: "owner",
      label: "Responsável interno",
      why: "Quem da equipe cuida desta conta.",
      done: !!extra.account_manager_id,
      target: "info",
    },
    {
      key: "accounts",
      label: "Acessos e redes sociais",
      why: "Instagram e demais acessos necessários para trabalhar a conta.",
      done: (query.data?.accounts ?? 0) > 0,
      target: "accounts",
    },
    {
      key: "portal",
      label: "Login do cliente no portal",
      why: "Permite que o cliente aprove as publicações pelo portal.",
      done: !!client.user_id,
      target: "edit",
    },
  ];
  const pending = items.filter((item) => !item.done);
  return { items, pending, isLoading: query.isLoading, error: query.error };
}

/**
 * Checklist of the client's registration. `compact` renders a single line for
 * the overview; the full version lists every pending item and where to fill it.
 */
export function ClientSetupChecklist({
  client,
  compact = false,
  onEdit,
  onSection,
  onOpen,
}: {
  client: Client;
  compact?: boolean;
  /** Opens the edit dialog. */
  onEdit: () => void;
  /** Opens a section of the Cadastro tab. */
  onSection: (section: "info" | "services" | "accounts") => void;
  /** Compact mode: opens the full checklist. */
  onOpen?: () => void;
}) {
  const setup = useClientSetup(client);
  if (setup.isLoading || setup.error || client.churned) return null;
  const total = setup.items.length;
  const done = total - setup.pending.length;

  if (compact) {
    if (!setup.pending.length) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-4 py-2.5 text-sm">
        <ClipboardCheck className="size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <strong className="font-semibold">
            Cadastro incompleto: {setup.pending.length}{" "}
            {setup.pending.length === 1 ? "item pendente" : "itens pendentes"}.
          </strong>{" "}
          <span className="text-muted-foreground">
            {setup.pending
              .slice(0, 3)
              .map((item) => item.label)
              .join(" · ")}
            {setup.pending.length > 3 ? " · …" : ""}
          </span>
        </span>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-background text-xs" onClick={onOpen}>
          Ver o que falta <ArrowUpRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  const act = (item: Item) => (item.target === "edit" ? onEdit() : onSection(item.target));
  return (
    <section
      aria-label="Checklist do cadastro"
      className="mb-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <ClipboardCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            Checklist do cadastro · {done} de {total}
          </h3>
          <p className="text-xs text-muted-foreground">
            {setup.pending.length
              ? "O que ainda falta preencher e onde. Cada botão leva direto ao lugar certo."
              : "Cadastro completo. Nada pendente."}
          </p>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted sm:w-40"
          role="progressbar"
          aria-label="Cadastro preenchido"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      </div>
      {setup.pending.length > 0 && (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {setup.pending.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-border/70 p-2.5"
            >
              <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.why}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 text-xs"
                onClick={() => act(item)}
              >
                {TARGET_LABEL[item.target]}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {done > 0 && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Ver {done} {done === 1 ? "item concluído" : "itens concluídos"}
          </summary>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {setup.items
              .filter((item) => item.done)
              .map((item) => (
                <li key={item.key} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                  {item.label}
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
