import { PostWorkspaceProvider } from "./posts/post-workspace";
import { QuickActionsProvider } from "./navigation/quick-actions";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { navForPath, requiredModule } from "@/lib/navigation";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { AreaTabs } from "./navigation/area-tabs";
import { ViewAsBanner } from "./view-as";
export function AppShell({ children }: { children: ReactNode }) {
  const { hasRole, user } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const prefs = useNavigationPreferences();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (prefs.data) setOpen(prefs.data.sidebar_open);
  }, [prefs.data?.sidebar_open]);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  const permissions = usePermissions();
  const dest = navForPath(path);
  // O cliente só vê o portal (e o link de aprovação que recebe); qualquer outra
  // tela leva de volta ao portal em vez de mostrar erro ou página vazia.
  const cleanPath = path.replace(/\/$/, "") || "/";
  const clientArea = ["/portal", "/review"].some(
    (p) => cleanPath === p || cleanPath.startsWith(p + "/"),
  );
  const sendClientToPortal = !staff && !clientArea;
  const forbidden =
    staff &&
    ((dest?.admin && !hasRole("administrator")) ||
      (dest && !permissions.can(requiredModule(path, search) ?? dest.module)));
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
          <ViewAsBanner />
          <div className="rsm-app-dense flex min-h-screen w-full bg-background text-foreground">
            <AppSidebar />
            <SidebarInset className="flex min-w-0 flex-1 flex-col bg-transparent">
              <Topbar />
              {!permissions.loading && !forbidden && <AreaTabs />}
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
                ) : sendClientToPortal ? (
                  <Navigate to="/portal" replace />
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
