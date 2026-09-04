import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "administrator" | "team" | "client";

export type Profile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  cargo: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  error: string | null;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const handleConnectionError = (cause: unknown) => {
      console.error("Erro ao conectar com a autenticação", cause);
      if (!active) return;
      setProfile(null);
      setRoles([]);
      setError(
        "Não foi possível conectar ao banco de dados. Tente novamente em alguns instantes.",
      );
      setLoading(false);
    };

    const hydrateSession = async (sess: Session | null) => {
      if (!active) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      setError(null);

      if (!sess?.user) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await loadUserData(sess.user.id);
      } catch (cause) {
        handleConnectionError(cause);
      } finally {
        if (active) setLoading(false);
      }
    };

    let unsubscribe = () => {};

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
        setTimeout(() => void hydrateSession(sess), 0);
      });
      unsubscribe = () => sub.subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data, error: sessionError }) => {
          if (sessionError) throw sessionError;
          return hydrateSession(data.session);
        })
        .catch(handleConnectionError);
    } catch (cause) {
      handleConnectionError(cause);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function loadUserData(userId: string) {
    const [{ data: prof, error: profileError }, { data: rs, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileError) console.error("Erro ao carregar perfil", profileError);
    if (rolesError) console.error("Erro ao carregar permissões", rolesError);

    setProfile(prof as Profile | null);
    setRoles(rolesError ? [] : (rs ?? []).map((r) => r.role as AppRole));
  }

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setProfile(null);
      setRoles([]);
      setSession(null);
      setUser(null);
    } catch (cause) {
      handleSignOutError(cause);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutError = (cause: unknown) => {
    console.error("Erro ao sair", cause);
    setError("Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.");
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, error, hasRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
