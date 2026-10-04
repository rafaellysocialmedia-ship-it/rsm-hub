import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const {hasRole}=useAuth();
  const isStaff=hasRole("administrator")||hasRole("team");
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {isStaff && <AppSidebar />}
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-w-0 flex-1">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
