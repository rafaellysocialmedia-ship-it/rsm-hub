import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gauge, History, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePostLedger, usePostUsage } from "@/hooks/use-post-ledger";
import {
  balanceLabel, balanceTone, labelMonth, openMonthSummary, ymOf,
  type PostLedgerRow,
} from "@/lib/post-ledger";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/posts-control")({
  head: () => ({
    meta: [
      { title: "Controle de Posts · Social Media Hub" },
      { name: "description", content: "Visão geral mensal de posts contratados, utilizados e saldo acumulado por cliente." },
      { property: "og:title", content: "Controle de Posts" },
      { property: "og:description", content: "Saldo mensal de posts por cliente no Social Media Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostsControlPage,
});

function PostsControlPage() {
  const { hasRole, loading } = useAuth();
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!hasRole("administrator") && !hasRole("team")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta área é restrita à equipe interna.</p>
      </div>
    );
  }
  return <PostsControl />;
}

function PostsControl() {
  const [q, setQ] = useState("");
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const { year, month } = ymOf();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["posts-control-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,status,monthly_post_quota")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: ledger = [] } = usePostLedger();
  const { data: usage = [] } = usePostUsage();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .map((c) => ({
        client: c,
        summary: openMonthSummary({
          clientId: c.id,
          contracted: c.monthly_post_quota ?? 0,
          ledger: ledger as PostLedgerRow[],
          posts: usage,
          since: (c as { start_date?: string | null }).start_date ?? null,
        }),

      }));
  }, [clients, ledger, usage, q]);

  const totals = rows.reduce(
    (acc, r) => ({
      contracted: acc.contracted + r.summary.contracted,
      used: acc.used + r.summary.used,
      balance: acc.balance + r.summary.balance,
    }),
    { contracted: 0, used: 0, balance: 0 },
  );

  const history = useMemo(
    () => (ledger as PostLedgerRow[]).filter((r) => r.client_id === historyOf),
    [ledger, historyOf],
  );
  const historyClient = clients.find((c) => c.id === historyOf);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-6 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-2xl font-semibold tracking-tight">
            <Gauge className="h-5 w-5 shrink-0 text-primary" /> Controle de Posts
          </h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">{labelMonth(year, month)}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">{rows.length} clientes</Badge>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Contratados no mês" value={totals.contracted} />
        <Stat label="Utilizados" value={totals.used} />
        <Stat label="Saldo consolidado" value={balanceLabel(totals.balance)} tone={balanceTone(totals.balance)} />
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar cliente..."
        className="max-w-xs"
      />

      <Card className="shadow-soft">
        <CardHeader className="pb-2"><CardTitle className="text-base">Saldo mensal por cliente</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Contratados</TableHead>
                  <TableHead className="text-right">Saldo anterior</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Utilizados</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ client, summary }) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-right">{summary.contracted || "—"}</TableCell>
                    <TableCell className="text-right">{balanceLabel(summary.previous)}</TableCell>
                    <TableCell className="text-right">{summary.available}</TableCell>
                    <TableCell className="text-right">{summary.used}</TableCell>
                    <TableCell className={`text-right font-semibold ${balanceTone(summary.balance)}`}>
                      {balanceLabel(summary.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setHistoryOf(historyOf === client.id ? null : client.id)}
                      >
                        <History className="h-3 w-3" /> Histórico
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {historyOf && (
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico mensal — {historyClient?.name}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum mês fechado ainda. O fechamento acontece automaticamente no início de cada mês.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Contratados</TableHead>
                    <TableHead className="text-right">Saldo anterior</TableHead>
                    <TableHead className="text-right">Utilizados</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="capitalize">{labelMonth(r.year, r.month)}</TableCell>
                      <TableCell className="text-right">{r.contracted}</TableCell>
                      <TableCell className="text-right">{balanceLabel(r.previous_balance)}</TableCell>
                      <TableCell className="text-right">{r.used}</TableCell>
                      <TableCell className={`text-right font-semibold ${balanceTone(r.balance)}`}>
                        {balanceLabel(r.balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.closed_at ? "secondary" : "outline"} className="text-[10px]">
                          {r.closed_at ? "Fechado" : "Em aberto"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
