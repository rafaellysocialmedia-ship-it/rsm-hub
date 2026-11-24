import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { AppFrameSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Lê a sessão guardada no navegador (sem ir ao servidor a cada troca de tela).
  // A sessão é validada pelo AuthProvider e os dados continuam protegidos pelo RLS.
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) throw redirect({ to: "/auth", search: { next: location.href } });
    return { user };
  },
  // Enviado pelo servidor e mostrado enquanto a sessão e o código carregam.
  pendingComponent: AppFrameSkeleton,
  pendingMs: 0,
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
