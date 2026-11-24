import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeletons reutilizáveis — evitam telas em branco durante o carregamento. */

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-2 py-2">
            <Skeleton className="h-2.5 w-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[110px] space-y-1.5 border-b border-r border-border p-1.5">
            <Skeleton className="h-3 w-4" />
            {i % 3 === 0 && <Skeleton className="h-4 w-full" />}
            {i % 5 === 0 && <Skeleton className="h-4 w-3/4" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-full w-full rounded-lg", className)} />;
}

/** Conteúdo genérico de uma tela carregando: título, abas e cartões. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Carregando a tela" className="space-y-5 p-4 sm:p-6">
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-muted/80" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/70" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted/50" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/**
 * Estrutura do app (menu + topo + conteúdo) enquanto a sessão e o código carregam.
 * Também é a primeira coisa que o servidor envia, então nunca aparece página em branco.
 */
export function AppFrameSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        aria-hidden="true"
        className="hidden w-64 shrink-0 flex-col gap-2 border-r border-border bg-sidebar p-3 md:flex"
      >
        <img
          src="/rsm-symbol.png"
          alt=""
          width={128}
          height={74}
          className="mx-auto mb-2 h-14 w-auto object-contain opacity-80 dark:brightness-0 dark:invert"
        />
        <div className="h-9 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 rounded-lg bg-primary/80" />
        <div className="mt-3 space-y-2">
          {["Início", "Clientes", "Conteúdo", "Tarefas", "Tráfego", "Financeiro", "Relatórios"].map(
            (label) => (
              <div key={label} className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground">
                <span className="size-4 rounded bg-muted" />
                {label}
              </div>
            ),
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b border-border/70 px-4">
          <span
            className="inline-block size-4 animate-spin rounded-full border-2 border-brand-accent border-t-transparent"
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">Carregando…</span>
        </header>
        <PageSkeleton />
      </div>
    </div>
  );
}

/** Quadro (kanban) carregando: colunas com cartões. */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div role="status" aria-label="Carregando o quadro" className="flex gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="w-72 shrink-0 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 3 - (c % 2) }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Linhas de tabela carregando, para usar dentro de <TableBody>. */
export function TableRowsSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-hidden="true" className="border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className="h-3.5 w-full max-w-40" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Área de mídia (imagem, vídeo, prévia) carregando. */
export function MediaSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Carregando mídia" className={cn("animate-pulse rounded-lg bg-muted", className ?? "h-48 w-full")} />
  );
}

/** Texto curto carregando (no lugar de "Carregando…" dentro de uma frase ou campo). */
export function InlineSkeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block h-3 animate-pulse rounded bg-muted align-middle", className ?? "w-20")} />;
}
