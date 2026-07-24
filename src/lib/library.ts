import type { Database } from "@/integrations/supabase/types";
import {
  Image, Video, FileText, Palette, Sparkles, ClipboardList,
  FileSignature, BarChart3, Folder, File as FileIcon, Music, Archive,
} from "lucide-react";

export type FileRow = Database["public"]["Tables"]["files"]["Row"];
export type FileInsert = Database["public"]["Tables"]["files"]["Insert"];
export type FolderRow = Database["public"]["Tables"]["file_folders"]["Row"];
export type FileCategory = Database["public"]["Enums"]["file_category"] | "projeto_perfil";


export const FILE_CATEGORIES: {
  value: FileCategory;
  label: string;
  icon: typeof Image;
  tone: string;
}[] = [
  { value: "logos", label: "Logos", icon: Sparkles, tone: "text-violet-500 bg-violet-500/10" },
  { value: "fotos", label: "Fotos", icon: Image, tone: "text-pink-500 bg-pink-500/10" },
  { value: "videos", label: "Vídeos", icon: Video, tone: "text-rose-500 bg-rose-500/10" },
  { value: "criativos", label: "Criativos", icon: Palette, tone: "text-amber-500 bg-amber-500/10" },
  { value: "documentos", label: "Documentos", icon: FileText, tone: "text-slate-500 bg-slate-500/10" },
  { value: "branding", label: "Branding", icon: Sparkles, tone: "text-indigo-500 bg-indigo-500/10" },
  { value: "briefing", label: "Briefing", icon: ClipboardList, tone: "text-sky-500 bg-sky-500/10" },
  { value: "contrato", label: "Contrato", icon: FileSignature, tone: "text-emerald-500 bg-emerald-500/10" },
  { value: "relatorios", label: "Relatórios", icon: BarChart3, tone: "text-blue-500 bg-blue-500/10" },
  { value: "projeto_perfil", label: "Projeto de Perfil", icon: Sparkles, tone: "text-fuchsia-500 bg-fuchsia-500/10" },
];

export function categoryMeta(c: FileCategory) {
  return FILE_CATEGORIES.find((x) => x.value === c) ?? FILE_CATEGORIES[4];
}

export function inferCategory(mime: string | null, name: string): FileCategory {
  const m = (mime ?? "").toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (m.startsWith("image/")) return "fotos";
  if (m.startsWith("video/")) return "videos";
  if (m === "application/pdf" || ["pdf","doc","docx","txt","md"].includes(ext)) return "documentos";
  if (["psd","ai","fig","sketch","xd"].includes(ext)) return "criativos";
  return "documentos";
}

export function fileIconFor(mime: string | null, name: string) {
  const m = (mime ?? "").toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (m.startsWith("image/")) return Image;
  if (m.startsWith("video/")) return Video;
  if (m.startsWith("audio/")) return Music;
  if (["zip","rar","7z","tar","gz"].includes(ext)) return Archive;
  if (m === "application/pdf" || ["pdf","doc","docx","txt","md"].includes(ext)) return FileText;
  return FileIcon;
}

export function isImage(mime: string | null) {
  return (mime ?? "").toLowerCase().startsWith("image/");
}
export function isVideo(mime: string | null) {
  return (mime ?? "").toLowerCase().startsWith("video/");
}
export function isAudio(mime: string | null) {
  return (mime ?? "").toLowerCase().startsWith("audio/");
}
export function isPdf(mime: string | null) {
  return (mime ?? "").toLowerCase() === "application/pdf";
}

export function formatBytes(b: number) {
  if (!b) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export const LIBRARY_BUCKET = "library-files";

export { Folder };
