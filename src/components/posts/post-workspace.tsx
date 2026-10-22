import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PostEditorSheet, type EditorController } from "./post-editor-sheet";
import { ReviewDialog } from "@/components/approval/review-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Post } from "@/lib/posts";
import type { Client } from "@/lib/clients";

export function refreshPostViews(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({
    predicate: (q) => /post|approval|navigation-count|delivery/.test(String(q.queryKey[0])),
  });
}
type Workspace = {
  openPost: (post: Post) => void;
  canEdit: boolean;
  canCreate: boolean;
  createPost: (initial: Partial<Post>) => void;
  movePost: (post: Post, date: string, time?: string | null) => Promise<boolean>;
};
const Context = createContext<Workspace | null>(null);
export function usePostWorkspace() {
  const value = useContext(Context);
  if (!value) throw Error("Editor fora da área autenticada");
  return value;
}
export function PostWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [post, setPost] = useState<Post | null>(null);
  const [draft, setDraft] = useState<{ value: Partial<Post>; id: number } | null>(null);
  const active = !!post || !!draft;
  const [review, setReview] = useState<Post | null>(null);
  const [minimized, setMinimized] = useState(false);
  const controller = useRef<EditorController | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const loadSequence = useRef(0);
  const minimizedButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!active || minimized || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active, minimized, mobile]);
  useEffect(() => {
    if (minimized) minimizedButton.current?.focus();
  }, [minimized]);
  const permission = useQuery({
    queryKey: ["calendar-edit-permission", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_edit_calendar");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
  const canEdit = permission.data === true;
  const createPermission = useQuery({
    queryKey: ["calendar-create-permission", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_create_calendar");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
  const canCreate = createPermission.data === true;
  const createPost = (initial: Partial<Post>) => {
    if (!canCreate) {
      toast.error("Sem permissão para criar publicações.");
      return;
    }
    opener.current = document.activeElement as HTMLElement;
    const id = ++loadSequence.current;
    const replace = () => {
      setPost(null);
      setDraft({ value: initial, id });
      setMinimized(false);
    };
    if (controller.current) controller.current.request(replace);
    else replace();
  };
  const clients = useQuery({
    queryKey: ["editor-clients", user?.id],
    enabled: canEdit || canCreate,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
  const openPost = (next: Post) => {
    if (permission.isPending) {
      toast.info("Verificando permissão…");
      return;
    }
    if (permission.error) {
      toast.error("Não foi possível verificar a permissão de edição.");
      return;
    }
    if (!canEdit) {
      setReview(next);
      return;
    }
    if (post?.id === next.id) {
      setMinimized(false);
      return;
    }
    opener.current = document.activeElement as HTMLElement;
    const sequence = ++loadSequence.current;
    const load = async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", next.id).single();
      if (sequence !== loadSequence.current) return;
      if (error) {
        toast.error("Não foi possível abrir a publicação.");
        return;
      }
      const replace = () => {
        setPost(data);
        setDraft(null);
        setMinimized(false);
      };
      if (controller.current) controller.current.request(replace);
      else replace();
    };
    void load();
  };
  const movePost = async (
    target: Post,
    date: string,
    time = target.scheduled_time,
  ): Promise<boolean> => {
    if (!canEdit) {
      toast.error("Sem permissão para reagendar.");
      return false;
    }
    const current = post?.id === target.id ? controller.current : null;
    const previous = current?.schedule() ?? {
      scheduled_date: target.scheduled_date,
      scheduled_time: target.scheduled_time,
      updated_at: target.updated_at,
    };
    if (previous.scheduled_date === date && previous.scheduled_time === time) return true;
    try {
      const { data, error } = await supabase.rpc("save_calendar_post", {
        _post_id: target.id,
        _expected_updated_at: previous.updated_at,
        _patch: { scheduled_date: date, scheduled_time: time },
      });
      if (error) throw error;
      const saved = data as unknown as Post;
      current?.reconcile(saved);
      await refreshPostViews(qc);
      toast.success(
        `Data atualizada: ${date.split("-").reverse().join("/")} ${time?.slice(0, 5) ?? "sem horário"}${saved.status === "review" ? " · nova revisão necessária" : ""}`,
        {
          duration: 10000,
          action: {
            label: "Desfazer",
            onClick: async () => {
              const r = await supabase.rpc("save_calendar_post", {
                _post_id: target.id,
                _expected_updated_at: saved.updated_at,
                _patch: {
                  scheduled_date: previous.scheduled_date,
                  scheduled_time: previous.scheduled_time,
                },
              });
              if (r.error) {
                toast.error(`Não foi possível desfazer: ${r.error.message}`);
                return;
              }
              if (controller.current?.id === target.id)
                controller.current.reconcile(r.data as unknown as Post);
              await refreshPostViews(qc);
              toast.success("Data anterior restaurada. A aprovação continua sujeita à revisão.");
            },
          },
        },
      );
      return true;
    } catch (error) {
      toast.error(
        (error as Error).message || "Não foi possível mover. A data anterior foi mantida.",
      );
      return false;
    }
  };
  const close = () => {
    setPost(null);
    setDraft(null);
    ++loadSequence.current;
    controller.current = null;
    if (opener.current?.isConnected) opener.current.focus();
  };
  return (
    <Context.Provider value={{ openPost, canEdit, canCreate, createPost, movePost }}>
      <div
        inert={active && !minimized && mobile}
        className={`min-w-0 w-full ${active && !minimized ? "min-[1600px]:pr-[480px]" : ""}`}
      >
        {children}
      </div>
      {active && (
        <PostEditorSheet
          key={`${user?.id}:${post?.id ?? draft?.id}`}
          open
          post={post}
          initial={draft?.value}
          onCreated={(saved) => {
            setPost(saved);
            setDraft(null);
          }}
          clients={clients.data ?? []}
          onOpenChange={(v) => {
            if (!v) close();
          }}
          persistent
          readOnly={post ? !canEdit : !canCreate}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onController={(value) => {
            controller.current = value;
          }}
        />
      )}
      {active && minimized && (
        <div className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-lg border bg-card p-2 shadow-sm">
          <Button
            ref={minimizedButton}
            variant="ghost"
            className="min-w-0 max-w-72 text-left"
            onClick={() => setMinimized(false)}
          >
            <span className="truncate">
              {post?.title ?? "Nova publicação"} ·{" "}
              {clients.data?.find((c) => c.id === (post?.client_id ?? draft?.value.client_id))
                ?.name ?? "Conta original"}
            </span>
          </Button>
          <Button
            variant="ghost"
            aria-label="Fechar editor"
            onClick={() => controller.current?.request(close)}
          >
            Fechar
          </Button>
        </div>
      )}
      {review && <ReviewDialog key={review.id} post={review} onClose={() => setReview(null)} />}
    </Context.Provider>
  );
}
