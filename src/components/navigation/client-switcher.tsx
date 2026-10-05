import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { profileGroups } from "@/components/workspace/grouped-navigation";
export function ClientSwitcher({ id, name, tab }: { id: string; name: string; tab: string }) {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const prefs = useNavigationPreferences();
  const q = useQuery({
    queryKey: ["navigation-client-switcher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,status,churned")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const href = `/management/clients/${id}?tab=${encodeURIComponent(tab)}`;
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-muted-foreground">
        Clientes / {name} /{" "}
        {profileGroups.find((g) => g.items.some((i) => i[0] === tab))?.title ?? "Visão geral"}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Pesquisar cliente para trocar de conta"
          placeholder="Buscar cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 rounded-md border bg-white px-3 text-sm"
        />
        <select
          aria-label="Trocar de cliente mantendo a aba"
          value={id}
          disabled={!q.data}
          className="min-h-11 max-w-full rounded-md border bg-white px-3 text-sm"
          onChange={(e) =>
            void router.navigate({
              to: "/management/clients/$clientId",
              params: { clientId: e.target.value },
              search: { tab },
            })
          }
        >
          {q.data
            ?.filter((c) => c.id === id || c.name.toLowerCase().includes(search.toLowerCase()))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.churned || c.status !== "active" ? " · Histórico" : ""}
              </option>
            ))}
        </select>
        <button
          className="min-h-11 rounded-md border px-3 text-sm"
          disabled={!prefs.data || prefs.update.isPending}
          onClick={() =>
            prefs.toggle({ href, label: name, module: "workspace.clients", clientId: id })
          }
        >
          {prefs.favorites.some((f) => f.href === href)
            ? "Remover dos favoritos"
            : "Favoritar cliente"}
        </button>
      </div>
      {q.error && (
        <p role="alert" className="text-sm">
          Não foi possível carregar o seletor.{" "}
          <button onClick={() => void q.refetch()}>Tentar novamente</button>
        </p>
      )}
    </div>
  );
}
