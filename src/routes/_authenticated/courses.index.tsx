import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, PlayCircle, Clock, GraduationCap, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type Course, type CoursePurchase } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Cursos · Social Media Hub" },
      { name: "description", content: "Acelere seus resultados com nossos cursos exclusivos." },
    ],
  }),
  component: CoursesCatalog,
});

function CoursesCatalog() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("administrator");

  const coursesQuery = useQuery({
    queryKey: ["courses", "catalog", isAdmin],
    queryFn: async (): Promise<Course[]> => {
      const q = supabase.from("courses").select("*").order("sort_order", { ascending: true });
      const { data, error } = isAdmin ? await q : await q.eq("is_published", true);
      if (error) throw error;
      return (data ?? []) as Course[];
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["course-purchases", "me", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CoursePurchase[]> => {
      const { data, error } = await supabase
        .from("course_purchases")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "paid");
      if (error) throw error;
      return (data ?? []) as CoursePurchase[];
    },
  });

  const ownedIds = useMemo(
    () => new Set((purchasesQuery.data ?? []).map((p) => p.course_id)),
    [purchasesQuery.data],
  );

  const courses = coursesQuery.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            Materiais exclusivos para elevar seus resultados no digital.
          </p>
        </div>
        {isAdmin && (
          <Button asChild variant="outline">
            <Link to="/admin/courses">Gerenciar cursos</Link>
          </Button>
        )}
      </div>

      {coursesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <GraduationCap className="mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="font-semibold">Nenhum curso disponível ainda</h3>
          <p className="text-sm text-muted-foreground">
            Novos cursos serão publicados em breve.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const owned = ownedIds.has(c.id);
            return (
              <Card key={c.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-purple-500/20 to-blue-500/20">
                  {c.thumbnail_url ? (
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <GraduationCap className="h-12 w-12 text-white/70" />
                    </div>
                  )}
                  {!owned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                      <Lock className="h-10 w-10 text-white" />
                    </div>
                  )}
                  {owned && (
                    <Badge className="absolute right-2 top-2 bg-emerald-500 text-white">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Comprado
                    </Badge>
                  )}
                  {!c.is_published && isAdmin && (
                    <Badge variant="secondary" className="absolute left-2 top-2">Rascunho</Badge>
                  )}
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.category && <span>{c.category}</span>}
                    {c.level && <span>• {c.level}</span>}
                    {c.duration_minutes && (
                      <span className="ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {c.duration_minutes}min
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base">{c.title}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {c.short_description || c.description || "—"}
                  </p>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t bg-muted/30 pt-3">
                  <div className="text-lg font-bold">
                    {c.price_cents === 0 ? "Grátis" : formatPrice(c.price_cents, c.currency)}
                  </div>
                  {owned ? (
                    <Button asChild size="sm">
                      <Link to="/courses/$courseId" params={{ courseId: c.id }}>
                        <PlayCircle className="mr-1 h-4 w-4" /> Assistir
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/courses/$courseId" params={{ courseId: c.id }}>
                        Ver detalhes
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
