import { useEffect, useId, useState } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { MultiClientFilter } from "./multi-client-filter";
import { selectedClients } from "@/lib/calendar-period";
import { useNavigationPreferences } from "@/hooks/use-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
  multiSelect?: boolean;
  loading?: boolean;
  error?: boolean;
};

export function ContentFilters({
  search, onSearch, filters,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: ContentFilter[];
}) {
  const id = useId();
  const prefs = useNavigationPreferences();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (prefs.data) setOpen(prefs.data.calendar_filters_open ?? false);
  }, [prefs.data?.calendar_filters_open]);
  const setFilterOpen = (next: boolean) => {
    setOpen(next);
    if (prefs.data?.calendar_filters_open !== next) {
      prefs.update.mutate({ calendar_filters_open: next });
    }
  };
  const primaries = filters.filter((f) => f.primary);
  const advanced = filters.filter((f) => !f.primary);
  const selectedOf = (f: ContentFilter) =>
    f.multiple || f.multiSelect ? selectedClients(f.value) : f.value === f.empty ? [] : [f.value];
  const active = filters.filter((f) => selectedOf(f).length > 0);
  const advancedCount = advanced.filter((f) => selectedOf(f).length > 0).length;

  const field = (f: ContentFilter) => (
    <div key={f.key} className="min-w-0 space-y-1.5">
      <label htmlFor={`${id}-${f.key}`} className="text-[11px] font-medium text-muted-foreground">
        {f.label}
      </label>
      {f.multiple ? (
        <MultiClientFilter id={`${id}-${f.key}`} value={f.value} options={f.options} onChange={f.onChange} />
      ) : f.multiSelect ? (
        <div
          id={`${id}-${f.key}`}
          className="max-h-40 space-y-0.5 overflow-auto rounded-md border bg-background p-1"
          role="group"
          aria-label={f.label}
        >
          <button
            type="button"
            className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
            onClick={() => f.onChange(f.empty)}
          >
            Todos
          </button>
          {f.options.map((option) => {
            const chosen = selectedOf(f).includes(option.value);
            return (
              <label key={option.value} className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-xs hover:bg-muted">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[#42145d]"
                  checked={chosen}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedOf(f), option.value]
                      : selectedOf(f).filter((value) => value !== option.value);
                    f.onChange(next.length ? next.join(",") : f.empty);
                  }}
                />
                <span className="truncate" title={option.label}>{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <Select value={f.value} onValueChange={f.onChange}>
          <SelectTrigger id={`${id}-${f.key}`} className="h-8 min-w-0 bg-background text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={f.empty}>Todos</SelectItem>
            {selectedOf(f).some((v) => !f.options.some((o) => o.value === v)) && (
              <SelectItem value={f.value}>Seleção indisponível</SelectItem>
            )}
            {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {f.loading && <p className="text-[11px] text-muted-foreground">Carregando opções…</p>}
      {f.error && <p role="alert" className="text-[11px] text-destructive">Não foi possível carregar as opções.</p>}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="relative min-w-[180px] flex-[2_1_240px]">
          <label htmlFor={`${id}-search`} className="sr-only">Buscar publicações</label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={`${id}-search`}
            placeholder="Buscar conteúdo…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="h-8 rounded-lg border-border/70 bg-background pl-8 pr-8 text-xs shadow-none"
          />
          {!!search && (
            <button type="button" aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground" onClick={() => onSearch("")}>
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {primaries.map((f) => (
          <div key={f.key} className="w-[185px] max-w-full shrink-0 max-sm:flex-1">
            <div className="sr-only">{f.label}</div>
            {f.multiple ? (
              <MultiClientFilter id={`${id}-${f.key}`} value={f.value} options={f.options} onChange={f.onChange} />
            ) : field(f)}
          </div>
        ))}
        {advanced.length > 0 && (
          <Popover open={open} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 rounded-lg border-border/70 px-3 text-xs shadow-none" aria-label="Abrir filtros adicionais">
                <SlidersHorizontal className="size-3.5" aria-hidden />
                Filtros
                {advancedCount > 0 && <span className="rounded bg-primary/10 px-1.5 text-[10px] text-primary">{advancedCount}</span>}
                <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(90vw,340px)] space-y-3 rounded-xl border-border/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Filtrar publicações</p>
                <button type="button" className="text-[11px] text-muted-foreground hover:text-primary" onClick={() => advanced.forEach((f) => f.onChange(f.empty))}>Limpar</button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {advanced.map(field)}
              </div>
              <Button type="button" size="sm" variant="secondary" className="h-8 w-full" onClick={() => setFilterOpen(false)}>Aplicar filtros</Button>
            </PopoverContent>
          </Popover>
        )}
        {prefs.error && <span role="alert" className="text-xs text-destructive">Preferência de filtros não salva.</span>}
      </div>
      {(active.length > 0 || search.trim()) && (
        <div className="flex flex-wrap items-center gap-1" aria-label="Filtros aplicados">
          {search.trim() && (
            <button type="button" onClick={() => onSearch("")} className="inline-flex h-6 max-w-[220px] items-center gap-1 rounded-md bg-muted px-2 text-[11px]">
              <span className="truncate">Busca: {search}</span><X className="size-3" />
            </button>
          )}
          {active.map((f) => {
            const values = selectedOf(f);
            const labels = values.map((v) => f.options.find((o) => o.value === v)?.label ?? "Indisponível");
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => f.onChange(f.empty)}
                title={labels.join(", ")}
                className="inline-flex h-6 max-w-48 items-center gap-1 rounded-md border border-primary/15 bg-primary/5 px-2 text-[11px] text-primary"
              >
                <span className="truncate">{f.label}: {labels.length > 1 ? `${labels.length} selecionados` : labels[0]}</span>
                <X className="size-3 shrink-0" />
              </button>
            );
          })}
          <button type="button" onClick={() => { onSearch(""); filters.forEach((f) => f.onChange(f.empty)); }} className="px-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}
