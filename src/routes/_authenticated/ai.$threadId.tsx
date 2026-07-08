import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ThreadList } from "@/components/ai/thread-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  component: AiThreadPage,
});

function AiThreadPage() {
  const { threadId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, session } = useAuth();

  const { data: threads = [] } = useQuery({
    queryKey: ["ai-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_threads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: initialMessages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["ai-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => row.content as unknown as UIMessage);
    },
  });

  const createThread = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const { data, error } = await supabase
        .from("ai_threads")
        .insert({ user_id: user.id, title: "Nova conversa" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["ai-threads"] });
      nav({ to: "/ai/$threadId", params: { threadId: t.id } });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_threads").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["ai-threads"] });
      if (id === threadId) nav({ to: "/ai" });
    },
  });

  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      <ThreadList
        threads={threads}
        activeId={threadId}
        onNew={() => createThread.mutate()}
        onDelete={(id) => deleteThread.mutate(id)}
      />
      {msgsLoading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ChatWindow
          threadId={threadId}
          initial={initialMessages}
          token={session?.access_token}
          onFirstMessage={(text) => renameThreadIfNeeded(threadId, text, qc)}
        />
      )}
    </div>
  );
}

async function renameThreadIfNeeded(threadId: string, firstText: string, qc: ReturnType<typeof useQueryClient>) {
  const { data } = await supabase.from("ai_threads").select("title").eq("id", threadId).maybeSingle();
  if (data?.title && data.title !== "Nova conversa") return;
  const title = firstText.trim().slice(0, 60);
  if (!title) return;
  await supabase.from("ai_threads").update({ title }).eq("id", threadId);
  qc.invalidateQueries({ queryKey: ["ai-threads"] });
}

function ChatWindow({
  threadId,
  initial,
  token,
  onFirstMessage,
}: {
  threadId: string;
  initial: UIMessage[];
  token?: string;
  onFirstMessage: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
        body: { threadId },
      }),
    [token, threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message || "Erro na IA"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status === "ready"]);

  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    if (messages.length === 0) onFirstMessage(text);
    setInput("");
    void sendMessage({ text });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <p>Como posso ajudar? Peça ideias, roteiros, legendas, hashtags...</p>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((m) => (
            <MessageRow key={m.id} m={m} />
          ))}
          {status === "submitted" && (
            <div className="flex gap-3 text-sm text-muted-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <span className="animate-pulse pt-1">Pensando...</span>
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {error.message}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border bg-card p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escreva sua mensagem..."
            rows={2}
            className="min-h-[52px] resize-none"
            disabled={busy}
          />
          <Button size="icon" onClick={submit} disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
          A IA pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}

function MessageRow({ m }: { m: UIMessage }) {
  const isUser = m.role === "user";
  const text = m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-muted" : "bg-primary/10",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ol:my-2 prose-ul:my-2 prose-headings:mt-3 prose-headings:mb-1">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
