import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Layers,
  CircleDollarSign,
  BarChart3,
  Star,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
  Megaphone,
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
import {
  areas,
  areaForPath,
  hrefFor,
  navForPath,
  navigation,
  portalNavigation,
  upgradeHref,
} from "@/lib/navigation";
import { QuickActions } from "./navigation/quick-actions";
import { AccountMenu } from "./topbar";
const AREA_ICONS: Record<string, typeof LayoutDashboard> = {
  inicio: LayoutDashboard,
  clientes: Users,
  conteudo: Layers,
  tarefas: CheckSquare,
  trafego: Megaphone,
  financeiro: CircleDollarSign,
  relatorios: BarChart3,
};
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
  const [all, setAll] = useState(false);
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
  const allowed = navigation.flatMap((n) => {
    const href = loading ? null : hrefFor(n, can);
    return href && (!n.admin || hasRole("administrator")) ? [{ ...n, href }] : [];
  });
  // As 7 áreas; cada uma aparece se a pessoa puder ver ao menos uma tela dela
  // e abre na primeira aba permitida.
  const areaItems = areas.flatMap((a) => {
    const first = allowed.find((n) => n.area === a.key && !n.hidden);
    return first ? [{ ...a, href: a.key === "tarefas" ? "/tarefas?de=minhas" : first.href }] : [];
  });
  const currentArea = areaForPath(location.pathname);
  const current = navForPath(location.pathname);
  const favorites = prefs.favorites
    .map((f) => ({ ...f, go: upgradeHref(f.href) }))
    .filter((f) => {
      const n = navForPath(f.go.split("?")[0]);
      return n && can(n.module) && (!n.admin || hasRole("administrator"));
    });
  const item = (n: { label: string; href: string; key?: string }) => {
    const Icon = (n.key && AREA_ICONS[n.key]) || FolderOpen;
    const count = n.key === "tarefas" ? counts.data?.tasks : undefined;
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
          isActive={n.key ? currentArea?.key === n.key : location.pathname === n.href.split("?")[0]}
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
                    n.key === "tarefas"
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
            onClick={() => go(staff ? "/inicio" : "/portal?tab=home")}
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
            {/* Favoritos: uma linha de atalhos acima das áreas. */}
            {!collapsed && (
              <div className="px-2 pt-1" aria-label="Favoritos">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    title={
                      prefs.favorites.some((f) => f.href === location.href)
                        ? "Remover esta tela dos favoritos"
                        : "Fixar esta tela nos favoritos"
                    }
                    aria-label={
                      prefs.favorites.some((f) => f.href === location.href)
                        ? "Remover esta tela dos favoritos"
                        : "Fixar esta tela nos favoritos"
                    }
                    aria-pressed={prefs.favorites.some((f) => f.href === location.href)}
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
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <Star
                      className={`size-3.5 ${prefs.favorites.some((f) => f.href === location.href) ? "fill-brand-accent text-brand-accent" : ""}`}
                    />
                  </button>
                  {prefs.error ? (
                    <button className="text-xs underline" onClick={() => void prefs.refetch()}>
                      Falha nos favoritos · tentar de novo
                    </button>
                  ) : favorites.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">Fixe telas na estrela</span>
                  ) : (
                    (all ? favorites : favorites.slice(0, 4)).map((f) => (
                      <span
                        key={f.href}
                        className="group inline-flex max-w-full items-center rounded-md border border-border/70 bg-background text-[11px]"
                      >
                        <button
                          type="button"
                          className="max-w-[8.5rem] truncate px-2 py-1 hover:text-brand"
                          title={f.label}
                          onClick={() => go(f.go)}
                        >
                          {f.label}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover ${f.label} dos favoritos`}
                          className="hidden rounded-r-md px-1 py-1 text-muted-foreground hover:text-foreground group-hover:inline-flex focus-visible:inline-flex"
                          onClick={() => prefs.toggle(f)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))
                  )}
                  {favorites.length > 4 && (
                    <button className="px-1 text-[11px] underline" onClick={() => setAll(!all)}>
                      {all ? "menos" : `+${favorites.length - 4}`}
                    </button>
                  )}
                </div>
              </div>
            )}
            <SidebarGroup className="pt-1">
              <SidebarMenu>{areaItems.map(item)}</SidebarMenu>
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
                          ["/portal", "/inicio", "/portal/calendar"].includes(location.pathname)
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
          </SidebarGroup>
        )}
        <div className="mt-auto border-t p-2">
          <AccountMenu compact={collapsed} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
