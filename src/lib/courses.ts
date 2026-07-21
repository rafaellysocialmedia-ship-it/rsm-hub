import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  thumbnail_url: string | null;
  category: string | null;
  level: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CourseLesson = {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  description: string | null;
  content_type: "video" | "pdf" | "text";
  video_url: string | null;
  file_url: string | null;
  text_content: string | null;
  duration_minutes: number | null;
  is_free_preview: boolean;
  sort_order: number;
};

export type CoursePurchase = {
  id: string;
  user_id: string;
  course_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "failed";
  provider: string | null;
  external_id: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
};

export const COURSE_LEVELS = ["Iniciante", "Intermediário", "Avançado"] as const;
export const COURSE_CATEGORIES = [
  "Gravação",
  "Roteiro",
  "Anúncios",
  "Materiais",
  "Copywriting",
  "Estratégia",
] as const;

export function formatPrice(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function signCourseAsset(path: string | null | undefined, expires = 3600) {
  if (!path) return null;
  // If it's already a full URL, return as-is
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("course-assets").createSignedUrl(path, expires);
  return data?.signedUrl ?? null;
}

export async function uploadCourseAsset(file: File, folder: "thumbnails" | "videos" | "files") {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("course-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
