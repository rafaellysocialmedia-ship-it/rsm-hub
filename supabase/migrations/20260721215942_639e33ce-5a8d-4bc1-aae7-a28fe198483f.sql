
-- 1) Fix pgp_sym_encrypt not found: include extensions in search_path
ALTER FUNCTION private.vault_create_credential(text,text,text,text,text,uuid,uuid) SET search_path = public, extensions;
ALTER FUNCTION private.vault_update_credential(uuid,text,text,text,text,text,uuid,uuid) SET search_path = public, extensions;
ALTER FUNCTION private.vault_reveal_password(uuid,uuid) SET search_path = public, extensions;
ALTER FUNCTION private.vault_encryption_key() SET search_path = public, extensions;

-- 2) 2FA fields on vault_credentials
ALTER TABLE public.vault_credentials
  ADD COLUMN IF NOT EXISTS has_2fa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_codes_encrypted BYTEA;

-- Extend RPCs to accept 2FA fields (keep old signatures too for compatibility)
CREATE OR REPLACE FUNCTION private.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL,
  _caller uuid DEFAULT NULL,
  _has_2fa boolean DEFAULT false, _backup_codes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id UUID; _uid UUID := COALESCE(_caller, auth.uid());
BEGIN
  IF _uid IS NULL OR NOT (private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.vault_credentials (client_id, platform, username, password_encrypted, url, notes, created_by, has_2fa, backup_codes_encrypted)
  VALUES (
    _client_id, _platform, _username,
    pgp_sym_encrypt(_password, private.vault_encryption_key()),
    _url, _notes, _uid, COALESCE(_has_2fa,false),
    CASE WHEN _backup_codes IS NOT NULL AND length(_backup_codes)>0
         THEN pgp_sym_encrypt(_backup_codes, private.vault_encryption_key()) ELSE NULL END
  ) RETURNING id INTO _id;
  INSERT INTO public.vault_credential_history (credential_id, changed_by, action) VALUES (_id, _uid, 'created');
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION private.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid, _caller uuid DEFAULT NULL,
  _has_2fa boolean DEFAULT NULL, _backup_codes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid UUID := COALESCE(_caller, auth.uid()); _old RECORD;
BEGIN
  IF _uid IS NULL OR NOT (private.has_role(_uid, 'administrator') OR private.has_role(_uid, 'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _old FROM public.vault_credentials WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credential not found'; END IF;
  UPDATE public.vault_credentials SET
    platform=_platform, username=_username, url=_url, notes=_notes, client_id=_client_id,
    has_2fa = COALESCE(_has_2fa, has_2fa),
    password_encrypted = CASE WHEN _password IS NOT NULL AND length(_password)>0
        THEN pgp_sym_encrypt(_password, private.vault_encryption_key()) ELSE password_encrypted END,
    backup_codes_encrypted = CASE
        WHEN _backup_codes IS NULL THEN backup_codes_encrypted
        WHEN length(_backup_codes)=0 THEN NULL
        ELSE pgp_sym_encrypt(_backup_codes, private.vault_encryption_key()) END
  WHERE id = _id;
  IF _password IS NOT NULL AND length(_password)>0 THEN
    INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field)
    VALUES (_id, _uid, 'password_changed', 'password');
  END IF;
END; $$;

-- Public wrappers
CREATE OR REPLACE FUNCTION public.vault_create_credential(
  _platform text, _username text, _password text,
  _url text DEFAULT NULL, _notes text DEFAULT NULL, _client_id uuid DEFAULT NULL,
  _has_2fa boolean DEFAULT false, _backup_codes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_create_credential(_platform,_username,_password,_url,_notes,_client_id,_uid,_has_2fa,_backup_codes);
END; $$;

CREATE OR REPLACE FUNCTION public.vault_update_credential(
  _id uuid, _platform text, _username text, _password text,
  _url text, _notes text, _client_id uuid,
  _has_2fa boolean DEFAULT NULL, _backup_codes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM private.vault_update_credential(_id,_platform,_username,_password,_url,_notes,_client_id,_uid,_has_2fa,_backup_codes);
END; $$;

REVOKE ALL ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_create_credential(text,text,text,text,text,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_update_credential(uuid,text,text,text,text,text,uuid,boolean,text) TO authenticated;

-- Reveal backup codes RPC
CREATE OR REPLACE FUNCTION private.vault_reveal_backup_codes(_id uuid, _caller uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := COALESCE(_caller, auth.uid()); _txt text; _enc bytea;
BEGIN
  IF _uid IS NULL OR NOT (private.has_role(_uid,'administrator') OR private.has_role(_uid,'team')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT backup_codes_encrypted INTO _enc FROM public.vault_credentials WHERE id=_id;
  IF _enc IS NULL THEN RETURN NULL; END IF;
  _txt := pgp_sym_decrypt(_enc, private.vault_encryption_key());
  INSERT INTO public.vault_credential_history(credential_id, changed_by, action, field)
  VALUES (_id, _uid, 'viewed', 'backup_codes');
  RETURN _txt;
END; $$;

CREATE OR REPLACE FUNCTION public.vault_reveal_backup_codes(_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN private.vault_reveal_backup_codes(_id, _uid);
END; $$;
REVOKE ALL ON FUNCTION public.vault_reveal_backup_codes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_reveal_backup_codes(uuid) TO authenticated;

-- 3) Replace emojis with symbols in commemorative_dates
UPDATE public.commemorative_dates SET emoji = CASE
  WHEN emoji ~ '[🎉🎊]' THEN '★'
  WHEN emoji ~ '[❤️💖💝💘]' THEN '♥'
  WHEN emoji ~ '[🎄🎅]' THEN '✦'
  WHEN emoji ~ '[🌸🌷🌹]' THEN '❀'
  WHEN emoji ~ '[👩👨👪]' THEN '☆'
  WHEN emoji ~ '[🇧🇷]' THEN '◆'
  WHEN emoji ~ '[🦃🍗]' THEN '✧'
  WHEN emoji ~ '[🎃]' THEN '☾'
  WHEN emoji ~ '[💼]' THEN '◈'
  WHEN emoji ~ '[📚]' THEN '❋'
  ELSE '◉'
END
WHERE emoji IS NOT NULL;
