ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS internal_notes text;

ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx ON public.post_comments(parent_id);

DROP POLICY IF EXISTS "View comments via post access" ON public.post_comments;
CREATE POLICY "View comments via post access"
ON public.post_comments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'administrator'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR (
    is_internal = false
    AND EXISTS (
      SELECT 1
      FROM ((posts p
        JOIN clients c ON c.id = p.client_id)
        JOIN client_portal_settings s ON s.client_id = c.id)
      WHERE p.id = post_comments.post_id
        AND c.user_id = auth.uid()
        AND s.can_view_comments
    )
  )
);