DROP POLICY IF EXISTS "Authors update own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Authors or admins delete comments" ON public.post_comments;

CREATE POLICY "Authors or staff update comments"
ON public.post_comments
FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Authors or staff delete comments"
ON public.post_comments
FOR DELETE
TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));