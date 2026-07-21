
-- COURSES
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  thumbnail_url TEXT,
  category TEXT,
  level TEXT,
  duration_minutes INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published courses"
ON public.courses FOR SELECT TO authenticated
USING (is_published = true OR public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Admins manage courses"
ON public.courses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'administrator'))
WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MODULES
CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

-- PURCHASES (create before lessons policies that reference it)
CREATE TABLE public.course_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  external_id TEXT,
  paid_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id, external_id)
);
CREATE INDEX ON public.course_purchases (user_id);
CREATE INDEX ON public.course_purchases (course_id);
GRANT SELECT ON public.course_purchases TO authenticated;
GRANT ALL ON public.course_purchases TO service_role;
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
ON public.course_purchases FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Admins manage purchases"
ON public.course_purchases FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'administrator'))
WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER update_course_purchases_updated_at
BEFORE UPDATE ON public.course_purchases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper function to check ownership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.user_owns_course(_user_id UUID, _course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_purchases
    WHERE user_id = _user_id AND course_id = _course_id AND status = 'paid'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_owns_course(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_course(UUID, UUID) TO authenticated, service_role;

-- Module policies (any authenticated can view modules of published courses; content gating done at lesson level)
CREATE POLICY "View modules of published courses"
ON public.course_modules FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.is_published = true)
);

CREATE POLICY "Admins manage modules"
ON public.course_modules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'administrator'))
WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER update_course_modules_updated_at
BEFORE UPDATE ON public.course_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LESSONS
CREATE TABLE public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'video',
  video_url TEXT,
  file_url TEXT,
  text_content TEXT,
  duration_minutes INTEGER,
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.course_lessons (course_id);
CREATE INDEX ON public.course_lessons (module_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO authenticated;
GRANT ALL ON public.course_lessons TO service_role;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lessons: preview or owned or admin"
ON public.course_lessons FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator')
  OR is_free_preview = true
  OR public.user_owns_course(auth.uid(), course_id)
);

CREATE POLICY "Admins manage lessons"
ON public.course_lessons FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'administrator'))
WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER update_course_lessons_updated_at
BEFORE UPDATE ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
