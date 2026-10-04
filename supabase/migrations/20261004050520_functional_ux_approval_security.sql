ALTER TABLE public.posts ADD COLUMN content_revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.post_approvals ADD COLUMN reviewed_revision integer;
ALTER TABLE public.post_approvals ADD COLUMN decided_at timestamptz;
ALTER TABLE public.client_portal_settings ADD COLUMN can_view_finance boolean NOT NULL DEFAULT true;
ALTER TABLE public.client_portal_settings ADD COLUMN can_upload_materials boolean NOT NULL DEFAULT true;
ALTER TABLE public.finance_charges ADD COLUMN payment_url text CHECK(payment_url IS NULL OR payment_url ~ '^https://[^[:space:]]+$');
ALTER TABLE public.files ADD COLUMN is_shared boolean NOT NULL DEFAULT true;

CREATE TABLE public.post_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES public.clients(id), revision integer NOT NULL,
 decision public.approval_decision NOT NULL, feedback text, actor_id uuid REFERENCES public.profiles(id),
 actor_name text, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.post_review_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.post_review_events TO authenticated;
CREATE POLICY review_events_staff ON public.post_review_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
-- Events are immutable through the API. Shared snapshots are available through the guarded RPC below.
CREATE TABLE public.approval_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, revision integer NOT NULL,expires_at timestamptz NOT NULL,
 revoked_at timestamptz,created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON public.approval_links TO authenticated;
CREATE POLICY approval_links_staff ON public.approval_links FOR ALL TO authenticated USING(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) WITH CHECK(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE INDEX review_events_post_revision ON public.post_review_events(post_id,revision);
CREATE INDEX approval_links_post ON public.approval_links(post_id);

-- Authenticated portal access is projected; raw post rows include internal fields.
CREATE FUNCTION rsm_private.portal_post_allowed(_post_id uuid,_permission text DEFAULT 'can_view_posts') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.posts p JOIN public.clients c ON c.id=p.client_id JOIN public.client_portal_settings s ON s.client_id=c.id
 WHERE p.id=_post_id AND c.user_id=auth.uid() AND s.can_view_posts AND p.status::text=ANY(s.visible_statuses)
 AND coalesce((to_jsonb(s)->>_permission)::boolean,false));
