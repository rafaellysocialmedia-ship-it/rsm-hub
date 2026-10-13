import { MultiClientFilter } from "./multi-client-filter";
import { selectedClients } from "@/lib/calendar-period";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { useId, useState } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type Option = { value: string; label: string };
export type ContentFilter = {
  key: string;
  label: string;
  value: string;
  empty: string;
  options: Option[];
  onChange: (value: string) => void;
  primary?: boolean;
  multiple?: boolean;
  loading?: boolean;
  error?: boolean;
};
export function ContentFilters({
  search,
  onSearch,
  filters,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: ContentFilter[];
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const prefs = useNavigationPreferences();
  const visible = prefs.data?.calendar_filters_open ?? true;
  const active = filters.filter((f) => f.value !== f.empty);
  const advanced = filters.filter((f) => !f.primary);
  const advancedCount = advanced.filter((f) => f.value !== f.empty).length;
  const field = (f: ContentFilter) => (
    <div key={f.key} className="min-w-0 space-y-1.5">
      <label htmlFor={`${id}-${f.key}`} className="block text-xs font-medium text-muted-foreground">
        {f.label}
      </label>
      {f.multiple ? (
        <MultiClientFilter
          id={`${id}-${f.key}`}
          value={f.value}
          options={f.options}
          onChange={f.onChange}
        />
      ) : (
        <Select value={f.value} onValueChange={f.onChange}>
          <SelectTrigger id={`${id}-${f.key}`} className="h-11 min-w-0 bg-background shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={f.empty}>
              {f.key === "client"
                ? "Todos os clientes"
                : f.key === "status"
                  ? "Todos os status"
                  : f.key === "channel"
                    ? "Todos os canais"
                    : f.key === "format"
                      ? "Todos os formatos"
                      : "Todos os responsáveis"}
            </SelectItem>
            {f.value !== f.empty && !f.options.some((o) => o.value === f.value) && (
              <SelectItem value={f.value}>Seleção indisponível</SelectItem>
            )}
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {f.loading && <p className="text-xs text-muted-foreground">Carregando opções…</p>}
      {f.error && (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível carregar as opções.
        </p>
      )}
    </div>
  );
  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={visible}
        aria-controls={`${id}-fields`}
        onClick={() => prefs.update.mutate({ calendar_filters_open: !visible })}
      >
        {visible ? "Recolher filtros" : "Mostrar filtros"}
      </Button>
      <div id={`${id}-fields`} hidden={!visible}>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:flex xl:items-end">
          <div className="min-w-0 space-y-1.5 sm:col-span-2 xl:flex-1">
            <label
              htmlFor={`${id}-search`}
              className="block text-xs font-medium text-muted-foreground"
            >
              Buscar conteúdo
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
              />
              <Input
                id={`${id}-search`}
                placeholder="Título da publicação…"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="h-11 bg-background pl-9 pr-10 shadow-none"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  className="absolute right-1 top-1 rounded p-2.5 text-muted-foreground hover:text-primary focus-visible:ring-2"
                  onClick={() => onSearch("")}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          {filters
            .filter((f) => f.primary)
            .map((f) => (
              <div key={f.key} className="min-w-0 xl:w-52">
                {field(f)}
              </div>
            ))}
          {advanced.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className={`h-11 gap-2 self-end shadow-none ${expanded ? "border-primary/30 bg-primary/5 text-primary" : ""}`}
              aria-expanded={expanded}
              aria-controls={`${id}-more`}
              onClick={() => setExpanded(!expanded)}
            >
              <SlidersHorizontal className="size-4" />
              Mais filtros
              {advancedCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                  {advancedCount}
                </span>
              )}
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          )}
        </div>
        {expanded && (
          <div
            id={`${id}-more`}
            className="grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {advanced.map(field)}
          </div>
        )}
      </div>
      {(active.length > 0 || search) && (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3"
          aria-label="Filtros aplicados"
        >
          <span className="text-xs text-muted-foreground">Filtrando por:</span>
          {search && (
            <button
              type="button"
              className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-md bg-primary/5 px-2.5 text-xs text-primary hover:bg-primary/10 focus-visible:ring-2"
              aria-label="Remover filtro de busca"
              onClick={() => onSearch("")}
            >
              <span className="truncate">Busca: {search}</span>
              <X className="size-3 shrink-0" />
            </button>
          )}
          {active.map((f) => (
            <button
              type="button"
              key={f.key}
              aria-label={`Remover filtro ${f.label}`}
              className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-md bg-primary/5 px-2.5 text-xs text-primary hover:bg-primary/10 focus-visible:ring-2"
              onClick={() => f.onChange(f.empty)}
            >
              <span className="truncate">
                {f.label}:{" "}
                {f.multiple
                  ? selectedClients(f.value)
                      .map(
                        (id) =>
                          f.options.find((o) => o.value === id)?.label ?? "Cliente indisponível",
                      )
                      .join(", ")
                  : (f.options.find((o) => o.value === f.value)?.label ?? "Seleção indisponível")}
              </span>
              <X className="size-3 shrink-0" />
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => {
              onSearch("");
              filters.forEach((f) => f.onChange(f.empty));
            }}
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
