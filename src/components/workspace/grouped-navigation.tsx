import { TabsList, TabsTrigger } from "@/components/ui/tabs";
type Group = { title: string; items: [string, string][] };
export const profileGroups: Group[] = [
  {
    title: "Visão geral",
    items: [
      ["overview", "Resumo"],
      ["retention", "Saúde da conta"],
      ["support", "Solicitações"],
      ["onboarding", "Entrada do cliente"],
      ["history", "Linha do tempo"],
    ],
  },
  {
    title: "Conteúdos",
    items: [
      ["contents", "Produção"],
      ["calendar", "Calendário"],
      ["approvals", "Aprovações"],
      ["feed", "Prévia do feed"],
      ["demands", "Tarefas"],
    ],
  },
  {
    title: "Marca",
    items: [
      ["strategy", "Estratégia e briefing"],
      ["documents", "Identidade e arquivos"],
      ["settings", "Dados, acessos e equipe"],
    ],
  },
  { title: "Reuniões", items: [["meetings", "Reuniões"]] },
  { title: "Resultados", items: [["reports", "Relatórios"]] },
  {
    title: "Financeiro",
    items: [
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
        <nav aria-label="Áreas da conta" className="rsm-tabs w-full rounded-lg bg-card p-1">
          {groups.map((g) => (
            <button
              key={g.title}
              type="button"
              aria-current={g === active ? "page" : undefined}
              onClick={() => onTab(g.items[0][0])}
              className={`min-h-11 rounded-md px-4 text-sm font-medium ${g === active ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"}`}
            >
              {g.title}
            </button>
          ))}
        </nav>
      )}
      {active.items.length > 1 && (
        <TabsList className="rsm-subnav h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {active.items.map(([value, label]) => (
            <TabsTrigger className="min-h-10 whitespace-normal" key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
    </div>
  );
}
