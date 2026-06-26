import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientStatus = Database["public"]["Enums"]["client_status"];

export const CLIENT_STATUS: { value: ClientStatus; label: string; tone: string }[] = [
  { value: "active", label: "Ativo", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "paused", label: "Pausado", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "prospect", label: "Prospect", tone: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  { value: "inactive", label: "Inativo", tone: "bg-muted text-muted-foreground border-border" },
];

export function statusMeta(status: ClientStatus) {
  return CLIENT_STATUS.find((s) => s.value === status) ?? CLIENT_STATUS[0];
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
