-- Accepted commercial terms cannot silently change while keeping the old acceptance.
CREATE OR REPLACE FUNCTION public.guard_commercial_proposal() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.stage='converted' THEN RAISE EXCEPTION 'Proposta convertida: edite o cadastro ou contrato do cliente'; END IF;
 IF TG_OP='UPDATE' AND OLD.stage='accepted' AND NEW.stage='accepted' AND
 (NEW.prospect_name,NEW.company,NEW.email,NEW.plan,NEW.scope,NEW.amount,NEW.start_date,NEW.end_date,NEW.first_due_date) IS DISTINCT FROM
 (OLD.prospect_name,OLD.company,OLD.email,OLD.plan,OLD.scope,OLD.amount,OLD.start_date,OLD.end_date,OLD.first_due_date)
 THEN RAISE EXCEPTION 'Volte a proposta para elaboração antes de alterar os termos aceitos'; END IF;
 IF NEW.stage='accepted' AND (TG_OP='INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
 IF length(trim(NEW.acceptance_note))<5 THEN RAISE EXCEPTION 'Registre como e quando o cliente aceitou a proposta'; END IF;
 NEW.accepted_at:=now(); NEW.accepted_by:=auth.uid(); END IF;
 IF NEW.stage='converted' AND (TG_OP='INSERT' OR OLD.stage<>'accepted' OR NEW.client_id IS NULL OR NEW.contract_id IS NULL OR NEW.converted_at IS NULL) THEN RAISE EXCEPTION 'Use a conversão da proposta aceita'; END IF;
 NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;

-- Return only shared text fields from historical snapshots (which also contain internal notes).
DROP POLICY IF EXISTS "Clients view versions of own posts" ON public.post_versions;
CREATE FUNCTION rsm_private.shared_post_versions(_post_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE staff boolean; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 staff:=public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team');
 IF NOT staff AND NOT EXISTS(SELECT 1 FROM public.posts p JOIN public.clients c ON c.id=p.client_id JOIN public.client_portal_settings s ON s.client_id=c.id
 WHERE p.id=_post_id AND c.user_id=auth.uid() AND s.can_view_history AND p.status IN ('review','changes_requested','approved','to_schedule','scheduled','published')) THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'created_at',v.created_at,
 'title',v.snapshot->>'title','caption',v.snapshot->>'caption','script',v.snapshot->>'script','headline',v.snapshot->>'headline','slides',v.snapshot->'slides') ORDER BY v.version_number DESC),'[]'::jsonb)
 INTO result FROM public.post_versions v WHERE v.post_id=_post_id AND (staff OR v.snapshot->>'status' IN ('review','changes_requested','approved','to_schedule','scheduled','published'));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION rsm_private.shared_post_versions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.shared_post_versions(uuid) TO authenticated;
CREATE FUNCTION public.get_shared_post_versions(_post_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT rsm_private.shared_post_versions(_post_id); $$;
REVOKE ALL ON FUNCTION public.get_shared_post_versions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_shared_post_versions(uuid) TO authenticated;
ALTER TABLE public.post_versions ADD CONSTRAINT post_versions_post_id_id_unique UNIQUE(post_id,id);
ALTER TABLE public.post_comments ADD COLUMN version_id uuid;
ALTER TABLE public.post_comments ADD CONSTRAINT comment_version_same_post FOREIGN KEY(post_id,version_id) REFERENCES public.post_versions(post_id,id);
CREATE INDEX post_comments_version_id ON public.post_comments(version_id) WHERE version_id IS NOT NULL;

CREATE FUNCTION public.log_account_task_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.client_id IS NOT NULL AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
 INSERT INTO public.client_timeline(client_id,event_type,title,detail,visibility,actor_id)
 VALUES(NEW.client_id,'task_update',CASE WHEN TG_OP='INSERT' THEN 'Demanda criada' ELSE 'Demanda atualizada' END,NEW.title,'internal',auth.uid()); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_account_task_event() FROM PUBLIC,anon;
CREATE TRIGGER log_account_task AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_account_task_event();
