import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Briefcase,
  Mail,
  Phone,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CLIENT_STATUS, statusMeta, type Client, type ClientStatus } from "@/lib/clients";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientLogo } from "@/components/clients/client-logo";
import { StatusBadge } from "@/components/clients/status-badge";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { QuotaBadge } from "@/components/clients/quota-badge";
import { countMonthPosts } from "@/lib/post-quota";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [{ title: "Clientes · Social Media Hub" }],
  }),
  component: ClientsPage,
});

type SortKey = "name" | "created_at" | "start_date" | "status";

function ClientsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("administrator") || hasRole("team");
  const canDelete = hasRole("administrator");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [segment, setSegment] = useState<string>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: postsForQuota = [] } = useQuery({
    queryKey: ["posts-quota-month"],
    queryFn: async () => {
      const ref = new Date();
      const first = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("posts")
        .select("client_id,status,scheduled_date")
        .gte("scheduled_date", first)
        .lte("scheduled_date", last);
      if (error) throw error;
      return data ?? [];
    },
  });

  const usageByClient = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => map.set(c.id, countMonthPosts(postsForQuota, c.id)));
    return map;
  }, [clients, postsForQuota]);

  const segments = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => c.segment && set.add(c.segment));
    return Array.from(set).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = clients.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (segment !== "all" && c.segment !== segment) return false;
      if (!q) return true;
      return [c.name, c.legal_name, c.cnpj, c.email, c.responsible, c.segment]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [clients, search, status, segment, sortKey, sortDir]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Gestão</p>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"} cadastrados
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ, email…"
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus | "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {CLIENT_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos segmentos</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => {
          const [k, d] = v.split(":") as [SortKey, "asc" | "desc"];
          setSortKey(k);
          setSortDir(d);
        }}>
          <SelectTrigger className="w-full sm:w-52">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Mais recentes</SelectItem>
            <SelectItem value="created_at:asc">Mais antigos</SelectItem>
            <SelectItem value="name:asc">Nome (A-Z)</SelectItem>
            <SelectItem value="name:desc">Nome (Z-A)</SelectItem>
            <SelectItem value="start_date:desc">Início recente</SelectItem>
            <SelectItem value="status:asc">Status</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-border p-0.5">
          <Button
            variant={view === "cards" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("cards")}
            className="h-8 px-2"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
            className="h-8 px-2"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <EmptyState title="Carregando clientes…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={clients.length === 0 ? "Nenhum cliente ainda" : "Nenhum resultado"}
            description={
              clients.length === 0
                ? "Comece adicionando seu primeiro cliente para começar a gerenciar."
                : "Tente ajustar os filtros ou a busca."
            }
            action={
              canManage && clients.length === 0 ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar cliente
                </Button>
              ) : null
            }
          />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                usedThisMonth={usageByClient.get(c.id) ?? 0}
                canManage={canManage}
                canDelete={canDelete}
                onEdit={() => {
                  setEditing(c);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleting(c)}
              />
            ))}
          </div>
        ) : (
          <ClientsTable
            clients={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            canManage={canManage}
            canDelete={canDelete}
            onEdit={(c) => {
              setEditing(c);
              setFormOpen(true);
            }}
            onDelete={(c) => setDeleting(c)}
          />
        )}
      </div>

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. {deleting?.name} será removido junto com seus dados
              associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientCard({
  client,
  canManage,
  canDelete,
  onEdit,
  onDelete,
}: {
  client: Client;
  canManage: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group shadow-soft transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            to="/clients/$clientId"
            params={{ clientId: client.id }}
            className="flex min-w-0 flex-1 items-start gap-3"
          >
            <ClientLogo path={client.logo_url} name={client.name} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold tracking-tight">{client.name}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {client.segment ?? "Sem segmento"}
              </p>
            </div>
          </Link>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <StatusBadge status={client.status} />
          {client.plan && (
            <span className="text-xs text-muted-foreground">{client.plan}</span>
          )}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          {client.email && (
            <div className="flex items-center gap-2 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.responsible && (
            <div className="flex items-center gap-2 truncate">
              <Briefcase className="h-3 w-3 shrink-0" />
              <span className="truncate">{client.responsible}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ClientsTable({
  clients,
  sortKey,
  sortDir,
  onSort,
  canManage,
  canDelete,
  onEdit,
  onDelete,
}: {
  clients: Client[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  canManage: boolean;
  canDelete: boolean;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider hover:text-foreground",
          sortKey === k ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-lg border border-border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead k="name">Cliente</SortHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead>Plano</TableHead>
            <SortHead k="start_date">Início</SortHead>
            <SortHead k="status">Status</SortHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id} className="group">
              <TableCell>
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="flex items-center gap-3"
                >
                  <ClientLogo path={c.logo_url} name={c.name} className="h-9 w-9" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.email ?? c.cnpj ?? "—"}
                    </div>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.responsible ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.segment ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.plan ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.start_date ? new Date(c.start_date).toLocaleDateString("pt-BR") : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(c)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(c)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Briefcase className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
