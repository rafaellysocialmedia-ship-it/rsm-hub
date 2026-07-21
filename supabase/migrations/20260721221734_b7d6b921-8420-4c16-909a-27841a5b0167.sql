
CREATE OR REPLACE FUNCTION public.user_owns_course(_user_id UUID, _course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_purchases
    WHERE user_id = _user_id AND course_id = _course_id AND status = 'paid'
  );
$$;
