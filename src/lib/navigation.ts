/**
 * Mapa de navegação do RSM Hub.
 *
 * O menu tem 7 áreas fixas; cada área tem abas com endereço próprio.
 * Configurações fica no menu da conta (avatar). As permissões são as mesmas
 * de antes: cada aba usa o módulo que a tela já usava.
 */
export type AreaKey =
  | "inicio"
  | "clientes"
  | "conteudo"
  | "tarefas"
  | "trafego"
  | "financeiro"
  | "relatorios"
  | "configuracoes";

export type NavItem = {
  /** Nome da aba (igual ao título da tela). */
  label: string;
  /** Endereço da aba (pode ter ?parâmetros). */
  href: string;
  module: string;
  area: AreaKey;
  admin?: boolean;
  /** Tela da área que não aparece como aba (ex.: detalhe, IA, reuniões). */
  hidden?: boolean;
};

export type Area = { key: AreaKey; label: string; base: string };

export const areas: Area[] = [
  { key: "inicio", label: "Início", base: "/inicio" },
  { key: "clientes", label: "Clientes", base: "/clientes" },
  { key: "conteudo", label: "Conteúdo", base: "/conteudo" },
  { key: "tarefas", label: "Tarefas", base: "/tarefas" },
  { key: "trafego", label: "Tráfego", base: "/trafego" },
  { key: "financeiro", label: "Financeiro", base: "/financeiro" },
  { key: "relatorios", label: "Relatórios", base: "/relatorios" },
];
export const settingsArea: Area = {
  key: "configuracoes",
  label: "Configurações",
  base: "/configuracoes",
};

export const navigation: NavItem[] = [
  // Início
  { label: "Início", href: "/inicio", module: "workspace.dashboard", area: "inicio" },
  {
    label: "Reuniões",
    href: "/inicio/reunioes",
    module: "workspace.meetings",
    area: "inicio",
    hidden: true,
  },
  // Clientes
  { label: "Clientes", href: "/clientes", module: "workspace.clients", area: "clientes" },
  {
    label: "Comercial",
    href: "/clientes/comercial",
    module: "finance.dashboard",
    area: "clientes",
  },
  {
    label: "Retenção",
    href: "/clientes/retencao",
    module: "workspace.clients",
    area: "clientes",
  },
  {
    label: "Briefing",
    href: "/clientes/briefing",
    module: "social.briefings",
    area: "clientes",
    hidden: true,
  },
  // Conteúdo
  {
    label: "Calendário",
    href: "/conteudo/calendario",
    module: "social.calendar",
    area: "conteudo",
  },
  { label: "Quadro", href: "/conteudo/quadro", module: "social.calendar", area: "conteudo" },
  {
    label: "Aprovações",
    href: "/conteudo/aprovacoes",
    module: "social.approvals",
    area: "conteudo",
  },
  {
    label: "Biblioteca",
    href: "/conteudo/biblioteca",
    module: "workspace.library",
    area: "conteudo",
  },
  {
    label: "Controle de posts",
    href: "/conteudo/controle-de-posts",
    module: "management.permissions",
    area: "conteudo",
    admin: true,
  },
  {
    label: "Assistente de IA",
    href: "/conteudo/ia",
    module: "social.ai",
    area: "conteudo",
    hidden: true,
  },
  // Tarefas
  { label: "Tarefas", href: "/tarefas", module: "workspace.tasks", area: "tarefas" },
  // Tráfego
  { label: "Visão geral", href: "/trafego", module: "traffic.dashboard", area: "trafego" },
  {
    label: "Campanhas",
    href: "/trafego/campanhas",
    module: "traffic.dashboard",
    area: "trafego",
  },
  { label: "CRM", href: "/trafego/crm", module: "traffic.crm", area: "trafego" },
  {
    label: "Landing pages",
    href: "/trafego/landing-pages",
    module: "traffic.dashboard",
    area: "trafego",
  },
  { label: "Métricas", href: "/trafego/metricas", module: "traffic.analytics", area: "trafego" },
  // Financeiro
  { label: "Painel", href: "/financeiro", module: "finance.dashboard", area: "financeiro" },
  {
    label: "Receber",
    href: "/financeiro/receber",
    module: "finance.receivables",
    area: "financeiro",
  },
  {
    label: "Contratos",
    href: "/financeiro/contratos",
    module: "finance.contracts",
    area: "financeiro",
  },
  // Relatórios
  { label: "Resultados", href: "/relatorios", module: "social.analytics", area: "relatorios" },
  {
    label: "Relatório mensal",
    href: "/relatorios/mensal",
    module: "social.analytics",
    area: "relatorios",
  },
  // Configurações (menu da conta)
  {
    label: "Perfil",
    href: "/configuracoes/perfil",
    module: "management.settings",
    area: "configuracoes",
  },
  {
    label: "Equipe",
    href: "/configuracoes/equipe",
    module: "management.team",
    area: "configuracoes",
    admin: true,
  },
  {
    label: "Permissões",
    href: "/configuracoes/permissoes",
    module: "management.permissions",
    area: "configuracoes",
    admin: true,
  },
  {
    label: "Gerenciar visualizações",
    href: "/configuracoes/visualizacoes",
    module: "management.permissions",
    area: "configuracoes",
    admin: true,
  },
  {
    label: "Formas de pagamento",
    href: "/configuracoes/formas-de-pagamento",
    module: "finance.payment_methods",
    area: "configuracoes",
  },
  {
    label: "Configuração financeira",
    href: "/configuracoes/financeiro",
    module: "finance.settings",
    area: "configuracoes",
  },
  {
    label: "Acessos da agência",
    href: "/configuracoes/acessos",
    module: "workspace.vault",
    area: "configuracoes",
  },
  {
    label: "Cursos",
    href: "/configuracoes/cursos",
    module: "academy.courses",
    area: "configuracoes",
  },
  {
    label: "Gerenciar cursos",
    href: "/configuracoes/cursos/gerenciar",
    module: "management.courses",
    area: "configuracoes",
    admin: true,
  },
  {
    label: "Marketplace",
    href: "/configuracoes/marketplace",
    module: "marketplace.services",
    area: "configuracoes",
  },
  {
    label: "Ver como cliente ou equipe",
    href: "/configuracoes/ver-como",
    module: "management.permissions",
    area: "configuracoes",
    admin: true,
  },
];

