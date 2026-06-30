
-- 1) Lock down SECURITY DEFINER functions exposed via the API schema
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.vault_reveal_password(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.vault_reveal_password(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.vault_create_credential(text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.vault_create_credential(text, text, text, text, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.vault_update_credential(uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.vault_update_credential(uuid, text, text, text, text, text, uuid) TO authenticated, service_role;

-- Internal-only helpers: should never be callable through the API
REVOKE EXECUTE ON FUNCTION public.vault_encryption_key() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.vault_encryption_key() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 2) Avatars storage: limit SELECT to the owner or staff
DROP POLICY IF EXISTS "Avatars viewable by authenticated" ON storage.objects;
CREATE POLICY "Avatars viewable by owner or staff"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
    OR public.has_role(auth.uid(), 'team'::public.app_role)
  )
);

-- 3) post_comments / post_files: scope client reads to their own client
DROP POLICY IF EXISTS "View comments via post access" ON public.post_comments;
CREATE POLICY "View comments via post access"
ON public.post_comments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.posts p
    JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = post_comments.post_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "View post files via post access" ON public.post_files;
CREATE POLICY "View post files via post access"
ON public.post_files FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.posts p
    JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = post_files.post_id
      AND c.user_id = auth.uid()
  )
);

-- 4) task_files: allow client users to read files for their own client's tasks
CREATE POLICY "Clients view own task files"
ON public.task_files FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.id = task_files.task_id
      AND c.user_id = auth.uid()
  )
);

-- 5) user_roles: block self-escalation via a RESTRICTIVE policy
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrator'::public.app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrator'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'administrator'::public.app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrator'::public.app_role));
