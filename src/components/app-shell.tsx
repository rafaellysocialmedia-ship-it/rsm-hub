import { PostWorkspaceProvider } from "./posts/post-workspace";
import { QuickActionsProvider } from "./navigation/quick-actions";
import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { navForPath } from "@/lib/navigation";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
export function AppShell({ children }: { children: ReactNode }) {
  const { hasRole, user } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const prefs = useNavigationPreferences();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (prefs.data) setOpen(prefs.data.sidebar_open);
  }, [prefs.data?.sidebar_open]);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const permissions = usePermissions();
  const dest = navForPath(path);
  const clientAllowed = [
    "/review",
    "/briefings",
    "/dashboard",
    "/portal",
    "/meetings",
    "/library",
    "/analytics",
    "/courses",
    "/marketplace",
    "/settings",
  ];
  const forbidden =
    (!staff && !clientAllowed.some((p) => path === p || path.startsWith(p + "/"))) ||
    (dest?.admin && !hasRole("administrator")) ||
    (dest && !(path === "/portal" && !staff) && !permissions.can(dest.module));
  return (
    <SidebarProvider
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        prefs.update.mutate({ sidebar_open: value });
      }}
    >
      <PostWorkspaceProvider key={user?.id}>
        <QuickActionsProvider>
          <div className="rsm-app-dense flex min-h-screen w-full bg-background text-foreground">
            <AppSidebar />
            <SidebarInset className="flex min-w-0 flex-1 flex-col bg-transparent">
              <Topbar />
              <main className="min-w-0 flex-1">
                {permissions.loading ? (
                  <div
                    role="status"
                    aria-label="Carregando área de trabalho"
                    className="space-y-4 p-6"
                  >
                    <div className="h-8 w-56 animate-pulse rounded bg-muted" />
                    <div className="h-12 animate-pulse rounded bg-muted" />
                    <div className="h-64 animate-pulse rounded bg-muted/50" />
                    <span className="sr-only">Verificando acesso…</span>
                  </div>
                ) : permissions.error ? (
                  <p role="alert" className="p-8">
                    Não foi possível verificar seu acesso. Atualize a página para tentar novamente.
                  </p>
                ) : forbidden ? (
                  <p role="alert" className="p-8">
                    Seu perfil não tem acesso a esta área.
                  </p>
                ) : (
                  children
                )}
              </main>
            </SidebarInset>
          </div>
        </QuickActionsProvider>
      </PostWorkspaceProvider>
    </SidebarProvider>
  );
}
