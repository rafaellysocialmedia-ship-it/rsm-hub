import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Settings,
  Sparkles,
  Shield,
  FolderOpen,
  KeyRound,
  KanbanSquare,
  CheckCircle2,
  CircleDollarSign,
  Bot,
  Video,
  BarChart3,
  ClipboardList,
  GraduationCap,
  Megaphone,
  Users2,
  LineChart,
  Store,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  /** module key from the dynamic permission catalog (app_modules) */
  module?: string;
};

type NavGroup = { label: string; items: NavItem[] };

const staffGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "workspace.dashboard" },
      { title: "Clientes", url: "/clients", icon: Briefcase, module: "workspace.clients" },
      { title: "Tarefas", url: "/tasks", icon: KanbanSquare, module: "workspace.tasks" },
      { title: "Reuniões", url: "/meetings", icon: Video, module: "workspace.meetings" },
      { title: "Biblioteca", url: "/library", icon: FolderOpen, module: "workspace.library" },
      { title: "Acessos", url: "/vault", icon: KeyRound, module: "workspace.vault" },
    ],
  },
  {
    label: "Social Media",
    items: [
      { title: "Calendário", url: "/posts", icon: Calendar, module: "social.calendar" },
      { title: "Aprovações", url: "/portal", icon: CheckCircle2, module: "social.approvals" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, module: "social.analytics" },
      { title: "Briefings", url: "/briefings", icon: ClipboardList, module: "social.briefings" },
      { title: "IA", url: "/ai", icon: Bot, module: "social.ai" },
    ],
  },
  {
    label: "Tráfego Pago",
    items: [
      { title: "Dashboard", url: "/traffic", icon: Megaphone, module: "traffic.dashboard" },
      { title: "CRM", url: "/traffic/crm", icon: Users2, module: "traffic.crm" },
      { title: "Analytics", url: "/traffic/analytics", icon: LineChart, module: "traffic.analytics" },
    ],
  },
  {
    label: "Academy",
    items: [{ title: "Cursos", url: "/courses", icon: GraduationCap, module: "academy.courses" }],
  },
  {
    label: "Marketplace",
    items: [{ title: "Serviços", url: "/marketplace", icon: Store, module: "marketplace.services" }],
  },
  {
    label: "Financeiro",
    items: [{ title: "Financeiro", url: "/finance", icon: CircleDollarSign, module: "finance.dashboard" }],
  },
];

const clientGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "workspace.dashboard" },
      { title: "Biblioteca", url: "/library", icon: FolderOpen, module: "workspace.library" },
    ],
  },
  {
    label: "Social Media",
    items: [
      { title: "Calendário", url: "/portal/calendar", icon: Calendar, module: "social.calendar" },
      { title: "Aprovações", url: "/portal", icon: CheckCircle2, module: "social.approvals" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, module: "social.analytics" },
    ],
  },
  {
    label: "Academy",
    items: [{ title: "Cursos", url: "/courses", icon: GraduationCap, module: "academy.courses" }],
  },
  {
    label: "Marketplace",
    items: [{ title: "Serviços", url: "/marketplace", icon: Store, module: "marketplace.services" }],
  },
];

const adminItems: NavItem[] = [
  { title: "Equipe", url: "/team", icon: Users, module: "management.team" },
  { title: "Permissões", url: "/admin/permissions", icon: Shield, module: "management.permissions" },
  { title: "Gerenciar Cursos", url: "/admin/courses", icon: GraduationCap, module: "management.courses" },
  { title: "Configurações", url: "/settings", icon: Settings, module: "management.settings" },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { hasRole, loading: authLoading } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const loading = authLoading || permsLoading;
  const isStaff = hasRole("administrator") || hasRole("team");

  const visibleItems = (items: NavItem[]) =>
    items.filter((item) => !item.module || can(item.module, "view"));

  const isActive = (path: string) =>
    path === "/dashboard" ? currentPath === path : currentPath.startsWith(path);

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={!item.soon && isActive(item.url)}
        tooltip={item.soon ? `${item.title} (em breve)` : item.title}
      >
        <Link to={item.url} className="flex items-center gap-2">
          <item.icon className="h-4 w-4" />
          <span className="flex-1 truncate">{item.title}</span>
          {item.soon && !collapsed && (
            <Badge
              variant="outline"
              className="ml-auto h-4 border-dashed px-1 text-[9px] font-normal text-muted-foreground"
            >
              em breve
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderLoadingItem = () => (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="Carregando permissões" disabled>
        <div className="h-4 w-4 shrink-0 animate-pulse rounded-sm bg-sidebar-foreground/20" />
        {!collapsed && <span className="h-3 w-32 animate-pulse rounded bg-sidebar-foreground/15" />}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-brand">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">Social Media Hub</span>
              <span className="text-[10px] text-muted-foreground">Workspace</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {loading ? (
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderLoadingItem()}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          (isStaff ? staffGroups : clientGroups)
            .map((group) => ({ ...group, items: visibleItems(group.items) }))
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
        )}



        {!loading && hasRole("administrator") && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleItems(adminItems).map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
