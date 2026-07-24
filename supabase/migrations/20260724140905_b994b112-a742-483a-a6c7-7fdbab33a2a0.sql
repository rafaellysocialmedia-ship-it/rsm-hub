
-- Tighten post_comments INSERT with explicit ownership check
DROP POLICY IF EXISTS "Insert comments on accessible posts" ON public.post_comments;

CREATE POLICY "Insert comments on accessible posts"
ON public.post_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    has_role(auth.uid(), 'administrator'::app_role)
    OR has_role(auth.uid(), 'team'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.clients c ON c.id = p.client_id
      JOIN public.client_portal_settings s ON s.client_id = c.id
      WHERE p.id = post_comments.post_id
        AND p.client_id IS NOT NULL
        AND c.user_id IS NOT NULL
        AND c.user_id = auth.uid()
        AND s.can_comment = true
    )
  )
);

-- Ensure profiles SELECT policies are strict: own-row + admins only
DROP POLICY IF EXISTS "Profiles are viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles" ON public.profiles;

-- Recreate the two allowed SELECT policies idempotently
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));
