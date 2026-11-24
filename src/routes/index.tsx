import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/** True when the URL carries the answer of an OAuth sign-in (Google). */
function hasAuthResponse() {
  if (typeof window === "undefined") return false;
  const { hash, search } = window.location;
  return /access_token=|refresh_token=|error_description=/.test(hash) || /[?&]code=/.test(search);
}

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // O login pelo Google volta para esta rota com a sessão na URL. É preciso
    // esperar o Supabase ler essa sessão antes de sair daqui; redirecionar na
    // hora descartava a URL e a pessoa caía de novo na tela de login.
    if (hasAuthResponse()) {
      try {
        await supabase.auth.getSession();
      } catch {
        /* Sem sessão: o destino abaixo leva para a tela de login. */
      }
    }
    throw redirect({ to: "/inicio" });
  },
  component: () => null,
});
