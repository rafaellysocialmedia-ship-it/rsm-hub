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

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

const staffMain: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Briefcase },
  { title: "Calendário", url: "/posts", icon: Calendar },
  { title: "Tarefas", url: "/tasks", icon: KanbanSquare },
  { title: "Aprovações", url: "/portal", icon: CheckCircle2 },
  { title: "Reuniões", url: "/meetings", icon: Video },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const staffWorkspace: NavItem[] = [
  { title: "Biblioteca", url: "/library", icon: FolderOpen },
  { title: "Acessos", url: "/vault", icon: KeyRound },
  { title: "IA", url: "/ai", icon: Bot },
  { title: "Financeiro", url: "/finance", icon: CircleDollarSign },
];

const clientItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Calendário", url: "/portal/calendar", icon: Calendar },
  { title: "Aprovações", url: "/portal", icon: CheckCircle2 },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Biblioteca", url: "/library", icon: FolderOpen },
];

const adminItems: NavItem[] = [
  { title: "Equipe", url: "/team", icon: Users },
  { title: "Permissões", url: "/admin/permissions", icon: Shield },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { hasRole, loading } = useAuth();
  const isStaff = hasRole("administrator") || hasRole("team");

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
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? renderLoadingItem() : (isStaff ? staffMain : clientItems).map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!loading && isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{staffWorkspace.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!loading && isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Próximos módulos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{staffSoon.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!loading && hasRole("administrator") && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{adminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
