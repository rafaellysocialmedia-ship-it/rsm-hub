-- Lote 6 · Fluxo de conteúdo em 6 etapas (Pauta, Produção, Revisão interna,
-- Aprovação do cliente, Agendado, Publicado) + Arquivado fora do fluxo.
-- Princípio: mapear, não renomear. Os valores do enum post_status continuam.
-- Idempotente: pode ser executado mais de uma vez.

-- 0. Chave de recurso: o bloqueio da Revisão interna começa DESLIGADO e é
--    ligado na publicação das telas novas.
CREATE TABLE IF NOT EXISTS rsm_private.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rsm_private.feature_flags(key, enabled)
VALUES ('internal_review_required', false)
ON CONFLICT (key) DO NOTHING;
ALTER TABLE rsm_private.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION rsm_private.flag(_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT enabled FROM rsm_private.feature_flags WHERE key = _key), false);
$$;
REVOKE ALL ON FUNCTION rsm_private.flag(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.flag(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.content_flow_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('internal_review_required', rsm_private.flag('internal_review_required'));
$$;
REVOKE ALL ON FUNCTION public.content_flow_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_flow_settings() TO authenticated;

-- 1. Selo "Gravação" dentro de Produção.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS in_recording boolean NOT NULL DEFAULT false;

-- O editor também grava o selo Gravação.
create or replace function public.save_calendar_post(_post_id uuid,_expected_updated_at timestamptz,_patch jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.posts; n public.posts;begin
 if not public.can_edit_calendar() then raise exception 'Sem permissão para editar publicações' using errcode='42501';end if;
 select * into p from public.posts where id=_post_id for update;
 if not found then raise exception 'Publicação indisponível';end if;
 if p.updated_at is distinct from _expected_updated_at then raise exception 'Conflito: outra alteração foi salva. Seu rascunho foi mantido. Consulte a versão atual antes de salvar' using errcode='40001';end if;
 if _patch ? 'client_id' and (_patch->>'client_id')::uuid is distinct from p.client_id then raise exception 'O editor permanece vinculado à conta original';end if;
 if exists(select 1 from jsonb_object_keys(_patch) k where k not in ('title','caption','headline','subheadline','script','slides','cta','hashtags','social_network','social_networks','format','objective','theme','pillar','status','recurrence','scheduled_date','scheduled_time','extra_request_id','client_id','in_recording')) then raise exception 'Campo não permitido';end if;
 n:=jsonb_populate_record(p,_patch);
 if nullif(trim(n.title),'') is null then raise exception 'Título obrigatório';end if;
 update public.posts set title=n.title,caption=n.caption,headline=n.headline,subheadline=n.subheadline,script=n.script,slides=n.slides,cta=n.cta,hashtags=n.hashtags,social_network=n.social_network,social_networks=n.social_networks,format=n.format,objective=n.objective,theme=n.theme,pillar=n.pillar,status=n.status,recurrence=n.recurrence,scheduled_date=n.scheduled_date,scheduled_time=n.scheduled_time,extra_request_id=n.extra_request_id,in_recording=n.in_recording where id=p.id returning * into n;
 return to_jsonb(n);end$$;

-- 2. Nova regra para zerar aprovação: só texto, mídia ou formato.
--    Data, hora e redes mantêm a aprovação (registro e aviso ficam no gatilho 6).
CREATE OR REPLACE FUNCTION public.guard_post_content_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE content_changed boolean; gated boolean;
BEGIN
  content_changed :=
    (NEW.title, NEW.caption, NEW.headline, NEW.subheadline, NEW.script, NEW.slides, NEW.cta, NEW.hashtags, NEW.format)
    IS DISTINCT FROM
    (OLD.title, OLD.caption, OLD.headline, OLD.subheadline, OLD.script, OLD.slides, OLD.cta, OLD.hashtags, OLD.format);
  IF content_changed THEN NEW.content_revision := OLD.content_revision + 1; END IF;

  -- content_revision também sobe quando a mídia muda (bump_media_revision).
  IF NEW.content_revision IS DISTINCT FROM OLD.content_revision THEN
    NEW.updated_at := clock_timestamp();
    gated := rsm_private.flag('internal_review_required');
    IF NOT gated THEN
      -- Comportamento anterior, mantido enquanto as telas antigas estão no ar.
      IF OLD.status IN ('approved','to_schedule','scheduled','published','changes_requested') THEN
        NEW.status := 'review';
      END IF;
      UPDATE public.post_approvals
         SET decision = 'pending', reviewed_revision = NULL, decided_at = NULL,
             feedback = 'Conteúdo alterado. Nova revisão necessária.'
       WHERE post_id = NEW.id;
    ELSIF OLD.status IN ('review','approved','to_schedule','scheduled') THEN
      -- Conteúdo que já tinha passado pela revisão volta para Revisão interna.
      IF NEW.status IS NOT DISTINCT FROM OLD.status THEN NEW.status := 'editing'; END IF;
      UPDATE public.post_approvals
         SET decision = 'pending', reviewed_revision = NULL, decided_at = NULL,
             feedback = 'Conteúdo alterado. Nova revisão necessária.'
       WHERE post_id = NEW.id;
    END IF;
    -- Em ajuste (Produção) o motivo do cliente é mantido; publicado não volta ao fluxo.
  END IF;
  RETURN NEW;
END $$;

-- 3. A virada de data da madrugada não conta como edição e não avisa ninguém.
CREATE OR REPLACE FUNCTION rsm_private.rollover_unfinished_calendar_posts()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_work_day date; affected integer;
BEGIN
  PERFORM set_config('rsm.flow_context', 'rollover', true);
  current_work_day := (now() AT TIME ZONE public.calendar_timezone())::date;
  UPDATE public.posts AS p
     SET scheduled_date = current_work_day + 1,
         updated_at = clock_timestamp()
   WHERE p.scheduled_date IS NOT NULL
     AND p.scheduled_date <= current_work_day
     AND p.status IN ('idea','production','recording','editing','review','changes_requested','approved','to_schedule')
     AND (p.publication_source IS NULL OR p.publication_source = 'manual');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION rsm_private.rollover_unfinished_calendar_posts() FROM PUBLIC, anon, authenticated;

-- 4. "Ajuste solicitado" e "Pronto para publicar" visíveis para o cliente.
ALTER TABLE public.client_portal_settings
  ALTER COLUMN visible_statuses
  SET DEFAULT ARRAY['review','changes_requested','approved','to_schedule','scheduled','published']::text[];
UPDATE public.client_portal_settings
   SET visible_statuses = ARRAY(
         SELECT DISTINCT x FROM unnest(visible_statuses || ARRAY['changes_requested','to_schedule']) AS x ORDER BY x)
 WHERE NOT (visible_statuses @> ARRAY['changes_requested','to_schedule']::text[]);

-- 5. Regra única para a decisão do cliente: só a função de decisão muda o status.
DROP TRIGGER IF EXISTS post_approvals_sync_status ON public.post_approvals;
DROP FUNCTION IF EXISTS public.sync_post_status_on_approval();

-- O cliente só decide o que está em Aprovação do cliente (Ajuste solicitado é Produção).
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
  IF p.status <> 'review' THEN RAISE EXCEPTION 'Este conteúdo não está aberto para aprovação.'; END IF;
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
  UPDATE public.posts SET status=target,updated_at=now() WHERE id=p.id;
  RETURN jsonb_build_object('post_id',p.id,'status',target);
END $$;
REVOKE ALL ON FUNCTION rsm_private.decide_account_post(uuid,timestamptz,public.approval_decision,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.decide_account_post(uuid,timestamptz,public.approval_decision,text) TO authenticated;

CREATE OR REPLACE FUNCTION rsm_private.create_approval_link(_post_id uuid,_days integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE token text; pid uuid; rev integer; linkid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
  IF _days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Validade entre 1 e 30 dias'; END IF;
  SELECT p.id,p.content_revision INTO pid,rev FROM public.posts p JOIN public.clients c ON c.id=p.client_id
   WHERE p.id=_post_id AND p.status='review' AND c.user_id IS NOT NULL AND c.status='active' AND NOT c.churned;
  IF pid IS NULL THEN RAISE EXCEPTION 'O conteúdo precisa estar em Aprovação do cliente e o cliente deve ter um acesso vinculado'; END IF;
  token := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  INSERT INTO public.approval_links(post_id,token_hash,revision,expires_at,created_by)
  VALUES(pid,encode(sha256(convert_to(token,'UTF8')),'hex'),rev,now()+make_interval(days=>_days),auth.uid()) RETURNING id INTO linkid;
  RETURN jsonb_build_object('token',token,'id',linkid,'expires_at',now()+make_interval(days=>_days));
END $$;
REVOKE ALL ON FUNCTION rsm_private.create_approval_link(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.create_approval_link(uuid,integer) TO authenticated;

-- 6. Revisão interna obrigatória (quando a chave estiver ligada).
CREATE OR REPLACE FUNCTION rsm_private.internal_review_gate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ctx text := coalesce(current_setting('rsm.flow_context', true), ''); uid uuid := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM 'review' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'review' THEN RETURN NEW; END IF;
  IF ctx IN ('internal_review_approved','migration') THEN RETURN NEW; END IF;
  IF NOT rsm_private.flag('internal_review_required') THEN RETURN NEW; END IF;
  IF uid IS NULL THEN RETURN NEW; END IF; -- rotinas do sistema
  IF public.has_role(uid, 'administrator') THEN RETURN NEW; END IF; -- registrado no gatilho de eventos
  RAISE EXCEPTION 'Este post precisa passar pela Revisão interna antes de ir para o cliente.' USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION rsm_private.internal_review_gate() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS zz_internal_review_gate ON public.posts;
CREATE TRIGGER zz_internal_review_gate BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION rsm_private.internal_review_gate();

-- Eventos do fluxo: linha do tempo + avisos.
CREATE OR REPLACE FUNCTION rsm_private.post_flow_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  ctx text := coalesce(current_setting('rsm.flow_context', true), '');
  uid uuid := auth.uid();
  actor text;
  client_user uuid;
  visible text[];
  client_name text;
  old_when text; new_when text;
  title text; detail text;
  staff record;
  date_changed boolean; nets_changed boolean;
BEGIN
  IF ctx = 'migration' THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(btrim(pr.name), ''), pr.email) INTO actor FROM public.profiles pr WHERE pr.id = uid;
  actor := coalesce(actor, 'Equipe');
  SELECT c.user_id, c.name, s.visible_statuses INTO client_user, client_name, visible
    FROM public.clients c LEFT JOIN public.client_portal_settings s ON s.client_id = c.id
   WHERE c.id = NEW.client_id AND c.status = 'active' AND NOT c.churned;

  -- Mudança de data, hora ou redes: mantém a aprovação, registra e avisa o cliente.
  IF TG_OP = 'UPDATE' AND ctx <> 'rollover' THEN
    date_changed := (NEW.scheduled_date, NEW.scheduled_time) IS DISTINCT FROM (OLD.scheduled_date, OLD.scheduled_time);
    nets_changed := (NEW.social_network, NEW.social_networks) IS DISTINCT FROM (OLD.social_network, OLD.social_networks);
    IF date_changed OR nets_changed THEN
      old_when := coalesce(to_char(OLD.scheduled_date, 'DD/MM/YYYY'), 'sem data') || coalesce(' às ' || to_char(OLD.scheduled_time, 'HH24:MI'), '');
      new_when := coalesce(to_char(NEW.scheduled_date, 'DD/MM/YYYY'), 'sem data') || coalesce(' às ' || to_char(NEW.scheduled_time, 'HH24:MI'), '');
      detail := concat_ws(' · ',
        CASE WHEN date_changed THEN 'Data: ' || old_when || ' → ' || new_when END,
        CASE WHEN nets_changed THEN 'Redes: ' || coalesce(array_to_string(OLD.social_networks, ', '), OLD.social_network, '—')
                                    || ' → ' || coalesce(array_to_string(NEW.social_networks, ', '), NEW.social_network, '—') END);
      INSERT INTO public.post_activity_log(post_id, client_id, actor_id, action, detail, metadata)
      VALUES (NEW.id, NEW.client_id, uid, 'schedule_changed', detail,
              jsonb_build_object('old_date', OLD.scheduled_date, 'new_date', NEW.scheduled_date,
                                 'old_time', OLD.scheduled_time, 'new_time', NEW.scheduled_time,
                                 'old_networks', OLD.social_networks, 'new_networks', NEW.social_networks));
      IF client_user IS NOT NULL AND NEW.status IN ('review','changes_requested','approved','to_schedule','scheduled')
         AND NEW.status::text = ANY(coalesce(visible, ARRAY[]::text[])) THEN
        title := CASE WHEN date_changed
          THEN 'A data do post "' || coalesce(NEW.title, 'sem título') || '" mudou para ' || new_when
          ELSE 'As redes do post "' || coalesce(NEW.title, 'sem título') || '" mudaram para '
               || coalesce(array_to_string(NEW.social_networks, ', '), NEW.social_network, '—') END;
        INSERT INTO public.notifications(user_id, title, body, link)
        VALUES (client_user, title,
                CASE WHEN NEW.status IN ('approved','to_schedule','scheduled')
                     THEN 'O conteúdo não mudou e a sua aprovação continua valendo.'
                     ELSE 'O conteúdo não mudou.' END,
                '/portal?open=' || NEW.id::text);
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'editing' THEN
      INSERT INTO public.post_activity_log(post_id, client_id, actor_id, action, detail)
      VALUES (NEW.id, NEW.client_id, uid, 'sent_to_internal_review', 'Enviado para revisão interna por ' || actor);
      FOR staff IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
                    WHERE ur.role IN ('administrator','team') AND ur.user_id IS DISTINCT FROM uid LOOP
        INSERT INTO public.notifications(user_id, title, body, link)
        VALUES (staff.user_id,
                'Post pronto para revisão interna: "' || coalesce(NEW.title, 'sem título') || '"',
                concat_ws(' · ', client_name, 'Enviado por ' || actor),
                '/posts?open=' || NEW.id::text);
      END LOOP;
    ELSIF NEW.status = 'review' AND ctx <> 'internal_review_approved' AND uid IS NOT NULL
          AND rsm_private.flag('internal_review_required') AND public.has_role(uid, 'administrator') THEN
      INSERT INTO public.post_activity_log(post_id, client_id, actor_id, action, detail)
      VALUES (NEW.id, NEW.client_id, uid, 'internal_review_skipped', 'Revisão interna pulada por ' || actor);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION rsm_private.post_flow_events() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS zz_post_flow_events ON public.posts;
CREATE TRIGGER zz_post_flow_events AFTER INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION rsm_private.post_flow_events();

-- Aprovar a revisão interna (checklist completo) e enviar ao cliente.
CREATE OR REPLACE FUNCTION rsm_private.approve_internal_review(_post_id uuid, _checklist jsonb, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.posts; uid uuid := auth.uid(); actor text; k text;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'administrator') OR public.has_role(uid,'team')) THEN
    RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.posts WHERE id = _post_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF p.status <> 'editing' THEN RAISE EXCEPTION 'Este post não está em Revisão interna.'; END IF;
  IF _expected_updated_at IS NOT NULL AND p.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'O post foi alterado por outra pessoa. Recarregue antes de aprovar.';
  END IF;
  FOREACH k IN ARRAY ARRAY['texto','midia','legenda','data'] LOOP
    IF coalesce((_checklist ->> k)::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Marque todos os itens do checklist antes de aprovar.';
    END IF;
  END LOOP;
  SELECT coalesce(nullif(btrim(name), ''), email, 'Equipe') INTO actor FROM public.profiles WHERE id = uid;
  PERFORM set_config('rsm.flow_context', 'internal_review_approved', true);
  UPDATE public.posts SET status = 'review' WHERE id = p.id;
  PERFORM set_config('rsm.flow_context', '', true);
  INSERT INTO public.post_activity_log(post_id, client_id, actor_id, action, detail, metadata)
  VALUES (p.id, p.client_id, uid, 'internal_review_approved', 'Revisão interna aprovada por ' || coalesce(actor, 'Equipe'),
          jsonb_build_object('checklist', _checklist, 'revision', p.content_revision));
  RETURN jsonb_build_object('post_id', p.id, 'status', 'review');
END $$;
REVOKE ALL ON FUNCTION rsm_private.approve_internal_review(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.approve_internal_review(uuid, jsonb, timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.approve_internal_review(_post_id uuid, _checklist jsonb, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT rsm_private.approve_internal_review(_post_id, _checklist, _expected_updated_at);
$$;
REVOKE ALL ON FUNCTION public.approve_internal_review(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_internal_review(uuid, jsonb, timestamptz) TO authenticated;

-- Devolver para produção (comentário obrigatório, interno).
CREATE OR REPLACE FUNCTION rsm_private.return_to_production(_post_id uuid, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.posts; uid uuid := auth.uid(); actor text; note text := nullif(btrim(_comment), '');
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'administrator') OR public.has_role(uid,'team')) THEN
    RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE = '42501';
  END IF;
  IF note IS NULL OR length(note) < 3 THEN RAISE EXCEPTION 'Escreva o que precisa ser ajustado.'; END IF;
  SELECT * INTO p FROM public.posts WHERE id = _post_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF p.status <> 'editing' THEN RAISE EXCEPTION 'Este post não está em Revisão interna.'; END IF;
  SELECT coalesce(nullif(btrim(name), ''), email, 'Equipe') INTO actor FROM public.profiles WHERE id = uid;
  UPDATE public.posts SET status = 'production' WHERE id = p.id;
  INSERT INTO public.post_comments(post_id, author_id, content, is_internal)
  VALUES (p.id, uid, 'Devolvido para produção: ' || note, true);
  INSERT INTO public.post_activity_log(post_id, client_id, actor_id, action, detail)
  VALUES (p.id, p.client_id, uid, 'internal_review_returned', 'Devolvido para produção por ' || coalesce(actor, 'Equipe') || ': ' || note);
  RETURN jsonb_build_object('post_id', p.id, 'status', 'production');
END $$;
REVOKE ALL ON FUNCTION rsm_private.return_to_production(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.return_to_production(uuid, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.return_to_production(_post_id uuid, _comment text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT rsm_private.return_to_production(_post_id, _comment);
$$;
REVOKE ALL ON FUNCTION public.return_to_production(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_to_production(uuid, text) TO authenticated;

-- 7. Conversões pequenas, com cópia de segurança, linha do tempo e sem
--    disparar automações de tarefa e notificação.
CREATE TABLE IF NOT EXISTS rsm_private.post_status_backup_lote6 (
  post_id uuid PRIMARY KEY,
  old_status public.post_status NOT NULL,
  new_status public.post_status NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rsm_private.post_status_backup_lote6 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  PERFORM set_config('rsm.flow_context', 'migration', true);
  INSERT INTO rsm_private.post_status_backup_lote6(post_id, old_status, new_status)
  SELECT id, status, CASE status WHEN 'rejected' THEN 'archived'::public.post_status ELSE 'production'::public.post_status END
    FROM public.posts WHERE status IN ('rejected','recording')
  ON CONFLICT (post_id) DO NOTHING;

  ALTER TABLE public.posts DISABLE TRIGGER sync_task_with_post_status_trigger;
  ALTER TABLE public.posts DISABLE TRIGGER trg_notify_client_on_review_upd;

  FOR r IN SELECT b.post_id, b.old_status, b.new_status FROM rsm_private.post_status_backup_lote6 b
            JOIN public.posts p ON p.id = b.post_id AND p.status = b.old_status LOOP
    UPDATE public.posts
       SET status = r.new_status,
           in_recording = (r.old_status = 'recording') OR in_recording
     WHERE id = r.post_id;
    INSERT INTO public.post_activity_log(post_id, client_id, actor_id, action, detail, metadata)
    SELECT p.id, p.client_id, NULL, 'status_migrated',
           CASE r.old_status WHEN 'rejected' THEN 'Etapa convertida: Reprovado → Arquivado'
                             ELSE 'Etapa convertida: Em gravação → Produção (selo Gravação)' END,
           jsonb_build_object('old_status', r.old_status, 'new_status', r.new_status, 'lote', 6)
      FROM public.posts p WHERE p.id = r.post_id;
  END LOOP;

  ALTER TABLE public.posts ENABLE TRIGGER sync_task_with_post_status_trigger;
  ALTER TABLE public.posts ENABLE TRIGGER trg_notify_client_on_review_upd;
  PERFORM set_config('rsm.flow_context', '', true);
END $$;
