import { BarChart3, ClipboardList, FileText, HeartHandshake, Layers3, Settings2, type LucideIcon } from "lucide-react";
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
  const groupIcons: Record<string, LucideIcon> = {
    "Resumo": ClipboardList,
    "Início": ClipboardList,
    "Conteúdo": Layers3,
    "Conteúdos": Layers3,
    "Relacionamento": HeartHandshake,
    "Solicitações": HeartHandshake,
    "Resultados": BarChart3,
    "Gestão": Settings2,
    "Documentos": FileText,
    "Financeiro": FileText,
  };
  return (
    <div className="space-y-2.5 border-b border-border/60 pb-3">
      {!hidePrimary && (
        <nav aria-label="Áreas da conta" className="rsm-tabs flex w-full gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-1.5">
          {groups.map((group) => {
            const Icon = groupIcons[group.title] ?? FileText;
            const selected = group === active;
            return (
              <button
                key={group.title}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => onTab(group.items[0][0])}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected
                  ? "border-border/70 bg-card text-primary shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-card/75 hover:text-foreground"}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {group.title}
              </button>
            );
          })}
        </nav>
      )}
      {active.items.length > 1 && (
        <TabsList className="rsm-subnav flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-transparent p-0">
          {active.items.map(([value, label]) => (
            <TabsTrigger
              className="min-h-9 shrink-0 whitespace-nowrap rounded-md border border-transparent px-3 text-xs data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              key={value}
              value={value}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
    </div>
  );
}
