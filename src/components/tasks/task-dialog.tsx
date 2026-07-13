import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Paperclip, Plus, Repeat, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { useAuth } from "@/hooks/use-auth";
import {
  PRIORITY_META,
  STATUS_COLUMNS,
  addChecklistItem,
  addComment,
  createTask,
  deleteTask,
  listChecklist,
  listComments,
  listFiles,
  removeChecklistItem,
  removeFile,
  signedUrl,
  toggleChecklistItem,
  updateTask,
  uploadTaskFile,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import type { Client } from "@/lib/clients";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task | null;
  defaultStatus?: TaskStatus;
  clients: Client[];
};

export function TaskDialog({ open, onOpenChange, task, defaultStatus = "todo", clients }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [clientId, setClientId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");
  const [recFreq, setRecFreq] = useState<"none" | "daily" | "weekly" | "biweekly" | "monthly">("none");
  const [recCount, setRecCount] = useState<number>(4);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? defaultStatus);
      setPriority(task?.priority ?? "medium");
      setClientId(task?.client_id ?? "none");
      setDueDate(task?.due_date ? task.due_date.slice(0, 10) : "");
      const r = (task as unknown as { recurrence?: { frequency?: string; count?: number } } | null)?.recurrence;
      setRecFreq((r?.frequency as typeof recFreq) ?? "none");
      setRecCount(r?.count ?? 4);
    }
  }, [open, task, defaultStatus]);

  const checklist = useQuery({
    queryKey: ["task-checklist", task?.id],
    queryFn: () => listChecklist(task!.id),
    enabled: !!task && open,
  });
  const comments = useQuery({
    queryKey: ["task-comments", task?.id],
    queryFn: () => listComments(task!.id),
    enabled: !!task && open,
  });
  const files = useQuery({
    queryKey: ["task-files", task?.id],
    queryFn: () => listFiles(task!.id),
    enabled: !!task && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const recurrence = recFreq === "none" ? null : { frequency: recFreq, count: recCount };
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        client_id: clientId === "none" ? null : clientId,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        recurrence,
      } as Partial<Task>;
      if (!payload.title) throw new Error("Título obrigatório");
      if (isEdit && task) {
        await updateTask(task.id, payload);
      } else {
        await createTask({ ...payload, created_by: user?.id ?? null });
        // Spawn extra occurrences
        if (recFreq !== "none" && dueDate && recCount > 1) {
          const extras = buildTaskRecurrenceDates(dueDate, recFreq, recCount).slice(1);
          for (const d of extras) {
            await createTask({
              ...payload,
              recurrence: null,
              due_date: new Date(d).toISOString(),
              created_by: user?.id ?? null,
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(isEdit ? "Tarefa atualizada" : "Tarefa criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteTask(task!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída");
      onOpenChange(false);
    },
  });

  const [newChecklist, setNewChecklist] = useState("");
  const addItem = useMutation({
    mutationFn: () =>
      addChecklistItem(task!.id, newChecklist.trim(), (checklist.data?.length ?? 0) + 1),
    onSuccess: () => {
      setNewChecklist("");
      qc.invalidateQueries({ queryKey: ["task-checklist", task?.id] });
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => toggleChecklistItem(id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", task?.id] }),
  });
  const delItem = useMutation({
    mutationFn: (id: string) => removeChecklistItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", task?.id] }),
  });

  const [newComment, setNewComment] = useState("");
  const postComment = useMutation({
    mutationFn: () => addComment(task!.id, user!.id, newComment.trim()),
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["task-comments", task?.id] });
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => uploadTaskFile(task!.id, file, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-files", task?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openFile = async (path: string) => {
    const url = await signedUrl(path);
    if (url) window.open(url, "_blank");
  };

  const removeFileMut = useMutation({
    mutationFn: (f: Parameters<typeof removeFile>[0]) => removeFile(f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-files", task?.id] }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Roteiro reels julho" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalhes da tarefa"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Recorrência</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={recFreq} onValueChange={(v) => setRecFreq(v as typeof recFreq)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
              {recFreq !== "none" && !isEdit && (
                <>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={recCount}
                    onChange={(e) => setRecCount(Number(e.target.value) || 1)}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">ocorrências (inclui esta)</span>
                </>
              )}
              {recFreq !== "none" && isEdit && (
                <span className="text-xs text-muted-foreground">Edite ocorrências individualmente</span>
              )}
            </div>
            {recFreq !== "none" && !dueDate && !isEdit && (
              <p className="text-xs text-amber-600">Defina um prazo para gerar as ocorrências.</p>
            )}
          </div>

          {isEdit && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Checklist</Label>
                <div className="space-y-1.5">
                  {(checklist.data ?? []).map((item) => (
                    <div key={item.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={(v) => toggle.mutate({ id: item.id, done: !!v })}
                      />
                      <span className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>
                        {item.content}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => delItem.mutate(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newChecklist}
                    onChange={(e) => setNewChecklist(e.target.value)}
                    placeholder="Adicionar item"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newChecklist.trim()) addItem.mutate();
                    }}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!newChecklist.trim()}
                    onClick={() => addItem.mutate()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Arquivos</Label>
                <div className="flex flex-wrap gap-2">
                  {(files.data ?? []).map((f) => (
                    <Badge key={f.id} variant="secondary" className="cursor-pointer gap-1 pl-2 pr-1">
                      <span onClick={() => openFile(f.storage_path)}>{f.name}</span>
                      <button
                        onClick={() => removeFileMut.mutate(f)}
                        className="ml-1 rounded p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload.mutate(f);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="mr-2 h-3.5 w-3.5" /> Enviar arquivo
                </Button>
              </div>

              <Separator />
              <div className="space-y-2">
                <Label>Comentários</Label>
                <div className="space-y-2">
                  {(comments.data ?? []).map((c) => (
                    <div key={c.id} className="rounded-md border border-border bg-muted/30 p-2 text-sm">
                      <div className="mb-1 text-[11px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                      </div>
                      <div>{c.content}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário..."
                    rows={2}
                  />
                  <Button
                    disabled={!newComment.trim()}
                    onClick={() => postComment.mutate()}
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-2 border-t border-border pt-4">
          {isEdit ? (
            <Button variant="ghost" className="text-destructive" onClick={() => remove.mutate()}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function buildTaskRecurrenceDates(start: string, freq: "daily" | "weekly" | "biweekly" | "monthly", count: number): string[] {
  const out: string[] = [start];
  const d = new Date(start + "T00:00:00");
  const n = Math.max(1, Math.min(52, count));
  for (let i = 1; i < n; i++) {
    if (freq === "daily") d.setDate(d.getDate() + 1);
    else if (freq === "weekly") d.setDate(d.getDate() + 7);
    else if (freq === "biweekly") d.setDate(d.getDate() + 14);
    else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
