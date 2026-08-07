import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Loader2, Paperclip, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStaffMembers } from "@/hooks/use-staff";
import { formatDateTime, type ClientInternalMessage } from "@/lib/client-master";
import { initials } from "@/lib/clients";
import { formatBytes, LIBRARY_BUCKET } from "@/lib/library";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, SectionCard } from "./master-shared";

type Attachment = { path: string; name: string; mime: string | null; size: number };

export function InternalChatTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff = [] } = useStaffMembers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: messages = [] } = useQuery({
    queryKey: ["client-internal-chat", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_internal_messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ClientInternalMessage[];
    },
  });

  const mentionMap = useMemo(() => {
    const m = new Map<string, string>();
    staff.forEach((s) => {
      const handle = (s.name || s.email || s.id).split(" ")[0].toLowerCase();
      m.set(handle, s.id);
    });
    return m;
  }, [staff]);

  const send = useMutation({
    mutationFn: async () => {
      const text = content.trim();
      if (!text && pending.length === 0) throw new Error("Escreva uma mensagem");
      const mentions = Array.from(text.matchAll(/@([\p{L}\p{N}._-]+)/gu))
        .map((match) => mentionMap.get(match[1].toLowerCase()))
        .filter((id): id is string => !!id);
      const { error } = await supabase.from("client_internal_messages").insert({
        client_id: clientId,
        author_id: user!.id,
        content: text,
        mentions,
        attachments: pending as never,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-internal-chat", clientId] });
      setContent("");
      setPending([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_internal_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-internal-chat", clientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = `client-chat/${clientId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file);
      if (error) throw error;
      setPending((p) => [
        ...p,
        { path, name: file.name, mime: file.type || null, size: file.size },
      ]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage
      .from(LIBRARY_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <SectionCard
      title="Chat interno"
      description="Conversa exclusiva da equipe — nunca visível ao cliente."
    >
      <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <EmptyState>Nenhuma mensagem ainda. Comece a conversa da equipe.</EmptyState>
        ) : (
          messages.map((m) => {
            const author = staff.find((s) => s.id === m.author_id);
            const atts = (m.attachments as unknown as Attachment[]) ?? [];
            return (
              <div key={m.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  {author?.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
                  <AvatarFallback className="bg-gradient-brand text-[10px] text-white">
                    {initials(author?.name ?? author?.email ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {author?.name || author?.email || "Colaborador"}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(m.created_at)}
                    </span>
                    {m.author_id === user?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => remove.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {m.content && (
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                      {m.content}
                    </p>
                  )}
                  {(m.mentions ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(m.mentions ?? []).map((id) => {
                        const p = staff.find((s) => s.id === id);
                        return (
                          <Badge key={id} variant="outline" className="text-[10px]">
                            <AtSign className="mr-1 h-3 w-3" />
                            {p?.name || p?.email || id.slice(0, 8)}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {atts.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {atts.map((a) => (
                        <li key={a.path}>
                          <button
                            onClick={() => openAttachment(a.path)}
                            className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            <Paperclip className="h-3 w-3" />
                            {a.name}
                            <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pending.map((a) => (
              <Badge key={a.path} variant="secondary" className="text-[10px]">
                <Paperclip className="mr-1 h-3 w-3" />
                {a.name}
              </Badge>
            ))}
          </div>
        )}
        <Textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva uma mensagem… use @nome para marcar alguém"
        />
        <div className="flex items-center justify-between">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="mr-2 h-4 w-4" />
            )}
            Anexar
          </Button>
          <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
            <Send className="mr-2 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
