import { useEffect, useState, useMemo, createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { Search, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { isTyping } from "@/lib/navigation";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { PostEditorSheet } from "@/components/posts/post-editor-sheet";
import { ReviewDialog } from "@/components/approval/review-dialog";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import type { Client } from "@/lib/clients";
import type { Post } from "@/lib/posts";
const QuickContext = createContext<{
  actions: string[][];
  search: () => void;
  create: (key: string) => void;
} | null>(null);
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const { hasRole, user } = useAuth();
  const staff = hasRole("administrator") || hasRole("team");
  const { can, loading } = usePermissions();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile, isMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false),
    [term, setTerm] = useState(""),
    [debounced, setDebounced] = useState(""),
    [create, setCreate] = useState(""),
    [post, setPost] = useState<Post | null>(null);
  const clientId = path.match(/^\/management\/clients\/([^/]+)/)?.[1];
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !isTyping(e.target)) {
        e.preventDefault();
        if (isMobile) setOpenMobile(false);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isMobile, setOpenMobile]);
  const clients = useQuery({
    queryKey: ["navigation-create-clients", user?.id],
    enabled: staff && !!create,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .eq("churned", false)
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
  const validClientId = clients.data?.some((c) => c.id === clientId) ? clientId : undefined;
  const initial = useMemo(
    () => (validClientId ? { client_id: validClientId } : undefined),
    [validClientId],
  );
  const q = useQuery({
    queryKey: [
      "navigation-search",
      user?.id,
      debounced,
      staff,
      can("workspace.clients"),
      can("social.calendar"),
    ],
    enabled: searchOpen && debounced.length >= 2 && !loading,
    queryFn: async () => {
      const needle = debounced.replace(/[%,_]/g, "");
      const [c, p] = await Promise.all([
        staff && can("workspace.clients")
          ? supabase
              .from("clients")
              .select("id,name,status,churned")
              .ilike("name", `%${needle}%`)
              .limit(12)
          : Promise.resolve({ data: [], error: null }),
        can("social.calendar")
          ? supabase.from("portal_posts").select("*").ilike("title", `%${needle}%`).limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (c.error) throw c.error;
      if (p.error) throw p.error;
      const ids = [...new Set(p.data?.flatMap((x) => (x.client_id ? [x.client_id] : [])) ?? [])];
      const names = ids.length
        ? await supabase.from("clients").select("id,name").in("id", ids)
        : { data: [], error: null };
      if (names.error) throw names.error;
      return { clients: c.data ?? [], posts: (p.data ?? []) as Post[], names: names.data ?? [] };
    },
  });
  const actions = [
    ["post", "Conteúdo", "social.calendar"],
    ["task", "Tarefa", "workspace.tasks"],
    ["client", "Cliente", "workspace.clients"],
    ["meeting", "Reunião", "workspace.meetings"],
  ].filter((a) => staff && !loading && can(a[2], "create"));
  const openCreate = (value: string) => {
    setOpenMobile(false);
    setCreate(value);
  };
  return (
    <QuickContext.Provider
      value={{
        actions,
        search: () => {
          setOpenMobile(false);
          setSearchOpen(true);
        },
        create: openCreate,
      }}
    >
      {children}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="p-3 sm:max-w-xl">
          <DialogTitle>Buscar no RSM</DialogTitle>
          <DialogDescription>Clientes e conteúdos permitidos para seu acesso.</DialogDescription>
          <Command shouldFilter={false}>
            <CommandInput
              value={term}
              onValueChange={setTerm}
              placeholder="Digite ao menos 2 caracteres…"
            />
            <CommandList>
              {debounced.length < 2 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Busque por nome do cliente ou título do conteúdo.
                </p>
              ) : q.isFetching ? (
                <p className="p-4 text-sm">Buscando…</p>
              ) : q.error ? (
                <p role="alert" className="p-4 text-sm text-destructive">
                  Não foi possível buscar.{" "}
                  <button onClick={() => void q.refetch()} className="underline">
                    Tentar novamente
                  </button>
                </p>
              ) : (
                <>
                  {!q.data?.clients.length && !q.data?.posts.length && (
                    <p className="p-4 text-sm">Nenhum resultado encontrado.</p>
                  )}
                  <CommandGroup heading="Clientes">
                    {q.data?.clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => {
                          setSearchOpen(false);
                          void router.navigate({
                            to: "/management/clients/$clientId",
                            params: { clientId: c.id },
                            search: { tab: "overview" },
                          });
                        }}
                      >
                        {c.name} · Cliente {c.churned || c.status !== "active" ? "· Histórico" : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading="Conteúdos">
                    {q.data?.posts.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={() => {
                          setSearchOpen(false);
                          setPost(p);
                        }}
                      >
                        <div>
                          <p>{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Conteúdo ·{" "}
                            {q.data.names.find((c) => c.id === p.client_id)?.name ?? "Interno"}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
      {post && <ReviewDialog post={post} onClose={() => setPost(null)} />}
      {create && clients.isLoading && <p className="p-2 text-xs">Carregando contas…</p>}
      {create && clients.error && (
        <p role="alert" className="p-2 text-xs">
          Falha ao carregar contas.{" "}
          <button onClick={() => void clients.refetch()}>Tentar novamente</button>
        </p>
      )}
      {clients.data && (
        <>
          <PostEditorSheet
            open={create === "post"}
            onOpenChange={(o) => {
              if (!o) setCreate("");
            }}
            post={null}
            clients={clients.data}
            initial={initial}
          />
          <TaskDialog
            open={create === "task"}
            onOpenChange={(o) => {
              if (!o) setCreate("");
            }}
            task={null}
            clients={clients.data}
            defaultClientId={validClientId}
          />
          <MeetingDialog
            open={create === "meeting"}
            onOpenChange={(o) => {
              if (!o) setCreate("");
            }}
            meeting={null}
            clients={clients.data}
            defaultClientId={validClientId}
          />
          <ClientFormDialog
            open={create === "client"}
            onOpenChange={(o) => {
              if (!o) setCreate("");
            }}
            client={null}
          />
        </>
      )}
    </QuickContext.Provider>
  );
}

export function QuickActions() {
  const context = useContext(QuickContext);
  if (!context) return null;
  return (
    <>
      {" "}
      <SidebarMenuButton
        tooltip="Buscar · Ctrl+K ou Cmd+K"
        onClick={() => {
          context.search();
        }}
      >
        <Search />
        <span>
          Buscar <kbd className="ml-2 text-xs text-muted-foreground">Ctrl K</kbd>
        </span>
      </SidebarMenuButton>
      {context.actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip="Criar"
              className="bg-primary text-white hover:bg-[#69139b] hover:text-white"
            >
              <Plus />
              <span>Criar</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            {context.actions.map(([key, label]) => (
              <DropdownMenuItem key={key} onSelect={() => context.create(key)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
