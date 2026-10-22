import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Star, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { profileGroups } from "@/components/workspace/grouped-navigation";
export function ClientSwitcher({ id, name, tab }: { id: string; name: string; tab: string }) {
  const [open, setOpen] = useState(false);
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
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            aria-label="Trocar de cliente"
            className="max-w-full gap-2"
          >
            <span className="truncate">{name}</span>
            <ChevronsUpDown className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(90vw,360px)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente…" aria-label="Buscar cliente" />
            <CommandList>
              <CommandEmpty>
                {q.isLoading ? "Carregando clientes…" : "Nenhum cliente encontrado."}
              </CommandEmpty>
              {q.data?.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.id}`}
                  onSelect={() => {
                    setOpen(false);
                    void router.navigate({
                      to: "/management/clients/$clientId",
                      params: { clientId: c.id },
                      search: { tab },
                    });
                  }}
                >
                  {c.name}
                  {c.churned || c.status !== "active" ? " · Histórico" : ""}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          prefs.favorites.some((f) => f.href === href)
            ? "Remover cliente dos favoritos"
            : "Favoritar cliente"
        }
        aria-pressed={prefs.favorites.some((f) => f.href === href)}
        disabled={!prefs.data || prefs.update.isPending}
        onClick={() =>
          prefs.toggle({ href, label: name, module: "workspace.clients", clientId: id })
        }
      >
        <Star
          className={
            prefs.favorites.some((f) => f.href === href)
              ? "size-4 fill-primary text-primary"
              : "size-4"
          }
        />
      </Button>
      <span className="text-xs text-muted-foreground">
        {profileGroups.find((g) => g.items.some((i) => i[0] === tab))?.title ?? "Resumo"}
      </span>
      {q.error && (
        <p role="alert" className="text-sm">
          Não foi possível carregar o seletor.{" "}
          <button onClick={() => void q.refetch()}>Tentar novamente</button>
        </p>
      )}
    </div>
  );
}
