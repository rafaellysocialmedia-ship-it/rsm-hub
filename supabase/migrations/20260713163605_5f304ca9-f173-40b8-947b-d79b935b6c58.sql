-- 1) Remove sensitive tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.finance_transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.vault_credentials;
ALTER PUBLICATION supabase_realtime DROP TABLE public.vault_credential_history;

-- 2) Restrict EXECUTE on SECURITY DEFINER vault functions to authenticated only
REVOKE EXECUTE ON FUNCTION public.vault_create_credential(text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vault_update_credential(uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vault_reveal_password(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vault_encryption_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_create_credential(text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(uuid, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_reveal_password(uuid) TO authenticated;

-- has_role is used inside RLS but should not be RPC-callable by anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 3) post_comments INSERT: require client_portal_settings.can_comment for client authors
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
      FROM posts p
      JOIN clients c ON c.id = p.client_id
      JOIN client_portal_settings s ON s.client_id = c.id
      WHERE p.id = post_comments.post_id
        AND c.user_id = auth.uid()
        AND s.can_comment = true
    )
  )
);

-- 4) profiles SELECT: make policies explicit TO authenticated so anon (or any other role)
-- cannot read any profile, and consolidate to self + staff only.
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Staff can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'administrator'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
);

-- Ensure anon has no SELECT grant on profiles (defense-in-depth alongside RLS)
REVOKE SELECT ON public.profiles FROM anon;