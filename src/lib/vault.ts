import { supabase } from "@/integrations/supabase/client";

export const VAULT_BUCKET = "vault-attachments";

export type VaultCredential = {
  id: string;
  client_id: string | null;
  platform: string;
  username: string;
  url: string | null;
  notes: string | null;
  has_2fa: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultAttachment = {
  id: string;
  credential_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  label: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type VaultHistoryEntry = {
  id: string;
  credential_id: string;
  changed_by: string | null;
  action: "created" | "updated" | "password_changed" | "viewed";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

// Typed proxies (vault tables/RPCs may not be in generated types yet)
const sb = supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
  rpc: (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
  channel: typeof supabase.channel;
  removeChannel: typeof supabase.removeChannel;
};

export async function listCredentials(): Promise<VaultCredential[]> {
  const { data, error } = await sb
    .from("vault_credentials")
    .select("id, client_id, platform, username, url, notes, created_by, created_at, updated_at")
    .order("platform", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as VaultCredential[];
}

export async function listHistory(credentialId: string): Promise<VaultHistoryEntry[]> {
  const { data, error } = await sb
    .from("vault_credential_history")
    .select("*")
    .eq("credential_id", credentialId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VaultHistoryEntry[];
}

export async function createCredential(input: {
  platform: string; username: string; password: string;
  url?: string | null; notes?: string | null; client_id?: string | null;
}) {
  const { data, error } = await sb.rpc("vault_create_credential", {
    _platform: input.platform,
    _username: input.username,
    _password: input.password,
    _url: input.url ?? null,
    _notes: input.notes ?? null,
    _client_id: input.client_id ?? null,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function updateCredential(input: {
  id: string; platform: string; username: string;
  password?: string | null; url: string | null; notes: string | null; client_id: string | null;
}) {
  const { error } = await sb.rpc("vault_update_credential", {
    _id: input.id,
    _platform: input.platform,
    _username: input.username,
    _password: input.password ?? null,
    _url: input.url,
    _notes: input.notes,
    _client_id: input.client_id,
  });
  if (error) throw error;
}

export async function revealPassword(id: string): Promise<string> {
  const { data, error } = await sb.rpc("vault_reveal_password", { _id: id });
  if (error) throw error;
  return data as unknown as string;
}

export async function deleteCredential(id: string) {
  const { error } = await sb.from("vault_credentials").delete().eq("id", id);
  if (error) throw error;
}

export async function listAttachments(credentialId: string): Promise<VaultAttachment[]> {
  const { data, error } = await sb
    .from("vault_attachments")
    .select("*")
    .eq("credential_id", credentialId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VaultAttachment[];
}

export async function uploadAttachment(credentialId: string, file: File, label?: string) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${credentialId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(VAULT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await sb.from("vault_attachments").insert({
    credential_id: credentialId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    label: label ?? null,
    uploaded_by: u.user?.id ?? null,
  } as never);
  if (error) throw error;
}

export async function deleteAttachment(att: VaultAttachment) {
  await supabase.storage.from(VAULT_BUCKET).remove([att.storage_path]);
  const { error } = await sb.from("vault_attachments").delete().eq("id", att.id);
  if (error) throw error;
}

export async function attachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(VAULT_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function platformInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

export function platformTone(name: string) {
  const palette = [
    "bg-violet-500/10 text-violet-500",
    "bg-pink-500/10 text-pink-500",
    "bg-emerald-500/10 text-emerald-500",
    "bg-sky-500/10 text-sky-500",
    "bg-amber-500/10 text-amber-500",
    "bg-rose-500/10 text-rose-500",
    "bg-indigo-500/10 text-indigo-500",
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
