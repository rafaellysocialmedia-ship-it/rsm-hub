
-- 1) Vault master key stored in a private table (no API access)
CREATE TABLE IF NOT EXISTS public._vault_master (
  id integer PRIMARY KEY DEFAULT 1,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT _vault_master_single_row CHECK (id = 1)
);
REVOKE ALL ON public._vault_master FROM PUBLIC;
REVOKE ALL ON public._vault_master FROM anon, authenticated;
GRANT ALL ON public._vault_master TO service_role;
ALTER TABLE public._vault_master ENABLE ROW LEVEL SECURITY;
-- No policies -> no access from Data API even if grants were re-added.

INSERT INTO public._vault_master (id, key)
VALUES (1, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 2) Re-encrypt existing vault passwords with the new master key,
--    using the legacy fallback key for decryption.
DO $$
DECLARE
  _old text := encode(digest('smh-vault::' || coalesce(current_setting('cluster_name', true), '') || '::' || current_database(), 'sha256'), 'hex');
  _new text;
  r RECORD;
BEGIN
  SELECT key INTO _new FROM public._vault_master WHERE id = 1;
  FOR r IN SELECT id, password_encrypted FROM public.vault_credentials LOOP
    BEGIN
      UPDATE public.vault_credentials
      SET password_encrypted = pgp_sym_encrypt(pgp_sym_decrypt(r.password_encrypted, _old), _new)
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      -- Row already encrypted with the new key (or unreadable); skip.
      NULL;
    END;
  END LOOP;
END $$;

-- 3) Replace vault_encryption_key() to read the private random key.
CREATE OR REPLACE FUNCTION public.vault_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text;
BEGIN
  SELECT key INTO k FROM public._vault_master WHERE id = 1;
  IF k IS NULL OR length(k) = 0 THEN
    RAISE EXCEPTION 'Vault master key not initialized';
  END IF;
  RETURN k;
END;
$$;

-- 4) Lock down SECURITY DEFINER function EXECUTE privileges.
-- Revoke from public/anon/authenticated on all sensitive definer functions,
-- then re-grant only the ones intentionally callable by signed-in users.
REVOKE ALL ON FUNCTION public.vault_encryption_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_client_portal_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_client_on_file() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_post_version() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_create_credential(text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_update_credential(uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_reveal_password(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_create_credential(text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(uuid, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_reveal_password(uuid) TO authenticated;

-- 5) notifications: only staff can insert.
DROP POLICY IF EXISTS "Staff or self insert notifications" ON public.notifications;
CREATE POLICY "Staff insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'administrator'::app_role)
    OR public.has_role(auth.uid(), 'team'::app_role)
  );

-- 6) post_approvals: verify post belongs to the same client.
DROP POLICY IF EXISTS "Clients decide own approvals" ON public.post_approvals;
CREATE POLICY "Clients decide own approvals"
  ON public.post_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = post_approvals.client_id
        AND c.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_approvals.post_id
        AND p.client_id = post_approvals.client_id
    )
  );

DROP POLICY IF EXISTS "Clients update own approvals" ON public.post_approvals;
CREATE POLICY "Clients update own approvals"
  ON public.post_approvals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = post_approvals.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = post_approvals.client_id
        AND c.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_approvals.post_id
        AND p.client_id = post_approvals.client_id
    )
  );

-- 7) post_comments: clients can only comment on their own client's posts.
DROP POLICY IF EXISTS "Authenticated can insert comments on accessible posts" ON public.post_comments;
CREATE POLICY "Insert comments on accessible posts"
  ON public.post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'administrator'::app_role)
      OR public.has_role(auth.uid(), 'team'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.posts p
        JOIN public.clients c ON c.id = p.client_id
        WHERE p.id = post_comments.post_id
          AND c.user_id = auth.uid()
      )
    )
  );

-- 8) profiles: scope reads per role.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrator'::app_role)
    OR public.has_role(auth.uid(), 'team'::app_role)
  );
CREATE POLICY "Users view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
