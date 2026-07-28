CREATE OR REPLACE FUNCTION public.notify_on_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _post RECORD;
  _client_name TEXT;
  _decision_label TEXT;
  _staff RECORD;
BEGIN
  IF NEW.decision = 'pending' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.decision IS NOT DISTINCT FROM NEW.decision THEN RETURN NEW; END IF;

  SELECT * INTO _post FROM public.posts WHERE id = NEW.post_id;
  SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
  _decision_label := CASE NEW.decision
    WHEN 'approved' THEN 'aprovou'
    WHEN 'rejected' THEN 'rejeitou'
    WHEN 'changes_requested' THEN 'solicitou alterações em'
    ELSE 'atualizou' END;

  FOR _staff IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('administrator','team')
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      _staff.user_id,
      COALESCE(_client_name,'Cliente') || ' ' || _decision_label || ' "' || COALESCE(_post.title,'publicação') || '"',
      COALESCE(NEW.feedback, ''),
      '/posts?open=' || NEW.post_id::text || '&comments=1'
    );
  END LOOP;

  INSERT INTO public.post_activity_log (post_id, client_id, actor_id, action, detail)
  VALUES (NEW.post_id, NEW.client_id, NEW.decided_by, 'approval_' || NEW.decision::text, NEW.feedback);

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_approval() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _post RECORD;
  _author_name TEXT;
  _staff RECORD;
BEGIN
  SELECT * INTO _post FROM public.posts WHERE id = NEW.post_id;
  SELECT COALESCE(name, 'Alguém') INTO _author_name FROM public.profiles WHERE id = NEW.author_id;

  FOR _staff IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('administrator','team') AND ur.user_id <> NEW.author_id
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      _staff.user_id,
      _author_name || ' comentou em "' || COALESCE(_post.title,'publicação') || '"',
      LEFT(NEW.content, 160),
      '/posts?open=' || NEW.post_id::text || '&comment=' || NEW.id::text
    );
  END LOOP;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;