-- 0) Private schema for internal SECURITY DEFINER helpers
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- =========================================================================
-- 1) has_role: private DEFINER + public INVOKER wrapper (policies keep calling has_role)
-- =========================================================================
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Replace public.has_role body with a SECURITY INVOKER wrapper.
-- CREATE OR REPLACE keeps the signature so all 56 existing RLS policies continue to work.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- =========================================================================
-- 2) vault_encryption_key: move to private, drop public exposure
-- =========================================================================
CREATE OR REPLACE FUNCTION private.vault_encryption_key()
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

REVOKE EXECUTE ON FUNCTION private.vault_encryption_key() FROM PUBLIC, anon, authenticated;
-- (Only owner / other SECURITY DEFINER functions in the same trust chain call this.)

-- The public version is no longer needed by anything outside itself; drop it.
DROP FUNCTION IF EXISTS public.vault_encryption_key();

-- =========================================================================
-- 3) vault_create_credential / vault_update_credential / vault_reveal_password
--    Move privileged bodies to private; keep public SECURITY INVOKER wrappers
--    so existing supabase.rpc(...) calls from the client continue to work.
-- =========================================================================

-- ---- private.vault_create_credential ----
CREATE OR REPLACE FUNCTION private.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL,
  _caller uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _uid UUID := COALESCE(_caller, auth.uid());
BEGIN
  IF _uid IS NULL OR NOT (private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.vault_credentials (client_id, platform, username, password_encrypted, url, notes, created_by)
  VALUES (
    _client_id, _platform, _username,
    pgp_sym_encrypt(_password, private.vault_encryption_key()),
    _url, _notes, _uid
  )
  RETURNING id INTO _id;

  INSERT INTO public.vault_credential_history (credential_id, changed_by, action)
  VALUES (_id, _uid, 'created');

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.vault_create_credential(text,text,text,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- ---- private.vault_update_credential ----
CREATE OR REPLACE FUNCTION private.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid, _caller uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := COALESCE(_caller, auth.uid());
  _old RECORD;
BEGIN
  IF _uid IS NULL OR NOT (private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')) THEN
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
        THEN pgp_sym_encrypt(_password, private.vault_encryption_key())
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

REVOKE EXECUTE ON FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- ---- private.vault_reveal_password ----
CREATE OR REPLACE FUNCTION private.vault_reveal_password(_id uuid, _caller uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := COALESCE(_caller, auth.uid());
  _pwd TEXT;
BEGIN
  IF _uid IS NULL OR NOT (private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT pgp_sym_decrypt(password_encrypted, private.vault_encryption_key())
    INTO _pwd
  FROM public.vault_credentials WHERE id = _id;

  IF _pwd IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;

  INSERT INTO public.vault_credential_history(credential_id, changed_by, action)
  VALUES (_id, _uid, 'viewed');

  RETURN _pwd;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.vault_reveal_password(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 4) Replace public vault functions with SECURITY INVOKER wrappers
--    (same signatures the client already calls via supabase.rpc)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_create_credential(_platform, _username, _password, _url, _notes, _client_id, _uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_create_credential(text,text,text,text,text,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM private.vault_update_credential(_id, _platform, _username, _password, _url, _notes, _client_id, _uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vault_reveal_password(_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_reveal_password(_id, _uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vault_reveal_password(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_reveal_password(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_reveal_password(uuid, uuid) TO authenticated;