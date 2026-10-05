export type NavItem = {
  label: string;
  href: string;
  module: string;
  group: "Rotina" | "Operação" | "Gestão" | "Mais";
  admin?: boolean;
};
export const navigation: NavItem[] = [
  { label: "Início", href: "/dashboard", module: "workspace.dashboard", group: "Rotina" },
  {
    label: "Minhas tarefas",
    href: "/tasks?scope=mine",
    module: "workspace.tasks",
    group: "Rotina",
  },
  { label: "Calendário", href: "/posts?view=calendar", module: "social.calendar", group: "Rotina" },
  { label: "Aprovações", href: "/portal", module: "social.approvals", group: "Rotina" },
  {
    label: "Clientes",
    href: "/management/clients",
    module: "workspace.clients",
    group: "Operação",
  },
  { label: "Conteúdos", href: "/posts?view=kanban", module: "social.calendar", group: "Operação" },
  { label: "Financeiro", href: "/finance", module: "finance.dashboard", group: "Gestão" },
  { label: "Resultados", href: "/analytics", module: "social.analytics", group: "Gestão" },
  { label: "Todas as tarefas", href: "/tasks?scope=all", module: "workspace.tasks", group: "Mais" },
  { label: "Reuniões", href: "/meetings", module: "workspace.meetings", group: "Mais" },
  { label: "Comercial", href: "/commercial", module: "finance.dashboard", group: "Mais" },
  { label: "Retenção", href: "/retention", module: "workspace.clients", group: "Mais" },
  { label: "Biblioteca", href: "/library", module: "workspace.library", group: "Mais" },
  { label: "Briefings", href: "/library/briefings", module: "social.briefings", group: "Mais" },
  {
    label: "Modelos de briefing",
    href: "/briefings/template",
    module: "social.briefings",
    group: "Mais",
  },
  { label: "Acessos", href: "/vault", module: "workspace.vault", group: "Mais" },
  { label: "Assistente de IA", href: "/ai", module: "social.ai", group: "Mais" },
  { label: "Ferramentas de IA", href: "/ai/tools", module: "social.ai", group: "Mais" },
  { label: "Tráfego pago", href: "/traffic", module: "traffic.dashboard", group: "Mais" },
  {
    label: "Campanhas de tráfego",
    href: "/traffic/campaigns",
    module: "traffic.dashboard",
    group: "Mais",
  },
  { label: "CRM de tráfego", href: "/traffic/crm", module: "traffic.crm", group: "Mais" },
  {
    label: "Métricas de tráfego",
    href: "/traffic/analytics",
    module: "traffic.analytics",
    group: "Mais",
  },
  {
    label: "Landing pages",
    href: "/traffic/landing-pages",
    module: "traffic.dashboard",
    group: "Mais",
  },
  {
    label: "Contas a receber",
    href: "/finance/receivables",
    module: "finance.receivables",
    group: "Mais",
  },
  {
    label: "Carteira financeira",
    href: "/finance/clients",
    module: "finance.clients",
    group: "Mais",
  },
  {
    label: "Contratos financeiros",
    href: "/finance/contracts",
    module: "finance.contracts",
    group: "Mais",
  },
  {
    label: "Formas de pagamento",
    href: "/finance/payment-methods",
    module: "finance.payment_methods",
    group: "Mais",
  },
  {
    label: "Configuração financeira",
    href: "/finance/settings",
    module: "finance.settings",
    group: "Mais",
  },
  { label: "Cursos", href: "/courses", module: "academy.courses", group: "Mais" },
  { label: "Marketplace", href: "/marketplace", module: "marketplace.services", group: "Mais" },
  { label: "Equipe", href: "/team", module: "management.team", group: "Mais", admin: true },
  {
    label: "Permissões",
    href: "/admin/permissions",
    module: "management.permissions",
    group: "Mais",
    admin: true,
  },
  {
    label: "Gerenciar cursos",
    href: "/admin/courses",
    module: "management.courses",
    group: "Mais",
    admin: true,
  },
  {
    label: "Gerenciar visualizações",
    href: "/admin/visibility",
    module: "management.permissions",
    group: "Mais",
    admin: true,
  },
  {
    label: "Controle de posts",
    href: "/admin/posts-control",
    module: "management.permissions",
    group: "Mais",
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
export function activeNavigation(href: string, path: string, search: Record<string, unknown>) {
  if (path === "/clients" || path.startsWith("/clients/"))
    path = path.replace("/clients", "/management/clients");
  if ((path === "/briefings" || path.startsWith("/briefings/")) && path !== "/briefings/template")
    path = "/library/briefings";
  const u = new URL(href, "https://rsm.local");
  const p = path.replace(/\/$/, "") || "/";
  if (u.pathname === "/posts")
    return (
      p === "/posts" &&
      (u.searchParams.get("view") === "calendar"
        ? (search.view ?? "calendar") === "calendar"
        : search.view != null && search.view !== "calendar")
    );
  if (u.pathname === "/tasks")
    return p === "/tasks" && (search.scope ?? "all") === u.searchParams.get("scope");
  if (u.pathname === "/finance") return p === "/finance";
  if (u.pathname === "/traffic") return p === "/traffic";
  if (u.pathname === "/ai") return p === "/ai" || (p.startsWith("/ai/") && p !== "/ai/tools");
  if (u.pathname === "/library") return p === "/library";
  return p === u.pathname || p.startsWith(u.pathname + "/");
}
export function navForPath(path: string) {
  if (path === "/clients" || path.startsWith("/clients/"))
    path = path.replace("/clients", "/management/clients");
  if (path === "/briefings" || (path.startsWith("/briefings/") && path !== "/briefings/template"))
    path = "/library/briefings";
  return [
    ...navigation,
    {
      label: "Configurações",
      href: "/settings",
      module: "management.settings",
      group: "Mais" as const,
    },
  ]
    .filter(
      (n) =>
        path.replace(/\/$/, "") === n.href.split("?")[0] ||
        path.startsWith(n.href.split("?")[0] + "/"),
    )
    .sort((a, b) => b.href.split("?")[0].length - a.href.split("?")[0].length)[0];
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
