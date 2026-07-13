import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "todo" | "production" | "waiting_client" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskRecurrence = {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  count?: number;
} | null;

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  client_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  created_by: string | null;
  recurrence: TaskRecurrence;
  source_post_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskChecklistItem = {
  id: string;
  task_id: string;
  content: string;
  done: boolean;
  position: number;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export type TaskFile = {
  id: string;
  task_id: string;
  storage_path: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export const STATUS_COLUMNS: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "todo", label: "A Fazer", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  { id: "production", label: "Produção", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  { id: "waiting_client", label: "Aguardando Cliente", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "review", label: "Revisão", tone: "bg-purple-500/15 text-purple-600 dark:text-purple-300" },
  { id: "done", label: "Concluído", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
];

export const PRIORITY_META: Record<TaskPriority, { label: string; tone: string; dot: string }> = {
  low: { label: "Baixa", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300", dot: "bg-slate-400" },
  medium: { label: "Média", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-300", dot: "bg-blue-500" },
  high: { label: "Alta", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  urgent: { label: "Urgente", tone: "bg-red-500/15 text-red-600 dark:text-red-300", dot: "bg-red-500" },
};

// Typed proxy since generated types may not yet include tasks tables
type SB = typeof supabase;
const sb = supabase as unknown as SB;

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await sb
    .from("tasks" as never)
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

export async function createTask(input: Partial<Task>): Promise<Task> {
  const { data, error } = await sb
    .from("tasks" as never)
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}

export async function updateTask(id: string, input: Partial<Task>): Promise<void> {
  const { error } = await sb.from("tasks" as never).update(input as never).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await sb.from("tasks" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function listChecklist(taskId: string): Promise<TaskChecklistItem[]> {
  const { data, error } = await sb
    .from("task_checklist" as never)
    .select("*")
    .eq("task_id", taskId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as unknown as TaskChecklistItem[];
}

export async function addChecklistItem(taskId: string, content: string, position: number) {
  const { error } = await sb
    .from("task_checklist" as never)
    .insert({ task_id: taskId, content, position } as never);
  if (error) throw error;
}

export async function toggleChecklistItem(id: string, done: boolean) {
  const { error } = await sb.from("task_checklist" as never).update({ done } as never).eq("id", id);
  if (error) throw error;
}

export async function removeChecklistItem(id: string) {
  const { error } = await sb.from("task_checklist" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function listComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await sb
    .from("task_comments" as never)
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TaskComment[];
}

export async function addComment(taskId: string, authorId: string, content: string) {
  const { error } = await sb
    .from("task_comments" as never)
    .insert({ task_id: taskId, author_id: authorId, content } as never);
  if (error) throw error;
}

export async function listFiles(taskId: string): Promise<TaskFile[]> {
  const { data, error } = await sb
    .from("task_files" as never)
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TaskFile[];
}

export async function uploadTaskFile(taskId: string, file: File, userId: string) {
  const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;
  const up = await supabase.storage.from("task-files").upload(path, file);
  if (up.error) throw up.error;
  const { error } = await sb.from("task_files" as never).insert({
    task_id: taskId,
    storage_path: path,
    name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: userId,
  } as never);
  if (error) throw error;
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("task-files").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function removeFile(file: TaskFile) {
  await supabase.storage.from("task-files").remove([file.storage_path]);
  await sb.from("task_files" as never).delete().eq("id", file.id);
}

export function isOverdue(t: Task) {
  return t.due_date && t.status !== "done" && new Date(t.due_date).getTime() < Date.now();
}

export function formatDue(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
