import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, KeyRound, Pencil, Plus } from "lucide-react";

import { listHistory, type VaultCredential, type VaultHistoryEntry } from "@/lib/vault";

const ACTION_META: Record<VaultHistoryEntry["action"], { label: string; icon: typeof Eye; tone: string }> = {
  created: { label: "Criada", icon: Plus, tone: "text-emerald-500 bg-emerald-500/10" },
  updated: { label: "Atualizada", icon: Pencil, tone: "text-sky-500 bg-sky-500/10" },
  password_changed: { label: "Senha alterada", icon: KeyRound, tone: "text-amber-500 bg-amber-500/10" },
  viewed: { label: "Visualização", icon: Eye, tone: "text-muted-foreground bg-muted" },
};

export function HistorySheet({
  credential, open, onOpenChange,
}: {
  credential: VaultCredential | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["vault-history", credential?.id],
    queryFn: () => listHistory(credential!.id),
    enabled: !!credential && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Histórico de alterações</SheetTitle>
          <SheetDescription>
            {credential ? `${credential.platform} · ${credential.username}` : ""}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-6 mt-4 h-[calc(100vh-9rem)] px-6">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && history.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
          )}
          <ol className="relative space-y-4 border-l border-border pl-5">
            {history.map((h) => {
              const meta = ACTION_META[h.action];
              const Icon = meta.icon;
              return (
                <li key={h.id} className="relative">
                  <span className={`absolute -left-[1.62rem] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.tone}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  {h.field && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Campo: <span className="font-medium text-foreground">{h.field}</span>
                    </p>
                  )}
                  {h.action === "updated" && (h.old_value || h.new_value) && (
                    <div className="mt-1.5 space-y-1 text-xs">
                      {h.old_value && (
                        <div className="rounded-md bg-rose-500/5 px-2 py-1 font-mono text-rose-600 line-through dark:text-rose-300">
                          {h.old_value}
                        </div>
                      )}
                      {h.new_value && (
                        <div className="rounded-md bg-emerald-500/5 px-2 py-1 font-mono text-emerald-600 dark:text-emerald-300">
                          {h.new_value}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
