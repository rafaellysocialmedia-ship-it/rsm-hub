-- Keep privileged vault helpers bound to the current authenticated user.
-- Earlier overloads accepted a caller UUID, which could be forged.
DROP FUNCTION IF EXISTS private.vault_create_credential(text,text,text,text,text,uuid,uuid);
DROP FUNCTION IF EXISTS private.vault_update_credential(uuid,text,text,text,text,text,uuid,uuid);
DROP FUNCTION IF EXISTS private.vault_reveal_password(uuid,uuid);
DROP FUNCTION IF EXISTS private.vault_create_credential(text,text,text,text,text,uuid,uuid,boolean,text);
DROP FUNCTION IF EXISTS private.vault_update_credential(uuid,text,text,text,text,text,uuid,uuid,boolean,text);
DROP FUNCTION IF EXISTS private.vault_reveal_backup_codes(uuid,uuid);

CREATE OR REPLACE FUNCTION private.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT (
    private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.vault_credentials
    (client_id, platform, username, password_encrypted, url, notes, created_by)
  VALUES (
    _client_id, _platform, _username,
    pgp_sym_encrypt(_password, private.vault_encryption_key()),
    _url, _notes, _uid
  ) RETURNING id INTO _id;
  INSERT INTO public.vault_credential_history (credential_id, changed_by, action)
  VALUES (_id, _uid, 'created');
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION private.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL,
  _has_2fa boolean DEFAULT false, _backup_codes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT (
    private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.vault_credentials
    (client_id, platform, username, password_encrypted, url, notes, created_by,
     has_2fa, backup_codes_encrypted)
  VALUES (
    _client_id, _platform, _username,
    pgp_sym_encrypt(_password, private.vault_encryption_key()),
    _url, _notes, _uid, COALESCE(_has_2fa, false),
    CASE WHEN _backup_codes IS NOT NULL AND length(_backup_codes) > 0
      THEN pgp_sym_encrypt(_backup_codes, private.vault_encryption_key())
      ELSE NULL END
  ) RETURNING id INTO _id;
  INSERT INTO public.vault_credential_history (credential_id, changed_by, action)
  VALUES (_id, _uid, 'created');
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION private.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _old record;
BEGIN
  IF _uid IS NULL OR NOT (
    private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _old FROM public.vault_credentials WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credential not found'; END IF;
  UPDATE public.vault_credentials SET
    platform = _platform, username = _username, url = _url, notes = _notes,
    client_id = _client_id,
    password_encrypted = CASE
      WHEN _password IS NOT NULL AND length(_password) > 0
        THEN pgp_sym_encrypt(_password, private.vault_encryption_key())
      ELSE password_encrypted END
  WHERE id = _id;
  IF _old.platform IS DISTINCT FROM _platform THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'platform', _old.platform, _platform);
  END IF;
  IF _old.username IS DISTINCT FROM _username THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'username', _old.username, _username);
  END IF;
  IF _old.url IS DISTINCT FROM _url THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'url', _old.url, _url);
  END IF;
  IF _old.notes IS DISTINCT FROM _notes THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'notes', _old.notes, _notes);
  END IF;
  IF _old.client_id IS DISTINCT FROM _client_id THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field, old_value, new_value)
    VALUES (_id, _uid, 'updated', 'client_id', _old.client_id::text, _client_id::text);
  END IF;
  IF _password IS NOT NULL AND length(_password) > 0 THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field)
    VALUES (_id, _uid, 'password_changed', 'password');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid,
  _has_2fa boolean DEFAULT NULL, _backup_codes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _old record;
BEGIN
  IF _uid IS NULL OR NOT (
    private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _old FROM public.vault_credentials WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credential not found'; END IF;
  UPDATE public.vault_credentials SET
    platform = _platform, username = _username, url = _url, notes = _notes,
    client_id = _client_id, has_2fa = COALESCE(_has_2fa, has_2fa),
    password_encrypted = CASE
      WHEN _password IS NOT NULL AND length(_password) > 0
        THEN pgp_sym_encrypt(_password, private.vault_encryption_key())
      ELSE password_encrypted END,
    backup_codes_encrypted = CASE
      WHEN _backup_codes IS NULL THEN backup_codes_encrypted
      WHEN length(_backup_codes) = 0 THEN NULL
      ELSE pgp_sym_encrypt(_backup_codes, private.vault_encryption_key()) END
  WHERE id = _id;
  IF _password IS NOT NULL AND length(_password) > 0 THEN
    INSERT INTO public.vault_credential_history
      (credential_id, changed_by, action, field)
    VALUES (_id, _uid, 'password_changed', 'password');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.vault_reveal_password(_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _password text;
BEGIN
  IF _uid IS NULL OR NOT (
    private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT pgp_sym_decrypt(password_encrypted, private.vault_encryption_key())
    INTO _password FROM public.vault_credentials WHERE id = _id;
  IF _password IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;
  INSERT INTO public.vault_credential_history (credential_id, changed_by, action)
  VALUES (_id, _uid, 'viewed');
  RETURN _password;
END;
$$;

CREATE OR REPLACE FUNCTION private.vault_reveal_backup_codes(_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _codes text; _encrypted bytea;
BEGIN
  IF _uid IS NULL OR NOT (
    private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT backup_codes_encrypted INTO _encrypted
  FROM public.vault_credentials WHERE id = _id;
  IF _encrypted IS NULL THEN RETURN NULL; END IF;
  _codes := pgp_sym_decrypt(_encrypted, private.vault_encryption_key());
  INSERT INTO public.vault_credential_history
    (credential_id, changed_by, action, field)
  VALUES (_id, _uid, 'viewed', 'backup_codes');
  RETURN _codes;
END;
$$;

REVOKE ALL ON FUNCTION private.vault_create_credential(text,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.vault_create_credential(text,text,text,text,text,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.vault_reveal_password(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.vault_reveal_backup_codes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vault_create_credential(text,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_create_credential(text,text,text,text,text,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_reveal_password(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.vault_reveal_backup_codes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_create_credential(
    _platform, _username, _password, _url, _notes, _client_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL,
  _has_2fa boolean DEFAULT false, _backup_codes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_create_credential(
    _platform, _username, _password, _url, _notes, _client_id,
    _has_2fa, _backup_codes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid
) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM private.vault_update_credential(
    _id, _platform, _username, _password, _url, _notes, _client_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid,
  _has_2fa boolean DEFAULT NULL, _backup_codes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM private.vault_update_credential(
    _id, _platform, _username, _password, _url, _notes, _client_id,
    _has_2fa, _backup_codes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_reveal_password(_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_reveal_password(_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_reveal_backup_codes(_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_reveal_backup_codes(_id);
END;
$$;

REVOKE ALL ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_reveal_password(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_reveal_backup_codes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid,boolean,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid,boolean,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vault_reveal_password(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vault_reveal_backup_codes(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "course-assets: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "course-assets: entitled read" ON storage.objects;
CREATE POLICY "course-assets: entitled read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-assets'
  AND (
    public.has_role(auth.uid(), 'administrator')
    OR (storage.foldername(name))[1] = 'thumbnails'
    OR EXISTS (
      SELECT 1 FROM public.course_lessons lesson
      WHERE (lesson.video_url = name OR lesson.file_url = name)
        AND (lesson.is_free_preview OR public.user_owns_course(auth.uid(), lesson.course_id))
    )
  )
);