$$;
REVOKE ALL ON FUNCTION rsm_private.portal_post_allowed(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.portal_post_allowed(uuid,text) TO authenticated;
CREATE FUNCTION public.can_access_portal_post(_post_id uuid,_permission text DEFAULT 'can_view_posts') RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT rsm_private.portal_post_allowed(_post_id,_permission); $$;
REVOKE ALL ON FUNCTION public.can_access_portal_post(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_portal_post(uuid,text) TO authenticated;
CREATE FUNCTION rsm_private.portal_posts() RETURNS SETOF public.posts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.posts; captions boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 FOR p IN SELECT x.* FROM public.posts x WHERE public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') OR rsm_private.portal_post_allowed(x.id) LOOP
  SELECT s.can_view_captions INTO captions FROM public.client_portal_settings s WHERE s.client_id=p.client_id;
  p.internal_notes:=NULL;p.created_by:=NULL;p.recurrence:=NULL;
  IF NOT(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN
   p.objective:=NULL;p.theme:=NULL;p.pillar:=NULL;
   IF NOT coalesce(captions,false) THEN p.caption:=NULL;p.cta:=NULL;p.hashtags:=NULL;p.script:=NULL;p.headline:=NULL;p.subheadline:=NULL;p.slides:=NULL; END IF;
  END IF;
  RETURN NEXT p;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION rsm_private.portal_posts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.portal_posts() TO authenticated;
CREATE VIEW public.portal_posts WITH(security_invoker=true) AS SELECT * FROM rsm_private.portal_posts();
GRANT SELECT ON public.portal_posts TO authenticated;
DROP POLICY "Clients can view own posts" ON public.posts;
DROP POLICY "Clients decide own approvals" ON public.post_approvals;
DROP POLICY "Clients update own approvals" ON public.post_approvals;
DROP POLICY "View post files via post access" ON public.post_files;
CREATE POLICY portal_media_read ON public.post_files FOR SELECT TO authenticated USING(public.can_access_portal_post(post_id,'can_view_media'));
DROP POLICY "View comments via post access" ON public.post_comments;
CREATE POLICY portal_comments_read ON public.post_comments FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') OR (NOT is_internal AND public.can_access_portal_post(post_id,'can_view_comments')));
DROP POLICY "Insert comments on accessible posts" ON public.post_comments;
CREATE POLICY portal_comments_insert ON public.post_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') OR (NOT is_internal AND public.can_access_portal_post(post_id,'can_comment'))));
DROP POLICY "Authors or staff update comments" ON public.post_comments;
CREATE POLICY portal_comments_update ON public.post_comments FOR UPDATE TO authenticated USING(author_id=auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) WITH CHECK(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') OR (author_id=auth.uid() AND NOT is_internal AND public.can_access_portal_post(post_id,'can_comment')));
DROP POLICY "Clients view their post-files" ON storage.objects;
CREATE POLICY portal_media_storage ON storage.objects FOR SELECT TO authenticated USING(bucket_id='post-files' AND EXISTS(SELECT 1 FROM public.post_files f WHERE f.storage_path=objects.name AND public.can_access_portal_post(f.post_id,'can_view_media')));
DROP POLICY "Authenticated read library files" ON storage.objects;
CREATE POLICY portal_library_storage ON storage.objects FOR SELECT TO authenticated USING(bucket_id='library-files' AND EXISTS(SELECT 1 FROM public.files f JOIN public.clients c ON c.id=f.client_id WHERE f.storage_path=objects.name AND f.is_shared AND c.user_id=auth.uid()));
DROP POLICY "Clients view their files" ON public.files;
CREATE POLICY portal_shared_files ON public.files FOR SELECT TO authenticated USING(is_shared AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=files.client_id AND c.user_id=auth.uid()));
CREATE POLICY portal_upload_objects ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='library-files' AND EXISTS(SELECT 1 FROM public.clients c JOIN public.client_portal_settings s ON s.client_id=c.id WHERE c.user_id=auth.uid() AND c.status='active' AND NOT c.churned AND s.can_upload_materials AND (storage.foldername(name))[1]=c.id::text AND (storage.foldername(name))[2]='uploads'));
CREATE POLICY portal_upload_metadata ON public.files FOR INSERT TO authenticated WITH CHECK(uploaded_by=auth.uid() AND is_shared AND category IN ('fotos','videos','documentos','logos','branding') AND (storage.foldername(storage_path))[1]=client_id::text AND (storage.foldername(storage_path))[2]='uploads' AND EXISTS(SELECT 1 FROM public.clients c JOIN public.client_portal_settings s ON s.client_id=c.id WHERE c.id=files.client_id AND c.user_id=auth.uid() AND c.status='active' AND NOT c.churned AND s.can_upload_materials));

-- A changed caption, script, channel, date or media invalidates an existing decision.
CREATE FUNCTION public.guard_post_content_revision() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE changed boolean;
BEGIN
 changed:=(NEW.title,NEW.caption,NEW.headline,NEW.subheadline,NEW.script,NEW.slides,NEW.cta,NEW.hashtags,NEW.format,NEW.social_network,NEW.social_networks,NEW.scheduled_date,NEW.scheduled_time) IS DISTINCT FROM (OLD.title,OLD.caption,OLD.headline,OLD.subheadline,OLD.script,OLD.slides,OLD.cta,OLD.hashtags,OLD.format,OLD.social_network,OLD.social_networks,OLD.scheduled_date,OLD.scheduled_time);
 IF changed THEN NEW.content_revision:=OLD.content_revision+1; END IF;
 IF NEW.content_revision<>OLD.content_revision THEN
  NEW.updated_at:=clock_timestamp();
  IF OLD.status IN ('approved','to_schedule','scheduled','published','changes_requested') THEN NEW.status:='review'; END IF;
  UPDATE public.post_approvals SET decision='pending',reviewed_revision=NULL,decided_at=NULL,feedback='Conteúdo alterado. Nova revisão necessária.' WHERE post_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_post_content_revision() FROM PUBLIC,anon;
CREATE TRIGGER aaa_content_revision BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_post_content_revision();
CREATE FUNCTION public.bump_media_revision() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pid uuid;
BEGIN
 pid:=CASE WHEN TG_OP='DELETE' THEN OLD.post_id ELSE NEW.post_id END;
 IF TG_OP='UPDATE' AND NEW.post_id<>OLD.post_id THEN RAISE EXCEPTION 'Não é permitido mover um arquivo entre conteúdos'; END IF;
 UPDATE public.posts SET content_revision=content_revision+1,updated_at=clock_timestamp() WHERE id=pid;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.bump_media_revision() FROM PUBLIC,anon;
CREATE TRIGGER media_revision AFTER INSERT OR UPDATE OR DELETE ON public.post_files FOR EACH ROW EXECUTE FUNCTION public.bump_media_revision();
-- Publishing is an operational confirmation, never a fabricated client approval.
DROP TRIGGER IF EXISTS trg_auto_approve_on_publish ON public.posts;
DO $$ DECLARE t record; BEGIN FOR t IN SELECT tgname FROM pg_trigger WHERE tgrelid='public.posts'::regclass AND tgfoid='public.auto_approve_on_publish()'::regprocedure LOOP EXECUTE format('DROP TRIGGER %I ON public.posts',t.tgname); END LOOP; END $$;
CREATE FUNCTION rsm_private.capture_review_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.posts;
BEGIN
 IF NEW.decision='pending' THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.posts WHERE id=NEW.post_id FOR UPDATE;
 NEW.reviewed_revision:=p.content_revision;NEW.decided_at:=clock_timestamp();NEW.decided_by:=auth.uid();
 INSERT INTO public.post_review_events(post_id,client_id,revision,decision,feedback,actor_id,actor_name,snapshot)
 VALUES(p.id,p.client_id,p.content_revision,NEW.decision,NEW.feedback,auth.uid(),(SELECT name FROM public.profiles WHERE id=auth.uid()),
 jsonb_build_object('title',p.title,'caption',p.caption,'script',p.script,'headline',p.headline,'slides',p.slides,'date',p.scheduled_date,'files',coalesce((SELECT jsonb_agg(jsonb_build_object('storage_path',f.storage_path,'file_name',f.file_name,'mime_type',f.mime_type)) FROM public.post_files f WHERE f.post_id=p.id),'[]'::jsonb)));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION rsm_private.capture_review_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_review_event BEFORE INSERT OR UPDATE OF decision ON public.post_approvals FOR EACH ROW EXECUTE FUNCTION rsm_private.capture_review_event();
CREATE FUNCTION public.decide_my_account_posts(_items jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb;n integer:=0;
BEGIN
 IF jsonb_typeof(_items)<>'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Selecione entre 1 e 50 conteúdos'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_items) ORDER BY value->>'id' LOOP
 PERFORM rsm_private.decide_account_post((item->>'id')::uuid,(item->>'updated_at')::timestamptz,'approved',NULL);n:=n+1;
 END LOOP; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.decide_my_account_posts(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_my_account_posts(jsonb) TO authenticated;

CREATE FUNCTION rsm_private.create_approval_link(_post_id uuid,_days integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;pid uuid;rev integer;linkid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 IF _days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Validade entre 1 e 30 dias'; END IF;
 SELECT p.id,p.content_revision INTO pid,rev FROM public.posts p JOIN public.clients c ON c.id=p.client_id WHERE p.id=_post_id AND p.status IN ('review','changes_requested') AND c.user_id IS NOT NULL AND c.status='active' AND NOT c.churned;
 IF pid IS NULL THEN RAISE EXCEPTION 'O conteúdo precisa estar em aprovação e o cliente deve ter um acesso vinculado'; END IF;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 INSERT INTO public.approval_links(post_id,token_hash,revision,expires_at,created_by) VALUES(pid,encode(sha256(convert_to(token,'UTF8')),'hex'),rev,now()+make_interval(days=>_days),auth.uid()) RETURNING id INTO linkid;
 RETURN jsonb_build_object('token',token,'id',linkid,'expires_at',now()+make_interval(days=>_days));
END $$;
REVOKE ALL ON FUNCTION rsm_private.create_approval_link(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.create_approval_link(uuid,integer) TO authenticated;
CREATE FUNCTION public.create_approval_link(_post_id uuid,_days integer DEFAULT 7) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT rsm_private.create_approval_link(_post_id,_days); $$;
REVOKE ALL ON FUNCTION public.create_approval_link(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_approval_link(uuid,integer) TO authenticated;
CREATE FUNCTION rsm_private.approval_link_post(_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.posts;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre com o acesso da conta autorizada' USING ERRCODE='42501'; END IF;
 SELECT x.* INTO p FROM public.approval_links l JOIN public.posts x ON x.id=l.post_id JOIN public.clients c ON c.id=x.client_id
 WHERE l.token_hash=encode(sha256(convert_to(_token,'UTF8')),'hex') AND l.revoked_at IS NULL AND l.expires_at>now() AND l.revision=x.content_revision AND c.user_id=auth.uid() AND NOT c.churned AND c.status='active';
 IF p.id IS NULL OR NOT rsm_private.portal_post_allowed(p.id) THEN RAISE EXCEPTION 'Link expirado, revogado, atualizado ou não autorizado para esta conta'; END IF;
 RETURN (SELECT to_jsonb(v) FROM rsm_private.portal_posts() v WHERE v.id=p.id);
END $$;
REVOKE ALL ON FUNCTION rsm_private.approval_link_post(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.approval_link_post(text) TO authenticated;
CREATE FUNCTION public.get_approval_link_post(_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT rsm_private.approval_link_post(_token); $$;
REVOKE ALL ON FUNCTION public.get_approval_link_post(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_approval_link_post(text) TO authenticated;
CREATE FUNCTION public.decide_approval_link(_token text,_expected_updated_at timestamptz,_decision public.approval_decision,_feedback text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p jsonb;
BEGIN p:=rsm_private.approval_link_post(_token); RETURN rsm_private.decide_account_post((p->>'id')::uuid,_expected_updated_at,_decision,_feedback); END $$;
REVOKE ALL ON FUNCTION public.decide_approval_link(text,timestamptz,public.approval_decision,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_approval_link(text,timestamptz,public.approval_decision,text) TO authenticated;

CREATE OR REPLACE FUNCTION rsm_private.decide_account_post(_post_id uuid, _expected_updated_at timestamptz, _decision public.approval_decision, _feedback text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.posts; settings public.client_portal_settings; approval_id uuid; target public.post_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT post.* INTO p FROM public.posts post JOIN public.clients c ON c.id=post.client_id
    WHERE post.id=_post_id AND c.user_id=auth.uid() FOR UPDATE OF post;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Conteúdo não disponível' USING ERRCODE='42501'; END IF;
  IF NOT rsm_private.portal_post_allowed(p.id) OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p.client_id AND status='active' AND NOT churned) THEN RAISE EXCEPTION 'Aprovação indisponível para esta conta' USING ERRCODE='42501'; END IF;
  IF p.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'O conteúdo foi atualizado. Reabra a versão mais recente antes de decidir.'; END IF;
  IF p.status NOT IN ('review','changes_requested') THEN RAISE EXCEPTION 'Este conteúdo não está aberto para aprovação.'; END IF;
  SELECT * INTO settings FROM public.client_portal_settings WHERE client_id=p.client_id;
  IF _decision='approved' THEN
    IF NOT COALESCE(settings.can_approve,true) THEN RAISE EXCEPTION 'Aprovação não permitida' USING ERRCODE='42501'; END IF;
    target := 'approved';
  ELSIF _decision IN ('changes_requested','rejected') THEN
    IF NOT COALESCE(settings.can_request_changes,true) THEN RAISE EXCEPTION 'Alterações não permitidas' USING ERRCODE='42501'; END IF;
    IF _decision='changes_requested' AND NULLIF(btrim(_feedback),'') IS NULL THEN RAISE EXCEPTION 'Descreva o que gostaria de alterar.'; END IF;
    target := CASE WHEN _decision='rejected' THEN 'archived'::public.post_status ELSE 'changes_requested'::public.post_status END;
  ELSE RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT id INTO approval_id FROM public.post_approvals WHERE post_id=p.id ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF approval_id IS NULL THEN
    INSERT INTO public.post_approvals(post_id,client_id,decision,feedback,decided_by)
      VALUES(p.id,p.client_id,_decision,NULLIF(btrim(_feedback),''),auth.uid());
  ELSE
    UPDATE public.post_approvals SET decision=_decision,feedback=NULLIF(btrim(_feedback),''),decided_by=auth.uid(),updated_at=now() WHERE id=approval_id;
  END IF;
  -- The legacy trigger does not approve a changes_requested post, or repeat decisions.
  UPDATE public.posts SET status=target,updated_at=now() WHERE id=p.id;
  RETURN jsonb_build_object('post_id',p.id,'status',target);
END $$;
REVOKE ALL ON FUNCTION rsm_private.decide_account_post(uuid,timestamptz,public.approval_decision,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.decide_account_post(uuid,timestamptz,public.approval_decision,text) TO authenticated;
REVOKE ALL ON public.portal_posts FROM anon;
CREATE FUNCTION public.clock_post_update() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN NEW.updated_at:=clock_timestamp();RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.clock_post_update() FROM PUBLIC,anon;
CREATE TRIGGER zzz_clock_post_update BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.clock_post_update();
CREATE FUNCTION rsm_private.review_history(_post_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 IF NOT(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) AND NOT rsm_private.portal_post_allowed(_post_id,'can_view_history') THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'revision',revision,'decision',decision,'feedback',feedback,'actor_name',actor_name,'created_at',created_at,'snapshot',CASE WHEN rsm_private.portal_post_allowed(_post_id,'can_view_captions') OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') THEN snapshot ELSE snapshot-'caption'-'script'-'headline'-'slides' END) ORDER BY created_at DESC) FROM public.post_review_events WHERE post_id=_post_id),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION rsm_private.review_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.review_history(uuid) TO authenticated;
CREATE FUNCTION public.get_post_review_history(_post_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT rsm_private.review_history(_post_id); $$;
REVOKE ALL ON FUNCTION public.get_post_review_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_post_review_history(uuid) TO authenticated;
CREATE FUNCTION rsm_private.review_media_access(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.post_review_events e CROSS JOIN LATERAL jsonb_array_elements(e.snapshot->'files') f
 WHERE f->>'storage_path'=_path AND rsm_private.portal_post_allowed(e.post_id,'can_view_media') AND rsm_private.portal_post_allowed(e.post_id,'can_view_history'));
$$;
REVOKE ALL ON FUNCTION rsm_private.review_media_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.review_media_access(text) TO authenticated;
CREATE POLICY portal_review_media_storage ON storage.objects FOR SELECT TO authenticated USING(bucket_id='post-files' AND rsm_private.review_media_access(name));
-- Preserve physical files referenced by a decision, even if removed from the current creative.
CREATE FUNCTION rsm_private.media_is_reviewed(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.post_review_events e CROSS JOIN LATERAL jsonb_array_elements(e.snapshot->'files') f WHERE f->>'storage_path'=_path);
$$;
REVOKE ALL ON FUNCTION rsm_private.media_is_reviewed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.media_is_reviewed(text) TO authenticated;
CREATE POLICY retain_reviewed_media ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'post-files' OR NOT rsm_private.media_is_reviewed(name));
CREATE POLICY immutable_reviewed_media ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'post-files' OR NOT rsm_private.media_is_reviewed(name)) WITH CHECK(bucket_id<>'post-files' OR NOT rsm_private.media_is_reviewed(name));

CREATE OR REPLACE FUNCTION rsm_private.my_account_workspace()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE account public.clients; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT c.* INTO account FROM public.clients c WHERE c.user_id = auth.uid() ORDER BY c.created_at LIMIT 1;
  IF account.id IS NULL THEN RETURN NULL; END IF;
  result := jsonb_build_object('id',account.id,'name',account.name,'logo_url',account.logo_url,'plan',account.plan,'start_date',account.start_date,'status',account.status,'can_view_finance',coalesce((SELECT can_view_finance FROM public.client_portal_settings WHERE client_id=account.id),false));
  RETURN result || jsonb_build_object(
    'charges', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
      SELECT id,service_label,amount,due_date,CASE WHEN status='pending' AND due_date < (now() AT TIME ZONE 'America/Fortaleza')::date THEN 'overdue' ELSE status::text END AS status,paid_date,payment_url
      FROM public.finance_charges WHERE client_id=account.id AND EXISTS(SELECT 1 FROM public.client_portal_settings s WHERE s.client_id=account.id AND s.can_view_finance) ORDER BY due_date DESC
    ) q),'[]'::jsonb),
    'contracts', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
      SELECT id,service_label,amount,periodicity,start_date,end_date,status FROM public.finance_contracts WHERE client_id=account.id AND EXISTS(SELECT 1 FROM public.client_portal_settings s WHERE s.client_id=account.id AND s.can_view_finance) ORDER BY created_at DESC
    ) q),'[]'::jsonb),
    'signed_contracts', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
      SELECT id,title,status,signed_url,signature_provider,expires_at,storage_path FROM public.client_contracts WHERE client_id=account.id ORDER BY created_at DESC
    ) q),'[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION rsm_private.my_account_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.my_account_workspace() TO authenticated;

CREATE OR REPLACE FUNCTION rsm_private.shared_post_versions(_post_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE staff boolean; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 staff:=public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team');
 IF NOT staff AND NOT EXISTS(SELECT 1 FROM public.posts p JOIN public.clients c ON c.id=p.client_id JOIN public.client_portal_settings s ON s.client_id=c.id
 WHERE p.id=_post_id AND c.user_id=auth.uid() AND s.can_view_history AND s.can_view_captions AND s.can_view_posts AND p.status::text=ANY(s.visible_statuses) AND p.status IN ('review','changes_requested','approved','to_schedule','scheduled','published')) THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'created_at',v.created_at,
 'title',v.snapshot->>'title','caption',v.snapshot->>'caption','script',v.snapshot->>'script','headline',v.snapshot->>'headline','slides',v.snapshot->'slides') ORDER BY v.version_number DESC),'[]'::jsonb)
 INTO result FROM public.post_versions v WHERE v.post_id=_post_id AND (staff OR v.snapshot->>'status' IN ('review','changes_requested','approved','to_schedule','scheduled','published'));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION rsm_private.shared_post_versions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.shared_post_versions(uuid) TO authenticated;
DROP POLICY "Client can read own metrics" ON public.post_metrics;
CREATE POLICY portal_metrics_read ON public.post_metrics FOR SELECT TO authenticated USING(public.can_access_portal_post(post_id));
ALTER TABLE public.client_onboarding_steps ADD COLUMN responses jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(responses)='object' AND length(responses::text)<=12000);
ALTER TABLE public.client_onboarding_steps DROP CONSTRAINT client_onboarding_steps_step_key_check;
ALTER TABLE public.client_onboarding_steps ADD CHECK(step_key IN ('contract','payment','briefing','access','identity','kickoff','strategy','calendar','account','approvers'));
CREATE FUNCTION rsm_private.save_intake(_client_id uuid,_step text,_responses jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=_client_id AND c.status='active' AND NOT c.churned AND (c.user_id=auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))) THEN RAISE EXCEPTION 'Conta não autorizada' USING ERRCODE='42501';END IF;
 IF _step NOT IN ('account','briefing','identity','access','approvers','kickoff') OR jsonb_typeof(_responses)<>'object' OR length(_responses::text)>12000 THEN RAISE EXCEPTION 'Etapa inválida';END IF;
 INSERT INTO public.client_onboarding_steps(client_id,step_key,owner_scope,responses,status) VALUES(_client_id,_step,'client',_responses,'progress') ON CONFLICT(client_id,step_key) DO UPDATE SET responses=excluded.responses;
 IF _step='account' THEN UPDATE public.clients SET responsible=coalesce(nullif(_responses->>'responsible',''),responsible),email=coalesce(nullif(_responses->>'email',''),email),phone=coalesce(nullif(_responses->>'phone',''),phone) WHERE id=_client_id;END IF;
END $$;
REVOKE ALL ON FUNCTION rsm_private.save_intake(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.save_intake(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.save_account_intake(_client_id uuid,_step text,_responses jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT rsm_private.save_intake(_client_id,_step,_responses);$$;
REVOKE ALL ON FUNCTION public.save_account_intake(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_account_intake(uuid,text,jsonb) TO authenticated;
ALTER TABLE public.clients ADD COLUMN format_quotas jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(format_quotas)='object');
ALTER TABLE public.client_requests DROP CONSTRAINT client_requests_kind_check;
ALTER TABLE public.client_requests ADD CHECK(kind IN ('support','complaint','material','extra'));
ALTER TABLE public.client_requests ADD COLUMN quote_amount numeric(12,2) CHECK(quote_amount>=0);
ALTER TABLE public.client_requests ADD COLUMN quote_scope text NOT NULL DEFAULT '' CHECK(length(quote_scope)<=4000);
ALTER TABLE public.client_requests ADD COLUMN quote_revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.client_requests ADD COLUMN accepted_revision integer;
ALTER TABLE public.client_requests ADD COLUMN accepted_at timestamptz;
ALTER TABLE public.client_requests ADD COLUMN accepted_by uuid REFERENCES public.profiles(id);
DROP POLICY requests_client_insert ON public.client_requests;
CREATE POLICY requests_client_insert ON public.client_requests FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND status='open' AND response='' AND kind IN ('support','complaint','extra') AND due_date IS NULL AND quote_amount IS NULL AND quote_scope='' AND accepted_at IS NULL AND accepted_by IS NULL AND accepted_revision IS NULL AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_requests.client_id AND c.user_id=auth.uid() AND NOT c.churned AND c.status='active'));
CREATE FUNCTION public.invalidate_extra_quote() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN IF (NEW.quote_amount,NEW.quote_scope) IS DISTINCT FROM (OLD.quote_amount,OLD.quote_scope) THEN NEW.quote_revision:=OLD.quote_revision+1;NEW.accepted_at:=NULL;NEW.accepted_by:=NULL;NEW.accepted_revision:=NULL;END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.invalidate_extra_quote() FROM PUBLIC,anon;
CREATE TRIGGER invalidate_extra_quote BEFORE UPDATE ON public.client_requests FOR EACH ROW EXECUTE FUNCTION public.invalidate_extra_quote();
CREATE FUNCTION rsm_private.accept_extra(_id uuid,_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.client_requests;
BEGIN
 SELECT * INTO r FROM public.client_requests WHERE id=_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=r.client_id AND c.user_id=auth.uid() AND c.status='active' AND NOT c.churned) THEN RAISE EXCEPTION 'Conta não autorizada' USING ERRCODE='42501';END IF;
 IF r.kind<>'extra' OR r.quote_revision IS DISTINCT FROM _revision OR r.quote_amount IS NULL OR length(trim(r.quote_scope))=0 OR r.status='done' THEN RAISE EXCEPTION 'Orçamento indisponível ou atualizado. Reabra a solicitação.';END IF;
 UPDATE public.client_requests SET accepted_revision=quote_revision,accepted_at=clock_timestamp(),accepted_by=auth.uid() WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION rsm_private.accept_extra(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.accept_extra(uuid,integer) TO authenticated;
CREATE FUNCTION public.accept_extra_quote(_id uuid,_revision integer) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT rsm_private.accept_extra(_id,_revision);$$;
REVOKE ALL ON FUNCTION public.accept_extra_quote(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_extra_quote(uuid,integer) TO authenticated;
ALTER TABLE public.posts ADD COLUMN extra_request_id uuid REFERENCES public.client_requests(id);
CREATE FUNCTION public.validate_extra_content() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN IF NEW.extra_request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_requests r WHERE r.id=NEW.extra_request_id AND r.client_id=NEW.client_id AND r.kind='extra' AND r.accepted_at IS NOT NULL AND r.accepted_revision=r.quote_revision) THEN RAISE EXCEPTION 'O conteúdo extra exige orçamento aceito da mesma conta';END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.validate_extra_content() FROM PUBLIC,anon;
CREATE TRIGGER validate_extra_content BEFORE INSERT OR UPDATE OF extra_request_id,client_id ON public.posts FOR EACH ROW EXECUTE FUNCTION public.validate_extra_content();
-- Recreate the safe projection after extending its composite row type.
CREATE OR REPLACE VIEW public.portal_posts WITH(security_invoker=true) AS SELECT * FROM rsm_private.portal_posts();
ALTER TABLE public.client_report_drafts ADD COLUMN learnings text NOT NULL DEFAULT '' CHECK(length(learnings)<=8000);
ALTER TABLE public.client_monthly_reports ADD COLUMN learnings text NOT NULL DEFAULT '' CHECK(length(learnings)<=8000);
CREATE OR REPLACE FUNCTION public.publish_monthly_report(_client_id uuid,_month date,_expected_updated_at timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE draft public.client_report_drafts; rid uuid; snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 SELECT * INTO draft FROM public.client_report_drafts WHERE client_id=_client_id AND report_month=_month FOR UPDATE;
 IF NOT FOUND OR draft.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'O rascunho mudou. Recarregue antes de publicar.'; END IF;
 IF length(trim(draft.analysis))=0 THEN RAISE EXCEPTION 'Escreva a análise da RSM antes de publicar.'; END IF;
 snapshot:=public.get_monthly_report_metrics(_client_id,_month);
 INSERT INTO public.client_monthly_reports(client_id,report_month,analysis,next_steps,learnings,metrics,published_by)
 VALUES(_client_id,_month,trim(draft.analysis),trim(draft.next_steps),trim(draft.learnings),snapshot,auth.uid())
 ON CONFLICT(client_id,report_month) DO UPDATE SET analysis=excluded.analysis,next_steps=excluded.next_steps,learnings=excluded.learnings,metrics=excluded.metrics,published_by=excluded.published_by,published_at=now()
 RETURNING id INTO rid;
 INSERT INTO public.client_timeline(client_id,event_type,title,detail,visibility,actor_id)
 VALUES(_client_id,'report_published','Relatório mensal disponível',to_char(_month,'MM/YYYY') || ' · Confira a análise e os próximos passos na aba Relatórios.','client',auth.uid());
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.publish_monthly_report(uuid,date,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_monthly_report(uuid,date,timestamptz) TO authenticated;
ALTER TABLE public.finance_charges ADD COLUMN competence date;
UPDATE public.finance_charges SET competence=date_trunc('month',due_date)::date WHERE competence IS NULL;
ALTER TABLE public.finance_charges ADD CHECK(extract(day FROM competence)=1);
CREATE FUNCTION public.default_charge_competence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN IF NEW.competence IS NULL THEN NEW.competence:=date_trunc('month',NEW.due_date)::date;END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.default_charge_competence() FROM PUBLIC,anon;
CREATE TRIGGER default_charge_competence BEFORE INSERT ON public.finance_charges FOR EACH ROW EXECUTE FUNCTION public.default_charge_competence();
ALTER TABLE public.posts ADD COLUMN publication_source text;
ALTER TABLE public.posts ADD COLUMN publication_confirmed_at timestamptz;
CREATE FUNCTION public.record_publication_source() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN IF NEW.status IN ('scheduled','published') AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN NEW.publication_source:='manual';NEW.publication_confirmed_at:=clock_timestamp();END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.record_publication_source() FROM PUBLIC,anon;
CREATE TRIGGER z_record_publication_source BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.record_publication_source();
CREATE OR REPLACE VIEW public.portal_posts WITH(security_invoker=true) AS SELECT * FROM rsm_private.portal_posts();
