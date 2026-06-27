
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encryption key helper (uses Postgres setting; falls back to a project-stable default)
CREATE OR REPLACE FUNCTION public.vault_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  BEGIN
    k := current_setting('app.vault_key', true);
  EXCEPTION WHEN OTHERS THEN
    k := NULL;
  END;
  IF k IS NULL OR length(k) = 0 THEN
    -- Stable per-database fallback derived from system id (avoids hardcoding plaintext key in code)
    k := encode(digest('smh-vault::' || coalesce(current_setting('cluster_name', true), '') || '::' || current_database(), 'sha256'), 'hex');
  END IF;
  RETURN k;
END;
$$;

-- Main table: password is stored only as bytea ciphertext
CREATE TABLE public.vault_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted BYTEA NOT NULL,
  url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_credentials TO authenticated;
GRANT ALL ON public.vault_credentials TO service_role;
ALTER TABLE public.vault_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view credentials"
  ON public.vault_credentials FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Staff can insert credentials"
  ON public.vault_credentials FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Staff can update credentials"
  ON public.vault_credentials FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Staff can delete credentials"
  ON public.vault_credentials FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE TRIGGER trg_vault_credentials_updated
  BEFORE UPDATE ON public.vault_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vault_credentials_client ON public.vault_credentials(client_id);
CREATE INDEX idx_vault_credentials_platform ON public.vault_credentials(platform);

-- History table
CREATE TABLE public.vault_credential_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.vault_credentials(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- created | updated | password_changed | viewed
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.vault_credential_history TO authenticated;
GRANT ALL ON public.vault_credential_history TO service_role;
ALTER TABLE public.vault_credential_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view history"
  ON public.vault_credential_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Staff can insert history"
  ON public.vault_credential_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE INDEX idx_vault_history_credential ON public.vault_credential_history(credential_id, created_at DESC);

-- RPC: create credential (encrypts password server-side)
CREATE OR REPLACE FUNCTION public.vault_create_credential(
  _platform TEXT,
  _username TEXT,
  _password TEXT,
  _url TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _client_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF NOT (public.has_role(_uid, 'administrator') OR public.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.vault_credentials (client_id, platform, username, password_encrypted, url, notes, created_by)
  VALUES (
    _client_id, _platform, _username,
    pgp_sym_encrypt(_password, public.vault_encryption_key()),
    _url, _notes, _uid
  )
  RETURNING id INTO _id;

  INSERT INTO public.vault_credential_history (credential_id, changed_by, action)
  VALUES (_id, _uid, 'created');

  RETURN _id;
END;
$$;

-- RPC: update credential (handles optional password change + history)
CREATE OR REPLACE FUNCTION public.vault_update_credential(
  _id UUID,
  _platform TEXT,
  _username TEXT,
  _password TEXT,
  _url TEXT,
  _notes TEXT,
  _client_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _old RECORD;
BEGIN
  IF NOT (public.has_role(_uid, 'administrator') OR public.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _old FROM public.vault_credentials WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credential not found'; END IF;

  UPDATE public.vault_credentials
  SET platform = _platform,
      username = _username,
      url = _url,
      notes = _notes,
      client_id = _client_id,
      password_encrypted = CASE
        WHEN _password IS NOT NULL AND length(_password) > 0
        THEN pgp_sym_encrypt(_password, public.vault_encryption_key())
        ELSE password_encrypted
      END
  WHERE id = _id;

  IF _old.platform IS DISTINCT FROM _platform THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'platform', _old.platform, _platform);
  END IF;
  IF _old.username IS DISTINCT FROM _username THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'username', _old.username, _username);
  END IF;
  IF _old.url IS DISTINCT FROM _url THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'url', _old.url, _url);
  END IF;
  IF _old.notes IS DISTINCT FROM _notes THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'notes', _old.notes, _notes);
  END IF;
  IF _old.client_id IS DISTINCT FROM _client_id THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'client_id', _old.client_id::text, _client_id::text);
  END IF;
  IF _password IS NOT NULL AND length(_password) > 0 THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field)
    VALUES (_id, _uid, 'password_changed', 'password');
  END IF;
END;
$$;

-- RPC: reveal password (decrypts + logs view)
CREATE OR REPLACE FUNCTION public.vault_reveal_password(_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _pwd TEXT;
BEGIN
  IF NOT (public.has_role(_uid, 'administrator') OR public.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT pgp_sym_decrypt(password_encrypted, public.vault_encryption_key())
    INTO _pwd
  FROM public.vault_credentials WHERE id = _id;

  IF _pwd IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;

  INSERT INTO public.vault_credential_history(credential_id, changed_by, action)
  VALUES (_id, _uid, 'viewed');

  RETURN _pwd;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vault_create_credential(TEXT,TEXT,TEXT,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_reveal_password(UUID) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_credentials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_credential_history;
