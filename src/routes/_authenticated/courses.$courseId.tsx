import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock, PlayCircle, ArrowLeft, GraduationCap, FileText, Video, BookOpen, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice, signCourseAsset, type Course, type CourseModule, type CourseLesson } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Curso · Social Media Hub" },
      { name: "description", content: "Acesse o conteúdo do curso." },
    ],
  }),
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = useParams({ from: "/_authenticated/courses/$courseId" });
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole("administrator");
  const [selectedLesson, setSelectedLesson] = useState<CourseLesson | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: async (): Promise<Course | null> => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
      if (error) throw error;
      return data as Course | null;
    },
  });

  const modulesQuery = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async (): Promise<CourseModule[]> => {
      const { data, error } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CourseModule[];
    },
  });

  const lessonsQuery = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async (): Promise<CourseLesson[]> => {
      const { data, error } = await supabase
        .from("course_lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CourseLesson[];
    },
  });

  const purchaseStatusQuery = useQuery({
    queryKey: ["course-purchase-status", courseId, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<"paid" | "pending" | null> => {
      const { data, error } = await supabase
        .from("course_purchases")
        .select("status")
        .eq("user_id", user!.id)
        .eq("course_id", courseId)
        .in("status", ["paid", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.status === "paid" || data?.status === "pending" ? data.status : null;
    },
  });

  const requestAccess = useMutation({
    mutationFn: async (course: Course) => {
      if (!user) throw new Error("Sessão expirada");
      const isFree = course.price_cents === 0;
      const { error } = await supabase.from("course_purchases").insert({
        user_id: user.id,
        course_id: course.id,
        amount_cents: course.price_cents,
        currency: course.currency,
        status: isFree ? "paid" : "pending",
        provider: isFree ? "free" : "manual_request",
        paid_at: isFree ? new Date().toISOString() : null,
        note: isFree ? "Acesso gratuito" : "Solicitação enviada pelo cliente",
      });
      if (error) throw error;
      return isFree;
    },
    onSuccess: (isFree) => {
      void queryClient.invalidateQueries({
        queryKey: ["course-purchase-status", courseId, user?.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["courses-owned", user?.id] });
      setCheckoutOpen(false);
      toast.success(
        isFree
          ? "Acesso liberado. Bom curso!"
          : "Solicitação enviada. A equipe entrará em contato.",
      );
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível solicitar acesso"),
  });

  const owned = purchaseStatusQuery.data === "paid";
  const requestPending = purchaseStatusQuery.data === "pending";
  const canAccess = owned || isAdmin;

  const lessonsByModule = useMemo(() => {
    const map = new Map<string, CourseLesson[]>();
    for (const l of lessonsQuery.data ?? []) {
      const arr = map.get(l.module_id) ?? [];
      arr.push(l);
      map.set(l.module_id, arr);
    }
    return map;
  }, [lessonsQuery.data]);

  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [signedFileUrl, setSignedFileUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSigned() {
      if (!selectedLesson) {
        setSignedVideoUrl(null);
        setSignedFileUrl(null);
        return;
      }
      const [v, f] = await Promise.all([
        signCourseAsset(selectedLesson.video_url),
        signCourseAsset(selectedLesson.file_url),
      ]);
      if (!cancelled) {
        setSignedVideoUrl(v);
        setSignedFileUrl(f);
      }
    }
    loadSigned();
    return () => {
      cancelled = true;
    };
  }, [selectedLesson]);

  if (courseQuery.isLoading) {
    return <div className="p-6"><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>;
  }

  const course = courseQuery.data;
  if (!course) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Curso não encontrado.</p>
        <Button asChild variant="link"><Link to="/courses">Voltar</Link></Button>
      </div>
    );
  }

  const modules = modulesQuery.data ?? [];
  const totalLessons = (lessonsQuery.data ?? []).length;

  return (
    <div className="space-y-6 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/courses"><ArrowLeft className="mr-1 h-4 w-4" /> Todos os cursos</Link>
      </Button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-fuchsia-500/20 via-purple-500/20 to-blue-500/20">
            {selectedLesson && canAccess && signedVideoUrl && selectedLesson.content_type === "video" ? (
              <video src={signedVideoUrl} controls className="h-full w-full" />
            ) : course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <GraduationCap className="h-16 w-16 text-white/70" />
              </div>
            )}
          </div>

          {selectedLesson && canAccess ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedLesson.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedLesson.description && (
                  <p className="text-sm text-muted-foreground">{selectedLesson.description}</p>
                )}
                {selectedLesson.content_type === "text" && selectedLesson.text_content && (
                  <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                    {selectedLesson.text_content}
                  </div>
                )}
                {signedFileUrl && (
                  <Button asChild variant="outline">
                    <a href={signedFileUrl} target="_blank" rel="noreferrer">
                      <FileText className="mr-1 h-4 w-4" /> Baixar material
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {course.category && <Badge variant="secondary">{course.category}</Badge>}
                {course.level && <Badge variant="outline">{course.level}</Badge>}
                {course.duration_minutes && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration_minutes}min</span>
                )}
                <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {totalLessons} lições</span>
              </div>
              {course.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {course.description}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!canAccess && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acesse o curso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold">
                  {course.price_cents === 0 ? "Grátis" : formatPrice(course.price_cents, course.currency)}
                </div>
                <Button
                  className="w-full"
                  onClick={() => setCheckoutOpen(true)}
                  disabled={requestPending}
                >
                  {requestPending ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  {requestPending
                    ? "Solicitação enviada"
                    : course.price_cents === 0
                      ? "Liberar acesso grátis"
                      : "Solicitar acesso"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {requestPending
                    ? "A equipe analisará sua solicitação e entrará em contato."
                    : "Acesso vitalício ao conteúdo após a liberação."}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Conteúdo do curso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {modules.length === 0 && (
                <p className="text-sm text-muted-foreground">Módulos serão adicionados em breve.</p>
              )}
              {modules.map((m) => {
                const lessons = lessonsByModule.get(m.id) ?? [];
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="text-sm font-semibold">{m.title}</div>
                    <ul className="space-y-1">
                      {lessons.map((l) => {
                        const unlocked = canAccess || l.is_free_preview;
                        const isActive = selectedLesson?.id === l.id;
                        return (
                          <li key={l.id}>
                            <button
                              disabled={!unlocked}
                              onClick={() => setSelectedLesson(l)}
                              className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                                isActive ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
                              } ${!unlocked ? "opacity-60" : ""}`}
                            >
                              {unlocked ? (
                                l.content_type === "video" ? <PlayCircle className="h-3.5 w-3.5 shrink-0" /> :
                                l.content_type === "pdf" ? <FileText className="h-3.5 w-3.5 shrink-0" /> :
                                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <Lock className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="flex-1 truncate">{l.title}</span>
                              {l.is_free_preview && !canAccess && (
                                <Badge variant="outline" className="h-4 px-1 text-[9px]">preview</Badge>
                              )}
                              {l.duration_minutes && (
                                <span className="text-muted-foreground">{l.duration_minutes}m</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {course.price_cents === 0 ? "Liberar acesso gratuito" : "Solicitar acesso"}
            </DialogTitle>
            <DialogDescription>
              {course.price_cents === 0
                ? "Confirme para liberar este curso imediatamente na sua conta."
                : `Envie sua solicitação para a equipe. O valor do curso é ${formatPrice(
                    course.price_cents,
                    course.currency,
                  )}.`}
            </DialogDescription>
          </DialogHeader>
          {course.price_cents > 0 && (
            <p className="text-sm text-muted-foreground">
              A equipe poderá combinar a forma de pagamento e liberar o conteúdo pelo painel
              administrativo.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => requestAccess.mutate(course)}
              disabled={requestAccess.isPending}
            >
              {requestAccess.isPending
                ? "Enviando..."
                : course.price_cents === 0
                  ? "Liberar agora"
                  : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
