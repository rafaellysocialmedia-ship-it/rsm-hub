import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, GraduationCap, DollarSign, TrendingUp, Users, Package,
  Video, FileText, BookOpen, Upload, ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  COURSE_CATEGORIES, COURSE_LEVELS, formatPrice, slugify, uploadCourseAsset,
  type Course, type CourseModule, type CourseLesson, type CoursePurchase,
} from "@/lib/courses";
import { useAuth } from "@/hooks/use-auth";

type CourseSale = CoursePurchase & {
  profiles: { name: string | null; email: string | null } | null;
  courses: { title: string } | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const Route = createFileRoute("/_authenticated/admin/courses/")({
  head: () => ({
    meta: [
      { title: "Gerenciar cursos · Admin" },
      { name: "description", content: "Crie, precifique e acompanhe vendas dos cursos." },
    ],
  }),
  component: AdminCoursesPage,
});

function AdminCoursesPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Course | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contentCourse, setContentCourse] = useState<Course | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);
  const [saleCourse, setSaleCourse] = useState<Course | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase.from("courses").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as Course[];
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["admin-purchases"],
    queryFn: async (): Promise<CourseSale[]> => {
      const { data: purchaseRows, error } = await supabase
        .from("course_purchases")
        .select("*, courses:course_id(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const purchases = (purchaseRows ?? []) as unknown as Array<
        CoursePurchase & { courses: { title: string } | null }
      >;
      const userIds = [...new Set(purchases.map((purchase) => purchase.user_id))];
      if (userIds.length === 0) return [];

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profiles = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
      return purchases.map((purchase) => ({
        ...purchase,
        profiles: profiles.get(purchase.user_id) ?? null,
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso excluído");
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setDeleteCourse(null);
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Erro ao excluir")),
  });

  const courses = coursesQuery.data ?? [];
  const purchases = useMemo(() => purchasesQuery.data ?? [], [purchasesQuery.data]);
  const paid = useMemo(() => purchases.filter((p) => p.status === "paid"), [purchases]);
  const revenueCents = paid.reduce((acc, p) => acc + p.amount_cents, 0);
  const avgTicket = paid.length ? revenueCents / paid.length : 0;

  const topCourses = useMemo(() => {
    const map = new Map<string, { title: string; count: number; revenue: number }>();
    for (const p of paid) {
      const key = p.course_id;
      const cur = map.get(key) ?? { title: p.courses?.title ?? "—", count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += p.amount_cents;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [paid]);

  if (!hasRole("administrator")) {
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciar Cursos</h1>
          <p className="text-sm text-muted-foreground">Crie, precifique e acompanhe as vendas.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/courses">
              <ExternalLink className="mr-1 h-4 w-4" /> Ver catálogo
            </Link>
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Novo curso
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo ({courses.length})</TabsTrigger>
          <TabsTrigger value="sales">Vendas ({paid.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {coursesQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <GraduationCap className="mb-3 h-12 w-12 text-muted-foreground" />
              <h3 className="font-semibold">Nenhum curso cadastrado</h3>
              <p className="mb-4 text-sm text-muted-foreground">Comece criando seu primeiro curso.</p>
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Criar curso
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Curso</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground">{c.short_description}</div>
                      </TableCell>
                      <TableCell>{c.category || "—"}</TableCell>
                      <TableCell>{c.price_cents === 0 ? "Grátis" : formatPrice(c.price_cents, c.currency)}</TableCell>
                      <TableCell>
                        {c.is_published ? (
                          <Badge className="bg-emerald-500 text-white">Publicado</Badge>
                        ) : (
                          <Badge variant="secondary">Rascunho</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setContentCourse(c)} title="Editar conteúdo">
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSaleCourse(c)} title="Registrar venda manual">
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteCourse(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard icon={DollarSign} label="Receita total" value={formatPrice(revenueCents)} />
            <StatCard icon={TrendingUp} label="Ticket médio" value={formatPrice(avgTicket)} />
            <StatCard icon={Users} label="Vendas" value={String(paid.length)} />
            <StatCard icon={Package} label="Cursos vendidos" value={String(topCourses.length)} />
          </div>

          {topCourses.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Top cursos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topCourses.map((t) => (
                    <div key={t.title} className="flex items-center justify-between text-sm">
                      <span>{t.title}</span>
                      <span className="text-muted-foreground">
                        {t.count} venda{t.count !== 1 ? "s" : ""} · {formatPrice(t.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de vendas</CardTitle></CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.profiles?.name || p.profiles?.email || "—"}</div>
                          <div className="text-xs text-muted-foreground">{p.profiles?.email}</div>
                        </TableCell>
                        <TableCell>{p.courses?.title ?? "—"}</TableCell>
                        <TableCell>{formatPrice(p.amount_cents, p.currency)}</TableCell>
                        <TableCell>
                          <PurchaseStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(p.paid_at || p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CourseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-courses"] });
          qc.invalidateQueries({ queryKey: ["courses"] });
        }}
      />

      <CourseContentSheet
        course={contentCourse}
        onClose={() => setContentCourse(null)}
      />

      <ManualSaleDialog
        course={saleCourse}
        onClose={() => setSaleCourse(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-purchases"] })}
      />

      <AlertDialog open={!!deleteCourse} onOpenChange={(o) => !o && setDeleteCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove <strong>{deleteCourse?.title}</strong>, todos os módulos, lições e vendas
              associadas. Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCourse && deleteMutation.mutate(deleteCourse.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PurchaseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: "Pago", className: "bg-emerald-500 text-white" },
    pending: { label: "Pendente", className: "bg-amber-500 text-white" },
    refunded: { label: "Reembolsado", className: "bg-slate-500 text-white" },
    failed: { label: "Falhou", className: "bg-destructive text-destructive-foreground" },
  };
  const meta = map[status] || { label: status, className: "" };
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

// ---------- Course create/edit dialog ----------
function CourseFormDialog({
  open, onOpenChange, course, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; course: Course | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Course>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setForm(
        course
          ? { ...course }
          : {
              title: "",
              slug: "",
              short_description: "",
              description: "",
              price_cents: 0,
              currency: "BRL",
              category: "",
              level: "",
              duration_minutes: null,
              is_published: false,
              sort_order: 0,
              thumbnail_url: "",
            },
      );
    }
  }, [open, course]);

  const set = <K extends keyof Course>(key: K, value: Course[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleUploadThumb = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadCourseAsset(file, "thumbnails");
      const { data } = await supabase.storage.from("course-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
      set("thumbnail_url", data?.signedUrl ?? path);
      toast.success("Thumbnail enviada");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro no upload"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title?.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    try {
      const payload = {
        title: form.title!.trim(),
        slug: (form.slug?.trim() || slugify(form.title!)) as string,
        short_description: form.short_description || null,
        description: form.description || null,
        price_cents: Number(form.price_cents) || 0,
        currency: form.currency || "BRL",
        thumbnail_url: form.thumbnail_url || null,
        category: form.category || null,
        level: form.level || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        is_published: !!form.is_published,
        sort_order: Number(form.sort_order) || 0,
      };
      if (course) {
        const { error } = await supabase.from("courses").update(payload).eq("id", course.id);
        if (error) throw error;
        toast.success("Curso atualizado");
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const { error } = await supabase.from("courses").insert({ ...payload, created_by: authData.user?.id });
        if (error) throw error;
        toast.success("Curso criado");
      }
      onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "Editar curso" : "Novo curso"}</DialogTitle>
          <DialogDescription>Configure preço, publicação e apresentação.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Título</Label>
            <Input
              value={form.title ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                set("title", v);
                if (!course && !form.slug) set("slug", slugify(v));
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Slug</Label>
            <Input value={form.slug ?? ""} onChange={(e) => set("slug", slugify(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição curta</Label>
            <Input value={form.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição completa</Label>
            <Textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>Preço (R$)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={form.price_cents ? (form.price_cents / 100).toString() : ""}
              onChange={(e) => set("price_cents", Math.round(Number(e.target.value || 0) * 100))}
            />
          </div>
          <div>
            <Label>Duração (min)</Label>
            <Input
              type="number" min="0"
              value={form.duration_minutes ?? ""}
              onChange={(e) => set("duration_minutes", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category ?? ""} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {COURSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nível</Label>
            <Select value={form.level ?? ""} onValueChange={(v) => set("level", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {COURSE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Thumbnail</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="URL ou faça upload"
                value={form.thumbnail_url ?? ""}
                onChange={(e) => set("thumbnail_url", e.target.value)}
              />
              <label className="cursor-pointer">
                <input
                  type="file" accept="image/*" hidden
                  onChange={(e) => e.target.files?.[0] && handleUploadThumb(e.target.files[0])}
                />
                <Button asChild variant="outline" disabled={uploading}>
                  <span><Upload className="mr-1 h-4 w-4" /> {uploading ? "Enviando…" : "Upload"}</span>
                </Button>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              checked={!!form.is_published}
              onCheckedChange={(v) => set("is_published", v)}
              id="publish"
            />
            <Label htmlFor="publish" className="cursor-pointer">
              Publicado (visível para clientes)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Modules + Lessons editor (sheet) ----------
function CourseContentSheet({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = !!course;
  const cid = course?.id;

  const modulesQuery = useQuery({
    queryKey: ["admin-modules", cid],
    enabled: !!cid,
    queryFn: async (): Promise<CourseModule[]> => {
      const { data, error } = await supabase.from("course_modules").select("*").eq("course_id", cid!).order("sort_order");
      if (error) throw error;
      return (data ?? []) as CourseModule[];
    },
  });

  const lessonsQuery = useQuery({
    queryKey: ["admin-lessons", cid],
    enabled: !!cid,
    queryFn: async (): Promise<CourseLesson[]> => {
      const { data, error } = await supabase.from("course_lessons").select("*").eq("course_id", cid!).order("sort_order");
      if (error) throw error;
      return (data ?? []) as CourseLesson[];
    },
  });

  const modules = modulesQuery.data ?? [];
  const lessons = lessonsQuery.data ?? [];
  const [editingLesson, setEditingLesson] = useState<{ moduleId: string; lesson: CourseLesson | null } | null>(null);

  const addModule = async () => {
    const title = window.prompt("Título do módulo:");
    if (!title || !cid) return;
    const { error } = await supabase.from("course_modules").insert({
      course_id: cid, title, sort_order: modules.length,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-modules", cid] });
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Excluir módulo e todas as suas lições?")) return;
    const { error } = await supabase.from("course_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-modules", cid] });
    qc.invalidateQueries({ queryKey: ["admin-lessons", cid] });
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Excluir lição?")) return;
    const { error } = await supabase.from("course_lessons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-lessons", cid] });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Conteúdo · {course?.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Button size="sm" onClick={addModule}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar módulo
          </Button>

          {modules.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum módulo ainda.</p>
          )}

          {modules.map((m) => {
            const ls = lessons.filter((l) => l.module_id === m.id);
            return (
              <Card key={m.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingLesson({ moduleId: m.id, lesson: null })}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteModule(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 pt-0">
                  {ls.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem lições. Clique em + para adicionar.</p>
                  ) : (
                    ls.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        {l.content_type === "video" ? <Video className="h-4 w-4" /> :
                          l.content_type === "pdf" ? <FileText className="h-4 w-4" /> :
                          <BookOpen className="h-4 w-4" />}
                        <span className="flex-1 truncate">{l.title}</span>
                        {l.is_free_preview && <Badge variant="outline" className="h-5 text-[10px]">preview</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => setEditingLesson({ moduleId: m.id, lesson: l })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteLesson(l.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <LessonDialog
          courseId={cid}
          state={editingLesson}
          onClose={() => setEditingLesson(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-lessons", cid] })}
          existingCount={lessons.length}
        />
      </SheetContent>
    </Sheet>
  );
}

function LessonDialog({
  courseId, state, onClose, onSaved, existingCount,
}: {
  courseId?: string;
  state: { moduleId: string; lesson: CourseLesson | null } | null;
  onClose: () => void;
  onSaved: () => void;
  existingCount: number;
}) {
  const [form, setForm] = useState<Partial<CourseLesson>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state) {
      setForm(
        state.lesson ?? {
          title: "",
          description: "",
          content_type: "video",
          video_url: "",
          file_url: "",
          text_content: "",
          duration_minutes: null,
          is_free_preview: false,
          sort_order: existingCount,
        },
      );
    }
  }, [state, existingCount]);

  const set = <K extends keyof CourseLesson>(key: K, value: CourseLesson[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleUpload = async (file: File, kind: "videos" | "files") => {
    setUploading(true);
    try {
      const path = await uploadCourseAsset(file, kind);
      set(kind === "videos" ? "video_url" : "file_url", path);
      toast.success("Arquivo enviado");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro no upload"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!state || !courseId) return;
    if (!form.title?.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    try {
      const payload = {
        course_id: courseId,
        module_id: state.moduleId,
        title: form.title!.trim(),
        description: form.description || null,
        content_type: form.content_type || "video",
        video_url: form.video_url || null,
        file_url: form.file_url || null,
        text_content: form.text_content || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        is_free_preview: !!form.is_free_preview,
        sort_order: Number(form.sort_order) || 0,
      };
      if (state.lesson) {
        const { error } = await supabase.from("course_lessons").update(payload).eq("id", state.lesson.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_lessons").insert(payload);
        if (error) throw error;
      }
      toast.success("Lição salva");
      onSaved();
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state?.lesson ? "Editar lição" : "Nova lição"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.content_type ?? "video"}
              onValueChange={(value) =>
                set("content_type", value as CourseLesson["content_type"])
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="pdf">PDF / Material</SelectItem>
                <SelectItem value="text">Texto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.content_type === "video" && (
            <div>
              <Label>Vídeo (URL ou upload)</Label>
              <div className="flex gap-2">
                <Input value={form.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} />
                <label className="cursor-pointer">
                  <input type="file" accept="video/*" hidden
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "videos")} />
                  <Button asChild variant="outline" disabled={uploading}>
                    <span><Upload className="mr-1 h-4 w-4" />{uploading ? "…" : ""}</span>
                  </Button>
                </label>
              </div>
            </div>
          )}
          {form.content_type === "pdf" && (
            <div>
              <Label>Arquivo</Label>
              <div className="flex gap-2">
                <Input value={form.file_url ?? ""} onChange={(e) => set("file_url", e.target.value)} />
                <label className="cursor-pointer">
                  <input type="file" hidden
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "files")} />
                  <Button asChild variant="outline" disabled={uploading}>
                    <span><Upload className="mr-1 h-4 w-4" />{uploading ? "…" : ""}</span>
                  </Button>
                </label>
              </div>
            </div>
          )}
          {form.content_type === "text" && (
            <div>
              <Label>Conteúdo</Label>
              <Textarea rows={6} value={form.text_content ?? ""} onChange={(e) => set("text_content", e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" min="0"
                value={form.duration_minutes ?? ""}
                onChange={(e) => set("duration_minutes", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" min="0"
                value={form.sort_order ?? 0}
                onChange={(e) => set("sort_order", Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!form.is_free_preview} onCheckedChange={(v) => set("is_free_preview", v)} id="preview" />
            <Label htmlFor="preview" className="cursor-pointer">Lição gratuita (preview)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Manual sale (grant access) ----------
function ManualSaleDialog({
  course, onClose, onSaved,
}: {
  course: Course | null; onClose: () => void; onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (course) setAmount(((course.price_cents ?? 0) / 100).toString());
  }, [course]);

  const grant = async () => {
    if (!course || !email.trim()) return toast.error("Email obrigatório");
    setSaving(true);
    try {
      // Look up user by email in profiles
      const { data: profile, error: pErr } = await supabase
        .from("profiles").select("id, email").eq("email", email.trim().toLowerCase()).maybeSingle();
      if (pErr) throw pErr;
      if (!profile) throw new Error("Nenhum usuário encontrado com esse email");

      const { error } = await supabase.from("course_purchases").insert({
        user_id: profile.id,
        course_id: course.id,
        amount_cents: Math.round(Number(amount || 0) * 100),
        currency: course.currency,
        status: "paid",
        provider: "manual",
        paid_at: new Date().toISOString(),
        note: "Liberação manual",
      });
      if (error) throw error;
      toast.success("Acesso liberado");
      onSaved();
      onClose();
      setEmail("");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao liberar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar acesso manual</DialogTitle>
          <DialogDescription>
            Concede acesso ao curso <strong>{course?.title}</strong> a um usuário existente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Email do usuário</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" />
          </div>
          <div>
            <Label>Valor cobrado (R$)</Label>
            <Input type="number" step="0.01" min="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={grant} disabled={saving}>{saving ? "Liberando…" : "Liberar acesso"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
