import { ListSkeleton } from "@/components/skeletons";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, Search, UserRound, Users2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startViewAs } from "@/lib/view-as.functions";
import { enterViewAs, leaveViewAs, readViewAs } from "@/lib/view-as";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Faixa fixa no topo enquanto o administrador vê o app como outra pessoa. */
export function ViewAsBanner() {
  const [state] = useState(() => (typeof window === "undefined" ? null : readViewAs()));
  const [leaving, setLeaving] = useState(false);
  if (!state) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-500/50 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <Eye className="size-4 shrink-0" aria-hidden />
      <span>
        Você está vendo o RSM como <strong>{state.targetName}</strong> (
        {state.targetRole === "client" ? "cliente" : "equipe"}). O que fizer aqui fica registrado
        como essa pessoa.
      </span>
      <Button
        size="sm"
        className="h-7 bg-amber-900 text-xs text-white hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          void leaveViewAs();
        }}
      >
        {leaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
        Voltar para minha conta ({state.adminName})
      </Button>
    </div>
  );
}

/** Inicia o Ver como para um cliente (pelo id do cliente) ou um membro da equipe. */
export function useStartViewAs() {
  const { profile, user } = useAuth();
  const start = useServerFn(startViewAs);
  const [pending, setPending] = useState<string | null>(null);
  const run = async (target: { clientId?: string; userId?: string; key: string }) => {
    setPending(target.key);
    try {
      const result = await start({ data: { clientId: target.clientId, userId: target.userId } });
      await enterViewAs({
        tokenHash: result.tokenHash,
        targetName: result.name,
        targetRole: result.role as "client" | "team",
        adminName: profile?.name?.split(" ")[0] || user?.email || "administrador",
      });
    } catch (error) {
      toast.error((error as Error).message);
      setPending(null);
    }
  };
  return { run, pending };
}

type Target = {
  key: string;
  label: string;
  hint: string;
  clientId?: string;
  userId?: string;
  disabled?: string;
};

/** Escolha de quem visualizar: clientes com login e pessoas da equipe. */
export function ViewAsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { run, pending } = useStartViewAs();
  const [search, setSearch] = useState("");
  const targets = useQuery({
    queryKey: ["view-as-targets"],
    enabled: open,
    queryFn: async () => {
      const [clients, roles] = await Promise.all([
        supabase.from("clients").select("id,name,user_id,status,churned").order("name"),
        supabase.from("user_roles").select("user_id,role").eq("role", "team"),
      ]);
      if (clients.error) throw clients.error;
      if (roles.error) throw roles.error;
      const teamIds = [...new Set((roles.data ?? []).map((r) => r.user_id))].filter((id) => id !== user?.id);
      const profiles = teamIds.length
        ? await supabase.from("profiles").select("id,name,email,cargo").in("id", teamIds)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const clientTargets: Target[] = (clients.data ?? []).map((c) => ({
        key: `c:${c.id}`,
        label: c.name,
        hint: c.churned ? "Conta encerrada" : c.status === "active" ? "Cliente" : "Cliente inativo",
        clientId: c.id,
        disabled: c.user_id ? undefined : "Sem login vinculado",
      }));
      const teamTargets: Target[] = (profiles.data ?? []).map((p) => ({
        key: `u:${p.id}`,
        label: p.name || p.email || "Membro da equipe",
        hint: p.cargo || "Equipe",
        userId: p.id,
      }));
      return { clientTargets, teamTargets };
    },
  });
  const q = search.trim().toLowerCase();
  const filter = (list: Target[] = []) => list.filter((t) => !q || t.label.toLowerCase().includes(q));
  const clients = useMemo(() => filter(targets.data?.clientTargets), [targets.data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const team = useMemo(() => filter(targets.data?.teamTargets), [targets.data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (title: string, icon: typeof UserRound, items: Target[]) => {
    const Icon = icon;
    return (
      <section className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" aria-hidden /> {title}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém encontrado.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  disabled={!!t.disabled || !!pending}
                  onClick={() => void run(t)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.disabled ?? t.hint}</span>
                  </span>
                  {pending === t.key ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-label="Entrando" />
                  ) : (
                    !t.disabled && <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ver como</DialogTitle>
          <DialogDescription>
            Entre na conta de um cliente ou de alguém da equipe para ver o app exatamente como essa
            pessoa vê. Uma faixa no topo mostra que você está no modo Ver como e leva de volta para a
            sua conta. Tudo o que você fizer fica registrado como essa pessoa.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar pelo nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {targets.isLoading ? (
          <ListSkeleton rows={4} />
        ) : targets.error ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar a lista.
          </p>
        ) : (
          <div className="space-y-4">
            {list("Clientes", UserRound, clients)}
            {list("Equipe", Users2, team)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
