import { MultiClientFilter } from "./multi-client-filter";
import { selectedClients } from "@/lib/calendar-period";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { useId } from "react";
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
  const id = useId();
  const prefs = useNavigationPreferences();
  const visible = prefs.data?.calendar_filters_open ?? false;
  const active = filters.filter((f) => f.value !== f.empty);
  const activeCount = active.length + (search.trim() ? 1 : 0);
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${id}-search`} className="sr-only">Buscar publicações</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${id}-search`}
            placeholder="Buscar publicação por título…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="h-10 bg-background pl-9 pr-10 shadow-none"
          />
          {search && (
            <button type="button" aria-label="Limpar busca" className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-muted-foreground hover:text-primary focus-visible:ring-2" onClick={() => onSearch("")}>
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`h-10 shrink-0 gap-2 bg-background shadow-none ${visible || active.length ? "border-primary/30" : ""}`}
          aria-expanded={visible}
          aria-controls={`${id}-fields`}
          disabled={prefs.update.isPending}
          onClick={() => prefs.update.mutate({ calendar_filters_open: !visible })}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`size-4 transition-transform ${visible ? "rotate-180" : ""}`} aria-hidden />
        </Button>
      </div>
      {prefs.error && (
        <p role="alert" className="text-xs text-destructive">Não foi possível salvar a preferência de visualização dos filtros.</p>
      )}
      {visible && (
        <div id={`${id}-fields`} className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[...filters.filter((f) => f.primary), ...filters.filter((f) => !f.primary)].map(field)}
          </div>
        </div>
      )}
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
