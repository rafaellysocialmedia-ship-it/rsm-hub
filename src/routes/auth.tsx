import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

/** Only same-origin relative paths are accepted as post-login redirects. */
export function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar · Social Media Hub" },
      { name: "description", content: "Acesse o Social Media Hub para gerenciar seus clientes." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { user, loading, hasRole } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");

  useEffect(() => {
    if (!loading && user) {
      const target = safeNext(next);
      if (target) {
        window.location.href = target;
        return;
      }
      const isStaff = hasRole("administrator") || hasRole("team");
      navigate({ to: isStaff ? "/dashboard" : "/portal" });
    }
  }, [user, loading, hasRole, navigate, next]);

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,theme(colors.white/15),transparent_60%)]" />
        <div className="relative flex items-center gap-2 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">Social Media Hub</span>
        </div>
        <div className="relative space-y-4 text-white">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Gestão premium para agências de social media.
          </h1>
          <p className="max-w-md text-sm text-white/80">
            Centralize clientes, equipe e operações em uma única plataforma — moderna, rápida e construída para escalar.
          </p>
        </div>
        <div className="relative text-xs text-white/60">© {new Date().getFullYear()} Social Media Hub</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight">Social Media Hub</span>
            </div>
          </div>

          {mode === "forgot" ? (
            <ForgotForm onBack={() => setMode("signin")} />
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-6">
                <SignInForm onForgot={() => setMode("forgot")} />
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <SignUpForm />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Não foi possível entrar com Google");
      setLoading(false);
    }
  };
  return (
    <Button type="button" variant="outline" className="w-full" onClick={handle} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M21.35 11.1h-9.17v2.97h5.27c-.23 1.48-1.7 4.34-5.27 4.34-3.17 0-5.76-2.62-5.76-5.85S9.01 6.7 12.18 6.7c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 4.16 14.66 3.3 12.18 3.3 7.36 3.3 3.5 7.16 3.5 12s3.86 8.7 8.68 8.7c5.01 0 8.32-3.52 8.32-8.48 0-.57-.06-1-.15-1.12z"
          />
        </svg>
      )}
      Continuar com Google
    </Button>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">Entre para continuar gerenciando seus clientes.</p>
      </div>
      <GoogleButton />
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <button type="button" onClick={onForgot} className="text-xs text-muted-foreground hover:text-foreground">
              Esqueceu?
            </button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
    </div>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu email para confirmar.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Criar nova conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">Comece a centralizar a operação da sua agência.</p>
      </div>
      <GoogleButton />
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar conta
        </Button>
      </form>
    </div>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link para o seu email.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Recuperar senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar link
        </Button>
        <button type="button" onClick={onBack} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
          Voltar ao login
        </button>
      </form>
    </div>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">ou</span>
      </div>
    </div>
  );
}
