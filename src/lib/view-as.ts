import { supabase } from "@/integrations/supabase/client";

/** Sessão do administrador guardada enquanto ele vê o app como outra pessoa. */
export type ViewAsState = {
  adminAccessToken: string;
  adminRefreshToken: string;
  adminName: string;
  targetName: string;
  targetRole: "client" | "team";
  returnPath: string;
  startedAt: string;
};

const KEY = "rsm-view-as";

export function readViewAs(): ViewAsState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ViewAsState) : null;
  } catch {
    return null;
  }
}

/** Troca a sessão atual pela da pessoa escolhida, guardando a do administrador. */
export async function enterViewAs(args: {
  tokenHash: string;
  targetName: string;
  targetRole: "client" | "team";
  adminName: string;
}) {
  const { data } = await supabase.auth.getSession();
  const admin = data.session;
  if (!admin) throw new Error("Sua sessão expirou. Entre de novo.");
  const state: ViewAsState = {
    adminAccessToken: admin.access_token,
    adminRefreshToken: admin.refresh_token,
    adminName: args.adminName,
    targetName: args.targetName,
    targetRole: args.targetRole,
    returnPath: window.location.pathname + window.location.search,
    startedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(state));
  const { error } = await supabase.auth.verifyOtp({ token_hash: args.tokenHash, type: "magiclink" });
  if (error) {
    localStorage.removeItem(KEY);
    await supabase.auth.setSession({
      access_token: admin.access_token,
      refresh_token: admin.refresh_token,
    });
    throw new Error("Não foi possível entrar na conta escolhida. Tente de novo.");
  }
  window.location.href = args.targetRole === "client" ? "/portal" : "/inicio";
}

/** Encerra a sessão da outra pessoa e volta para a conta do administrador. */
export async function leaveViewAs() {
  const state = readViewAs();
  // Encerra só a sessão aberta para a visualização (a da pessoa continua válida
  // nos aparelhos dela).
  await supabase.auth.signOut({ scope: "local" });
  localStorage.removeItem(KEY);
  if (!state) {
    window.location.href = "/auth";
    return;
  }
  const { error } = await supabase.auth.setSession({
    access_token: state.adminAccessToken,
    refresh_token: state.adminRefreshToken,
  });
  window.location.href = error ? "/auth" : state.returnPath || "/inicio";
}