export const portalNavigation = [
  ["Início", "home"],
  ["Conteúdos", "contents"],
  ["Solicitações", "support"],
  ["Resultados", "reports"],
  ["Documentos", "files"],
  ["Financeiro", "finance"],
] as const;

const pathOf = (href: string) => href.split("?")[0];
const clean = (path: string) => path.replace(/\/$/, "") || "/";

export function areaForPath(path: string): Area | undefined {
  const p = clean(path);
  return [...areas, settingsArea].find((a) => p === a.base || p.startsWith(a.base + "/"));
}

/** Abas visíveis de uma área (sem as telas escondidas). */
export function tabsOf(area: AreaKey) {
  return navigation.filter((n) => n.area === area && !n.hidden);
}

/** A aba é a tela atual? (endereço exato, sem contar parâmetros). */
export function isTabActive(href: string, path: string) {
  return clean(path) === pathOf(href);
}

/** Item de navegação dono de um endereço (o de prefixo mais longo). */
export function navForPath(path: string): NavItem | undefined {
  const p = clean(path);
  return navigation
    .filter((n) => p === pathOf(n.href) || p.startsWith(pathOf(n.href) + "/"))
    .sort((a, b) => pathOf(b.href).length - pathOf(a.href).length)[0];
}

/* ------------------------------------------------------------------ */
/* Endereços antigos → novos (links salvos, favoritos e notificações). */
/* ------------------------------------------------------------------ */

