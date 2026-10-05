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
import { NotificationsMenu } from "./notifications-menu";
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
          className="min-h-11"
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
          <span className="flex flex-1 items-center justify-between gap-2">
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
    <Sidebar collapsible="icon" className="border-r bg-white">
      <SidebarHeader>
        <div className="flex min-h-12 items-center justify-between gap-1">
          {!collapsed && (
            <button
              onClick={() => go(staff ? "/dashboard" : "/portal?tab=home")}
              className="px-2 text-left font-bold tracking-tight text-[#42145d]"
            >
              RSM <span className="text-xs font-normal">Marketing</span>
            </button>
          )}
          <SidebarMenuButton
            className="w-11 shrink-0"
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
      <SidebarContent>
        {staff ? (
          <>
            {(["Rotina", "Operação", "Gestão"] as const).map((group) => (
              <SidebarGroup key={group}>
                <SidebarGroupLabel>{group}</SidebarGroupLabel>
                <SidebarMenu>{allowed.filter((n) => n.group === group).map(item)}</SidebarMenu>
              </SidebarGroup>
            ))}
            <SidebarGroup>
              <SidebarMenuButton
                tooltip="Mais módulos"
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
                <SidebarMenu>{allowed.filter((n) => n.group === "Mais").map(item)}</SidebarMenu>
              )}
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Favoritos</SidebarGroupLabel>
              <SidebarMenuButton
                tooltip="Fixar ou remover esta visualização"
                disabled={!current || prefs.isLoading || !!prefs.error || prefs.update.isPending}
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
                <button className="p-2 text-left text-xs underline" onClick={() => setAll(!all)}>
                  {all ? "Ver menos" : "Ver todos"}
                </button>
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
                    (location.search as Record<string, unknown>).tab ?? "home",
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
                        isActive={active}
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
          <div className="flex items-center gap-1">
            <NotificationsMenu />
            {!collapsed && <span className="text-sm">Notificações</span>}
          </div>
          {can("management.settings") && (
            <SidebarMenuButton tooltip="Configurações" onClick={() => go("/settings")}>
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
