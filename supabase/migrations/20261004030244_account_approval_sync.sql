-- One atomic decision for the version actually reviewed by the account owner.
CREATE FUNCTION rsm_private.decide_account_post(_post_id uuid, _expected_updated_at timestamptz, _decision public.approval_decision, _feedback text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.posts; settings public.client_portal_settings; approval_id uuid; target public.post_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT post.* INTO p FROM public.posts post JOIN public.clients c ON c.id=post.client_id
    WHERE post.id=_post_id AND c.user_id=auth.uid() FOR UPDATE OF post;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Conteúdo não disponível' USING ERRCODE='42501'; END IF;
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
CREATE FUNCTION public.decide_my_account_post(_post_id uuid, _expected_updated_at timestamptz, _decision public.approval_decision, _feedback text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT rsm_private.decide_account_post(_post_id,_expected_updated_at,_decision,_feedback);
$$;
REVOKE ALL ON FUNCTION public.decide_my_account_post(uuid,timestamptz,public.approval_decision,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_my_account_post(uuid,timestamptz,public.approval_decision,text) TO authenticated;
