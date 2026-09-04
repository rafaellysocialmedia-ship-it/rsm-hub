import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  GraduationCap,
  KanbanSquare,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Receipt,
  Settings,
  Settings2,
  Shield,
  Sparkles,
  Store,
  Users,
  Users2,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  soon?: boolean;
  /** Module key from the dynamic permission catalog (app_modules). */
  module?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

const staffGroups: NavGroup[] = [
  {
    label: "Principal",
    defaultOpen: true,
    items: [
      {
        title: "Início",
        url: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        module: "workspace.dashboard",
      },
      { title: "Clientes", url: "/clients", icon: Briefcase, module: "workspace.clients" },
      { title: "Calendário", url: "/posts", icon: Calendar, module: "social.calendar" },
      { title: "Tarefas", url: "/tasks", icon: KanbanSquare, module: "workspace.tasks" },
      {
        title: "Aprovações",
        url: "/portal",
        icon: CheckCircle2,
        exact: true,
        module: "social.approvals",
      },
    ],
  },
  {
    label: "Conteúdo e equipe",
    items: [
      { title: "Reuniões", url: "/meetings", icon: Video, module: "workspace.meetings" },
      { title: "Briefings", url: "/briefings", icon: ClipboardList, module: "social.briefings" },
      { title: "Biblioteca", url: "/library", icon: FolderOpen, module: "workspace.library" },
      { title: "Acessos", url: "/vault", icon: KeyRound, module: "workspace.vault" },
      { title: "Assistente de IA", url: "/ai", icon: Bot, module: "social.ai" },
      { title: "Resultados", url: "/analytics", icon: BarChart3, module: "social.analytics" },
    ],
  },
  {
    label: "Tráfego pago",
    items: [
      {
        title: "Visão geral",
        url: "/traffic",
        icon: Megaphone,
        exact: true,
        module: "traffic.dashboard",
      },
      { title: "CRM", url: "/traffic/crm", icon: Users2, module: "traffic.crm" },
      { title: "Métricas", url: "/traffic/analytics", icon: LineChart, module: "traffic.analytics" },
    ],
  },
  {
    label: "Gestão financeira",
    items: [
      {
        title: "Cadastro mestre",
        url: "/management/clients",
        icon: Building2,
        module: "management.clients",
      },
      {
        title: "Visão geral",
        url: "/finance",
        icon: CircleDollarSign,
        exact: true,
        module: "finance.dashboard",
      },
      {
        title: "Contas a receber",
        url: "/finance/receivables",
        icon: Receipt,
        module: "finance.receivables",
      },
      {
        title: "Contratos",
        url: "/finance/contracts",
        icon: FileText,
        module: "finance.contracts",
      },
      {
        title: "Carteira financeira",
        url: "/finance/clients",
        icon: Building2,
        module: "finance.clients",
      },
      {
        title: "Formas de pagamento",
        url: "/finance/payment-methods",
        icon: CreditCard,
        module: "finance.payment_methods",
      },
      {
        title: "Configurações",
        url: "/finance/settings",
        icon: Settings2,
        module: "finance.settings",
      },
    ],
  },
  {
    label: "Recursos",
    items: [
      { title: "Cursos", url: "/courses", icon: GraduationCap, module: "academy.courses" },
      { title: "Marketplace", url: "/marketplace", icon: Store, module: "marketplace.services" },
    ],
  },
];

const clientGroups: NavGroup[] = [
  {
    label: "Principal",
    defaultOpen: true,
    items: [
      {
        title: "Início",
        url: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        module: "workspace.dashboard",
      },
      {
        title: "Calendário",
        url: "/portal/calendar",
        icon: Calendar,
        module: "social.calendar",
      },
      {
        title: "Aprovações",
        url: "/portal",
        icon: CheckCircle2,
        exact: true,
        module: "social.approvals",
      },
    ],
  },
  {
    label: "Recursos",
    items: [
      { title: "Biblioteca", url: "/library", icon: FolderOpen, module: "workspace.library" },
      { title: "Resultados", url: "/analytics", icon: BarChart3, module: "social.analytics" },
      { title: "Cursos", url: "/courses", icon: GraduationCap, module: "academy.courses" },
      { title: "Marketplace", url: "/marketplace", icon: Store, module: "marketplace.services" },
    ],
  },
];

const adminItems: NavItem[] = [
  { title: "Equipe", url: "/team", icon: Users, module: "management.team" },
  {
    title: "Permissões",
    url: "/admin/permissions",
    icon: Shield,
    module: "management.permissions",
  },
  {
    title: "Gerenciar cursos",
    url: "/admin/courses",
    icon: GraduationCap,
    module: "management.courses",
  },
  { title: "Configurações", url: "/settings", icon: Settings, module: "management.settings" },
];

function isItemActive(item: NavItem, currentPath: string) {
  if (item.exact) return currentPath === item.url;
  return currentPath === item.url || currentPath.startsWith(`${item.url}/`);
}

function NavigationGroup({
  group,
  currentPath,
  collapsed,
  renderItem,
}: {
  group: NavGroup;
  currentPath: string;
  collapsed: boolean;
  renderItem: (item: NavItem) => React.ReactNode;
}) {
  const containsActiveItem = group.items.some((item) => isItemActive(item, currentPath));

  return (
    <Collapsible
      defaultOpen={group.defaultOpen || containsActiveItem}
      className="group/navigation"
    >
      <SidebarGroup className="py-1">
        {!collapsed && (
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="w-full cursor-pointer select-none data-[state=open]:[&>svg]:rotate-90">
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronRight className="transition-transform duration-200" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
        )}
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const { hasRole, loading: authLoading } = useAuth();
  const { can, loading: permissionsLoading } = usePermissions();
  const loading = authLoading || permissionsLoading;
  const isStaff = hasRole("administrator") || hasRole("team");

  const visibleItems = (items: NavItem[]) =>
    items.filter((item) => !item.module || can(item.module, "view"));

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={`${item.url}:${item.title}`}>
      <SidebarMenuButton
        asChild
        isActive={!item.soon && isItemActive(item, currentPath)}
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

  const groups = (isStaff ? staffGroups : clientGroups)
    .map((group) => ({ ...group, items: visibleItems(group.items) }))
    .filter((group) => group.items.length > 0);

  if (!loading && hasRole("administrator")) {
    const visibleAdminItems = visibleItems(adminItems);
    if (visibleAdminItems.length > 0) {
      groups.push({ label: "Administração", items: visibleAdminItems });
    }
  }

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
              <span className="text-[10px] text-muted-foreground">Sua operação em um só lugar</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {loading ? (
          <SidebarGroup>
            <SidebarGroupLabel>Carregando</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Carregando permissões" disabled>
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded-sm bg-sidebar-foreground/20" />
                    {!collapsed && (
                      <span className="h-3 w-32 animate-pulse rounded bg-sidebar-foreground/15" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          groups.map((group) => (
            <NavigationGroup
              key={group.label}
              group={group}
              currentPath={currentPath}
              collapsed={collapsed}
              renderItem={renderItem}
            />
          ))
        )}
      </SidebarContent>
    </Sidebar>
  );
}