type Search = Record<string, unknown>;
const STATIC: Record<string, string> = {
  "/dashboard": "/inicio",
  "/meetings": "/inicio/reunioes",
  "/management/clients": "/clientes",
  "/clients": "/clientes",
  "/commercial": "/clientes/comercial",
  "/retention": "/clientes/retencao",
  "/briefings/template": "/clientes/briefing/modelo",
  "/vault": "/configuracoes/acessos",
  "/library": "/conteudo/biblioteca",
  "/admin/posts-control": "/conteudo/controle-de-posts",
  "/ai": "/conteudo/ia",
  "/ai/tools": "/conteudo/ia/ferramentas",
  "/traffic": "/trafego",
  "/traffic/campaigns": "/trafego/campanhas",
  "/traffic/crm": "/trafego/crm",
  "/traffic/landing-pages": "/trafego/landing-pages",
  "/traffic/analytics": "/trafego/metricas",
  "/finance": "/financeiro",
  "/finance/receivables": "/financeiro/receber",
  "/finance/contracts": "/financeiro/contratos",
  "/finance/payment-methods": "/configuracoes/formas-de-pagamento",
  "/finance/settings": "/configuracoes/financeiro",
  "/analytics": "/relatorios",
  "/settings": "/configuracoes/perfil",
  "/configuracoes": "/configuracoes/perfil",
  "/team": "/configuracoes/equipe",
  "/admin/permissions": "/configuracoes/permissoes",
  "/admin/visibility": "/configuracoes/visualizacoes",
  "/admin/courses": "/configuracoes/cursos/gerenciar",
  "/courses": "/configuracoes/cursos",
  "/marketplace": "/configuracoes/marketplace",
};

function withSearch(path: string, search: Search) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Endereço novo para um endereço antigo, mantendo os parâmetros
 * (?open=, ?comment=, ?tab=, ?mes=…). Devolve null se não for um endereço antigo.
 */
export function legacyTarget(pathname: string, search: Search = {}): string | null {
  const p = clean(pathname);
  const s: Search = { ...search };
  let m: RegExpMatchArray | null;

  if (p === "/posts") {
    const view = String(s.view ?? "");
    if (view === "kanban" || view === "table") return withSearch("/conteudo/quadro", s);
    if (!["calendar", "list", "timeline"].includes(view)) delete s.view;
    return withSearch("/conteudo/calendario", s);
  }
  if (p === "/tasks") {
    const de = s.scope === "mine" ? "minhas" : "equipe";
    delete s.scope;
    return withSearch("/tarefas", { de, ...s });
  }
  if (p === "/finance/clients") return withSearch("/financeiro/receber", { ...s, visao: "por-cliente" });
  if (p === "/briefings" || p === "/library/briefings") {
    const client = typeof s.client === "string" ? s.client : undefined;
    return client ? withSearch(`/clientes/${client}`, { tab: "strategy" }) : "/clientes";
  }
  if ((m = p.match(/^\/(?:management\/clients|clients)\/([^/]+)$/)))
    return withSearch(`/clientes/${m[1]}`, s);
  if (STATIC[p]) return withSearch(STATIC[p], s);
  if ((m = p.match(/^\/briefings\/([^/]+)$/))) return withSearch(`/clientes/briefing/${m[1]}`, s);
  if ((m = p.match(/^\/traffic\/campaigns\/([^/]+)$/)))
    return withSearch(`/trafego/campanhas/${m[1]}`, s);
  if ((m = p.match(/^\/ai\/([^/]+)$/)) && m[1] !== "tools")
    return withSearch(`/conteudo/ia/${m[1]}`, s);
  if ((m = p.match(/^\/courses\/([^/]+)$/))) return withSearch(`/configuracoes/cursos/${m[1]}`, s);
  // Rotas de despesas/fornecedores que só existem no cadastro de módulos.
  if (p.startsWith("/finance/")) return withSearch("/financeiro", s);
  return null;
}

/** Converte um link salvo (favorito) para o endereço novo, se for antigo. */
export function upgradeHref(href: string): string {
  const u = new URL(href, "https://rsm.local");
  const target = legacyTarget(u.pathname, Object.fromEntries(u.searchParams));
  return target ? target + u.hash : href;
}

export function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')
  );
}
export function isSafeFavorite(href: string) {
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.includes("\\") &&
    !/[\r\n]/.test(href) &&
    !href.startsWith("/review/")
  );
}
export type Favorite = { href: string; label: string; module: string; clientId?: string };
