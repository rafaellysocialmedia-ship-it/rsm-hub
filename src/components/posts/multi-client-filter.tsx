import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectedClients } from "@/lib/calendar-period";
export function MultiClientFilter({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const selected = selectedClients(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className="h-11 w-full justify-start overflow-hidden bg-background font-normal"
        >
          <span className="truncate">
            {selected.length === 0
              ? "Todos os clientes"
              : selected.length === 1
                ? (options.find((o) => o.value === selected[0])?.label ?? "Cliente selecionado")
                : `${selected.length} clientes selecionados`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <Input
          aria-label="Buscar cliente no filtro"
          placeholder="Buscar cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="sm" variant="ghost" onClick={() => onChange("all")}>
          Todos os clientes
        </Button>
        <div className="max-h-64 overflow-auto" role="group" aria-label="Selecionar clientes">
          {options
            .filter((o) => o.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
            .map((o) => (
              <label
                key={o.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[#42145d]"
                  checked={selected.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((id) => id !== o.value);
                    onChange(next.length ? next.join(",") : "all");
                  }}
                />
                <span className="text-sm">{o.label}</span>
              </label>
            ))}
          {!options.some((o) =>
            o.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
          ) && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
