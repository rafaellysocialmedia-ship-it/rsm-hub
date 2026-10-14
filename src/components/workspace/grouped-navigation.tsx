import { TabsList, TabsTrigger } from "@/components/ui/tabs";
type Group = { title: string; items: [string, string][] };
export const profileGroups: Group[] = [
  {
    title: "Resumo",
    items: [
      ["overview", "Visão geral"],
      ["onboarding", "Onboarding"],
    ],
  },
  {
    title: "Conteúdo",
    items: [
      ["contents", "Produção"],
      ["calendar", "Calendário"],
      ["approvals", "Aprovações"],
      ["feed", "Prévia do feed"],
      ["demands", "Tarefas"],
    ],
  },
  {
    title: "Relacionamento",
    items: [
      ["support", "Solicitações"],
      ["meetings", "Reuniões"],
      ["retention", "Saúde da conta"],
      ["history", "Histórico"],
    ],
  },
  { title: "Resultados", items: [["reports", "Relatórios"]] },
  {
    title: "Gestão",
    items: [
      ["strategy", "Estratégia e briefing"],
      ["documents", "Identidade e arquivos"],
      ["settings", "Dados, equipe e integrações"],
      ["finance", "Cobranças"],
      ["contract", "Contrato"],
    ],
  },
];
export const portalGroups: Group[] = [
  {
    title: "Início",
    items: [
      ["home", "Resumo"],
      ["onboarding", "Primeiros passos"],
      ["meetings", "Reuniões"],
    ],
  },
  { title: "Solicitações", items: [["support", "Solicitações"]] },
  {
    title: "Conteúdos",
    items: [
      ["contents", "Todos"],
      ["approvals", "Para aprovar"],
      ["calendar", "Calendário"],
      ["feed", "Prévia do feed"],
    ],
  },
  { title: "Resultados", items: [["reports", "Relatórios"]] },
  {
    title: "Documentos",
    items: [
      ["files", "Arquivos e materiais"],
      ["contract", "Contrato"],
    ],
  },
  { title: "Financeiro", items: [["finance", "Cobranças"]] },
];
export function GroupedNavigation({
  groups,
  hidePrimary = false,
  tab,
  onTab,
}: {
  groups: Group[];
  hidePrimary?: boolean;
  tab: string;
  onTab: (s: string) => void;
}) {
  const active = groups.find((g) => g.items.some((i) => i[0] === tab)) ?? groups[0];
  return (
    <div className="space-y-3 border-b pb-3">
      {!hidePrimary && (
        <nav aria-label="Áreas da conta" className="rsm-tabs flex w-full gap-1 overflow-x-auto rounded-lg bg-card p-1">
          {groups.map((g) => (
            <button
              key={g.title}
              type="button"
              aria-current={g === active ? "page" : undefined}
              onClick={() => onTab(g.items[0][0])}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-md px-3 text-sm font-medium ${g === active ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"}`}
            >
              {g.title}
            </button>
          ))}
        </nav>
      )}
      {active.items.length > 1 && (
        <TabsList className="rsm-subnav flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-transparent p-0">
          {active.items.map(([value, label]) => (
            <TabsTrigger className="min-h-9 shrink-0 whitespace-nowrap" key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
    </div>
  );
}
