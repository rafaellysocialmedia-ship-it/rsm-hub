
-- Tighten post_comments insert: explicit client scope
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
        AND c.user_id = auth.uid()
        AND s.can_comment = true
    )
  )
);

-- Restrict profiles read: only administrators can view all; others only see self
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'administrator'::app_role));
