import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CheckCircle2,
  Users,
  Layers,
  CircleDollarSign,
  BarChart3,
  MoreHorizontal,
  Star,
  X,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
  BriefcaseBusiness,
  Grid2X2,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useNavigationPreferences, useNavigationCounts } from "@/hooks/use-navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAccount } from "@/hooks/use-account-workspace";
import { navigation, portalNavigation, activeNavigation, navForPath } from "@/lib/navigation";
import { QuickActions } from "./navigation/quick-actions";
import { AccountMenu } from "./topbar";
const icons = [
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CheckCircle2,
  Users,
  Layers,
  CircleDollarSign,
  BarChart3,
];
export function AppSidebar() {
  const { user, hasRole } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const { can, loading } = usePermissions();
  const location = useRouterState({ select: (s) => s.location });
  const router = useRouter();
  const { state, toggleSidebar, setOpenMobile, isMobile } = useSidebar();
  const prefs = useNavigationPreferences();
  const counts = useNavigationCounts();
  const account = usePortalAccount(!staff);
  const onboarding = useQuery({
    queryKey: ["experience", "onboarding", account.data?.id],
    enabled: !staff && !!account.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_onboarding_steps")
        .select("step_key,status,owner_scope")
        .eq("client_id", account.data!.id);
      if (error) throw error;
      return data;
    },
  });
  const pendingSteps =
    onboarding.data?.filter(
      (s) => s.owner_scope === "client" && !["done", "not_applicable"].includes(s.status),
    ) ?? [];
  const [more, setMore] = useState(false),
    [all, setAll] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const collapsed = state === "collapsed" && !isMobile;
  useEffect(() => {
    setOpenMobile(false);
  }, [location.href, setOpenMobile]);
  const go = (href: string) => {
    const u = new URL(href, "https://rsm.local");
    void router.navigate({
      to: u.pathname,
      search: Object.fromEntries(u.searchParams),
      hash: u.hash.slice(1),
    });
  };
  const allowed = navigation.filter(
    (n) => !loading && can(n.module) && (!n.admin || hasRole("administrator")),
  );
  // Keep every permitted destination in exactly one group; no routes are removed.
  const primaryOrder = [
    "Início",
    "Calendário",
    "Conteúdos",
    "Clientes",
    "Minhas tarefas",
    "Aprovações",
    "Resultados",
  ];
  const primaryItems = primaryOrder.flatMap((label) => allowed.filter((n) => n.label === label));
  const managementItems = allowed.filter(
    (n) =>
      !n.admin &&
      (n.href.startsWith("/finance") ||
        n.href.startsWith("/traffic") ||
        n.href === "/commercial" ||
        n.href === "/retention"),
  );
  const administrationItems = allowed.filter((n) => n.admin);
  const toolsItems = allowed.filter(
    (n) => !primaryItems.includes(n) && !managementItems.includes(n) && !n.admin,
  );
  const sections = [
    {
      key: "finance",
      label: "Financeiro",
      icon: CircleDollarSign,
      items: managementItems.filter((n) => n.href.startsWith("/finance")),
    },
    {
      key: "traffic",
      label: "Tráfego",
      icon: BarChart3,
      items: managementItems.filter((n) => n.href.startsWith("/traffic")),
    },
    {
      key: "management",
      label: "Comercial e retenção",
      icon: BriefcaseBusiness,
      items: managementItems.filter(
        (n) => !n.href.startsWith("/finance") && !n.href.startsWith("/traffic"),
      ),
    },
    { key: "tools", label: "Ferramentas", icon: Grid2X2, items: toolsItems },
    { key: "admin", label: "Administração", icon: ShieldCheck, items: administrationItems },
  ];
  const sectionIsActive = (items: typeof navigation) =>
    items.some((n) =>
      activeNavigation(n.href, location.pathname, location.search as Record<string, unknown>),
    );
  const current = navForPath(location.pathname);
  const favorites = prefs.favorites.filter((f) => {
    const n = navForPath(f.href.split("?")[0]);
    return n && can(n.module) && (!n.admin || hasRole("administrator"));
  });
  const item = (n: (typeof navigation)[number]) => {
    const idx = navigation.indexOf(n),
      Icon = icons[idx] ?? FolderOpen;
    const count =
      n.label === "Minhas tarefas"
        ? counts.data?.tasks
        : n.label === "Aprovações" && !staff
          ? counts.data?.approvals
          : undefined;
    return (
      <SidebarMenuItem key={n.href}>
        <SidebarMenuButton
          className="min-h-10 rounded-lg text-sm text-sidebar-foreground/80"
          tooltip={
            n.label +
            (count === null
              ? " · Falha ao carregar pendências"
              : count
                ? ` · ${count} pendências`
                : "")
          }
          isActive={activeNavigation(
            n.href,
            location.pathname,
            location.search as Record<string, unknown>,
          )}
          onClick={() => go(n.href)}
        >
          <Icon />
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            {n.label}
            {count === null ? (
              <span aria-label="Falha ao carregar pendências">!</span>
            ) : (
              !!count && (
                <span
                  className="rounded bg-primary/10 px-1.5 text-xs"
                  title={
                    n.label === "Minhas tarefas"
                      ? "Tarefas vencidas atribuídas a você"
                      : "Itens aguardando decisão"
                  }
                >
                  {count}
                </span>
              )
            )}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };
  return (
    <Sidebar collapsible="icon" className="border-r bg-background">
      <SidebarHeader>
        <div
          className={`flex min-h-14 items-center gap-1 ${collapsed ? "flex-col justify-center" : "justify-between"}`}
        >
          <button
            type="button"
            onClick={() => go(staff ? "/dashboard" : "/portal?tab=home")}
            aria-label="Ir ao início do RSM Marketing"
            title="RSM Marketing"
            className={`flex min-w-0 items-center justify-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${collapsed ? "w-full" : "flex-1"}`}
          >
            <img
              src="/rsm-symbol.png"
              alt="RSM — Estratégia e Performance"
              width={128}
              height={74}
              className={
                collapsed
                  ? "h-7 w-12 object-contain dark:brightness-0 dark:invert"
                  : "h-14 w-full max-w-[142px] object-contain dark:brightness-0 dark:invert"
              }
            />
          </button>
          <SidebarMenuButton
            className="size-10 shrink-0"
            tooltip={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={isMobile ? "Fechar menu" : collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => (isMobile ? setOpenMobile(false) : toggleSidebar())}
          >
            {isMobile ? <X /> : collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </SidebarMenuButton>
        </div>
        {!staff && !collapsed && (
          <p className="truncate px-2 text-sm font-medium">
            {account.isLoading
              ? "Carregando conta…"
              : account.error
                ? "Não foi possível carregar a conta"
                : (account.data?.name ?? "Portal do cliente")}
          </p>
        )}
        <QuickActions />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        {staff ? (
          <>
            <SidebarGroup className="pb-1">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                Principal
              </SidebarGroupLabel>
              <SidebarMenu>{primaryItems.map(item)}</SidebarMenu>
            </SidebarGroup>
            <SidebarGroup className="pt-1">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                Outras áreas
              </SidebarGroupLabel>
              <SidebarMenu>
                {sections
                  .filter(({ items }) => items.length > 0)
                  .map(({ key, label, icon: Icon, items }) => {
                    const open =
                      expandedSection === key ||
                      (expandedSection === null && sectionIsActive(items));
                    return (
                      <SidebarMenuItem key={key}>
                        <SidebarMenuButton
                          tooltip={label}
                          className="min-h-10 rounded-lg"
                          isActive={sectionIsActive(items)}
                          aria-expanded={open}
                          onClick={() => {
                            if (collapsed) toggleSidebar();
                            setExpandedSection(open ? "none" : key);
                          }}
                        >
                          <Icon />
                          <span className="flex-1 text-sm">{label}</span>
                          {!collapsed && (
                            <ChevronDown
                              className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          )}
                        </SidebarMenuButton>
                        {open && !collapsed && (
                          <SidebarMenu className="w-auto min-w-0 border-l border-border/60 pl-2">
                            {items.map(item)}
                          </SidebarMenu>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup className="pt-1">
              <SidebarMenuButton
                tooltip="Favoritos e atalhos"
                className="min-h-10 rounded-lg"
                aria-expanded={favoritesOpen}
                onClick={() => {
                  if (collapsed) toggleSidebar();
                  setFavoritesOpen((value) => !value);
                }}
              >
                <Star />
                <span className="flex-1 text-sm">Favoritos</span>
                {!collapsed && (
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform ${favoritesOpen ? "rotate-180" : ""}`}
                  />
                )}
              </SidebarMenuButton>
              {favoritesOpen && !collapsed && (
                <div className="pt-1">
                  <SidebarMenuButton
                    tooltip="Fixar ou remover esta visualização"
                    disabled={
                      !current || prefs.isLoading || !!prefs.error || prefs.update.isPending
                    }
                    onClick={() =>
                      current &&
                      prefs.toggle({
                        href: location.href,
                        label: current.label,
                        module: current.module,
                      })
                    }
                  >
                    <Star />
                    <span>
                      {prefs.favorites.some((f) => f.href === location.href)
                        ? "Remover favorito"
                        : "Fixar esta visualização"}
                    </span>
                  </SidebarMenuButton>
                  {prefs.error ? (
                    <p role="alert" className="p-2 text-xs">
                      Falha nos favoritos.{" "}
                      <button onClick={() => void prefs.refetch()}>Tentar novamente</button>
                    </p>
                  ) : (
                    <SidebarMenu>
                      {(all ? favorites : favorites.slice(0, 5)).map((f) => (
                        <SidebarMenuItem key={f.href} className="flex items-center">
                          <SidebarMenuButton tooltip={f.label} onClick={() => go(f.href)}>
                            <Star />
                            <span>{f.label}</span>
                          </SidebarMenuButton>
                          {!collapsed && (
                            <button
                              aria-label={`Remover ${f.label} dos favoritos`}
                              className="rounded p-2 focus-visible:ring-2"
                              onClick={() => prefs.toggle(f)}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  )}
                  {favorites.length > 5 && !collapsed && (
                    <button
                      className="p-2 text-left text-xs underline"
                      onClick={() => setAll(!all)}
                    >
                      {all ? "Ver menos" : "Ver todos"}
                    </button>
                  )}
                </div>
              )}
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Acompanhamento</SidebarGroupLabel>
            <SidebarMenu>
              {portalNavigation
                .filter(
                  ([, tab]) =>
                    (tab !== "finance" || account.data?.can_view_finance) &&
                    (tab !== "contents" || can("social.calendar")) &&
                    (tab !== "reports" || can("social.analytics")),
                )
                .map(([label, tab], i) => {
                  const selected = String(
                    (location.pathname === "/portal/calendar"
                      ? "calendar"
                      : (location.search as Record<string, unknown>).tab) ?? "home",
                  );
                  const active =
                    tab === "contents"
                      ? ["contents", "approvals", "calendar", "feed"].includes(selected) ||
                        location.pathname === "/portal/calendar"
                      : tab === "files"
                        ? ["files", "contract"].includes(selected)
                        : tab === "home"
                          ? ["home", "meetings", "onboarding"].includes(selected)
                          : selected === tab;
                  const Icon = [
                    LayoutDashboard,
                    Layers,
                    CheckSquare,
                    BarChart3,
                    FolderOpen,
                    CircleDollarSign,
                  ][i];
                  return (
                    <SidebarMenuItem key={tab}>
                      <SidebarMenuButton
                        tooltip={label}
                        isActive={
                          active &&
                          ["/portal", "/dashboard", "/portal/calendar"].includes(location.pathname)
                        }
                        onClick={() =>
                          go(
                            "/portal?tab=" +
                              (tab === "contents" && counts.data?.approvals ? "approvals" : tab),
                          )
                        }
                      >
                        <Icon />
                        <span>
                          {label}
                          {tab === "contents" &&
                            (counts.data?.approvals === null
                              ? " · erro"
                              : counts.data?.approvals
                                ? ` · ${counts.data.approvals} para revisar`
                                : "")}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
            <SidebarMenuButton
              tooltip="Solicitar conteúdo"
              onClick={() => go("/portal?tab=support&request=content")}
            >
              <CheckSquare />
              <span>Solicitar conteúdo</span>
            </SidebarMenuButton>
            {pendingSteps.length > 0 && (
              <SidebarMenuButton
                tooltip="Concluir cadastro"
                onClick={() => go("/portal?tab=onboarding")}
              >
                <CheckSquare />
                <span>Concluir cadastro · {pendingSteps.length} pendentes</span>
              </SidebarMenuButton>
            )}
            <SidebarMenuButton
              tooltip="Outros recursos"
              isActive={!["/portal", "/dashboard", "/portal/calendar"].includes(location.pathname)}
              aria-expanded={more}
              onClick={() => {
                if (collapsed) toggleSidebar();
                setMore(!more);
              }}
            >
              <MoreHorizontal />
              <span>Mais</span>
            </SidebarMenuButton>
            {more && !collapsed && (
              <SidebarMenu>
                {allowed
                  .filter((n) =>
                    ["/courses", "/marketplace", "/meetings", "/library", "/analytics"].includes(
                      n.href,
                    ),
                  )
                  .map(item)}
              </SidebarMenu>
            )}
          </SidebarGroup>
        )}
        <div className="mt-auto border-t p-2">
          {can("management.settings") && (
            <SidebarMenuButton
              tooltip="Configurações"
              isActive={location.pathname === "/settings"}
              onClick={() => go("/settings")}
            >
              <Settings />
              <span>Configurações</span>
            </SidebarMenuButton>
          )}
          <AccountMenu compact={collapsed} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
