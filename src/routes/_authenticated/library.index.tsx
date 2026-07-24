import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Filter, FolderPlus, Grid3x3, List as ListIcon, X,
  Folder as FolderIcon, ChevronRight, Tag as TagIcon, Library, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  FILE_CATEGORIES, categoryMeta, formatBytes,
  type FileCategory, type FileRow, type FolderRow,
} from "@/lib/library";
import type { Client } from "@/lib/clients";

import { FileThumbnail } from "@/components/library/file-thumbnail";
import { FilePreviewDialog } from "@/components/library/file-preview-dialog";
import { UploadDialog } from "@/components/library/upload-dialog";
import { FolderDialog } from "@/components/library/folder-dialog";

export const Route = createFileRoute("/_authenticated/library/")({
  head: () => ({
    meta: [
      { title: "Biblioteca · Social Media Hub" },
      { name: "description", content: "Logos, fotos, vídeos, criativos e documentos centralizados." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("administrator") || hasRole("team");

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<FileCategory | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderRow | null>(null);
  const [preview, setPreview] = useState<FileRow | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ["library-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("file_folders").select("*").order("name");
      if (error) throw error;
      return data as FolderRow[];
    },
  });

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["library-files"],
    queryFn: async () => {
      const { data, error } = await supabase.from("files").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as FileRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("library-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "files" }, () =>
        qc.invalidateQueries({ queryKey: ["library-files"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "file_folders" }, () =>
        qc.invalidateQueries({ queryKey: ["library-folders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => f.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [files]);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const rootFolders = folders.filter((f) => !f.parent_id);
  const currentFolder = folderId ? folders.find((f) => f.id === folderId) ?? null : null;
  const subfolders = folders.filter((f) => f.parent_id === folderId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      if (folderId !== null && f.folder_id !== folderId) return false;
      if (catFilter !== "all" && f.category !== catFilter) return false;
      if (clientFilter !== "all" && f.client_id !== clientFilter) return false;
      if (tagFilter !== "all" && !f.tags?.includes(tagFilter)) return false;
      if (q) {
        const hay = [f.name, f.description, ...(f.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [files, folderId, catFilter, clientFilter, tagFilter, search]);

  const totalSize = useMemo(() => filtered.reduce((s, f) => s + Number(f.size_bytes ?? 0), 0), [filtered]);
  const activeFilters = (catFilter !== "all" ? 1 : 0) + (clientFilter !== "all" ? 1 : 0) + (tagFilter !== "all" ? 1 : 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-8">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-20 space-y-5">
          <div className="space-y-1">
            <button
              onClick={() => { setFolderId(null); setCatFilter("all"); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                folderId === null && catFilter === "all" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <Library className="h-4 w-4" />Tudo
              <span className="ml-auto text-[10px] tabular-nums">{files.length}</span>
            </button>
          </div>

          <div>
            <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Categorias</p>
            <div className="space-y-0.5">
              {FILE_CATEGORIES.map((c) => {
                const count = files.filter((f) => f.category === c.value).length;
                const Icon = c.icon;
                return (
                  <button
                    key={c.value}
                    onClick={() => { setCatFilter(c.value); setFolderId(null); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                      catFilter === c.value ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-md", c.tone)}>
                      <Icon className="h-3 w-3" />
                    </span>
                    {c.label}
                    <span className="ml-auto text-[10px] tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between px-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pastas</p>
              {canManage && (
                <button
                  onClick={() => { setEditingFolder(null); setFolderOpen(true); }}
                  className="text-muted-foreground hover:text-foreground"
                  title="Nova pasta"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ScrollArea className="max-h-64">
              <div className="space-y-0.5 pr-2">
                {rootFolders.length === 0 && (
                  <p className="px-2.5 py-2 text-xs text-muted-foreground">Nenhuma pasta</p>
                )}
                {rootFolders.map((f) => {
                  const count = files.filter((x) => x.folder_id === f.id).length;
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        folderId === f.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <button
                        onClick={() => { setFolderId(f.id); setCatFilter("all"); }}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <FolderIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                      <span className="text-[10px] tabular-nums group-hover:hidden">{count}</span>
                      {canManage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingFolder(f); setFolderOpen(true); }}
                          className="hidden text-muted-foreground hover:text-foreground group-hover:inline-flex"
                          title="Editar pasta"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>


          {allTags.length > 0 && (
            <div>
              <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1 px-1.5">
                {allTags.slice(0, 20).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(tagFilter === t ? "all" : t)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] transition-colors",
                      tagFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <button onClick={() => setFolderId(null)} className="hover:text-foreground">Biblioteca</button>
              {currentFolder && (<><ChevronRight className="h-3 w-3" /><span className="text-foreground">{currentFolder.name}</span></>)}
              {catFilter !== "all" && (<><ChevronRight className="h-3 w-3" /><span className="text-foreground">{categoryMeta(catFilter).label}</span></>)}
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {currentFolder?.name ?? (catFilter !== "all" ? categoryMeta(catFilter).label : "Biblioteca de arquivos")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length} arquivo{filtered.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditingFolder(null); setFolderOpen(true); }} className="gap-1.5">
                <FolderPlus className="h-4 w-4" />Nova pasta
              </Button>
              <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />Enviar arquivos
              </Button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-soft lg:flex-row lg:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, descrição ou tag…"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
            <Select value={catFilter} onValueChange={(v) => setCatFilter(v as FileCategory | "all")}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {FILE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {canManage && (
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos clientes</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas tags</SelectItem>
                  {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" className="h-9 gap-1 text-xs"
                onClick={() => { setCatFilter("all"); setClientFilter("all"); setTagFilter("all"); }}>
                <X className="h-3 w-3" />Limpar
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{activeFilters}</Badge>
              </Button>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "list")}>
              <TabsList className="h-9">
                <TabsTrigger value="grid" className="text-xs"><Grid3x3 className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="list" className="text-xs"><ListIcon className="h-3.5 w-3.5" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Subfolders */}
        {subfolders.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {subfolders.map((f) => (
              <button key={f.id} onClick={() => setFolderId(f.id)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm shadow-soft transition-colors hover:bg-muted/40">
                <FolderIcon className="h-4 w-4 text-amber-500" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Files */}
        {isLoading ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Library className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum arquivo aqui</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {canManage ? "Envie seu primeiro arquivo para começar." : "Ainda não há arquivos disponíveis."}
              </p>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />Enviar arquivo
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((f) => {
              const meta = categoryMeta(f.category);
              return (
                <button key={f.id} onClick={() => setPreview(f)}
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <FileThumbnail file={f} />
                  <div className="space-y-1">
                    <p className="line-clamp-1 text-xs font-medium">{f.name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={cn("text-[9px]", meta.tone)}>{meta.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatBytes(Number(f.size_bytes))}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
            {filtered.map((f) => {
              const meta = categoryMeta(f.category);
              return (
                <li key={f.id} onClick={() => setPreview(f)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                  <FileThumbnail file={f} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[f.client_id ? clientMap.get(f.client_id) : null, f.mime_type ?? "—"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {f.tags && f.tags.length > 0 && (
                    <div className="hidden gap-1 md:flex">
                      {f.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[9px]"><TagIcon className="mr-0.5 h-2 w-2" />{t}</Badge>
                      ))}
                    </div>
                  )}
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.tone)}>{meta.label}</Badge>
                  <span className="hidden w-16 text-right text-xs text-muted-foreground sm:inline">{formatBytes(Number(f.size_bytes))}</span>
                  <span className="hidden w-20 text-right text-xs text-muted-foreground md:inline">
                    {format(new Date(f.created_at), "dd MMM", { locale: ptBR })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folders={folders}
        clients={clients}
        defaultFolderId={folderId}
        defaultCategory={catFilter === "all" ? undefined : catFilter}
      />
      <FolderDialog
        open={folderOpen}
        onOpenChange={(o) => { setFolderOpen(o); if (!o) setEditingFolder(null); }}
        folders={folders}
        clients={clients}
        folder={editingFolder}
      />
      <FilePreviewDialog file={preview} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} canManage={canManage} />
    </div>
  );
}
