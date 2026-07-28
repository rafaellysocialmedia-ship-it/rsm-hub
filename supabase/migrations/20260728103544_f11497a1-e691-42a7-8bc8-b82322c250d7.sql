-- Auto publish + reschedule non-final posts past their scheduled date
CREATE OR REPLACE FUNCTION public.auto_publish_scheduled_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Publish scheduled posts whose datetime is past
  UPDATE public.posts
  SET status = 'published'::post_status,
      updated_at = now()
  WHERE status = 'scheduled'::post_status
    AND scheduled_date IS NOT NULL
    AND (scheduled_date + COALESCE(scheduled_time, '00:00:00'::time)) <= (now() AT TIME ZONE 'America/Sao_Paulo');

  -- Roll forward non-final posts stuck in the past (skip published/archived/rejected/scheduled)
  UPDATE public.posts
  SET scheduled_date = (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::date + INTERVAL '1 day',
      updated_at = now()
  WHERE status IN ('idea','production','recording','review','changes_requested','approved','to_schedule')
    AND scheduled_date IS NOT NULL
    AND scheduled_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date;
END $$;

REVOKE EXECUTE ON FUNCTION public.auto_publish_scheduled_posts() FROM PUBLIC, anon, authenticated;

-- Update review notification to deep-link to the post
CREATE OR REPLACE FUNCTION public.notify_client_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client RECORD;
BEGIN
  IF NEW.status <> 'review'::post_status THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, name, user_id INTO _client FROM public.clients WHERE id = NEW.client_id;
  IF _client.user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    _client.user_id,
    'Nova publicação para aprovar: ' || COALESCE(NEW.title, 'sem título'),
    'Uma nova publicação está aguardando sua aprovação no portal.',
    '/portal?open=' || NEW.id::text
  );
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_client_on_review() FROM PUBLIC, anon, authenticated;

-- Update approval notification to deep-link to the post
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
      '/portal?open=' || NEW.post_id::text
    );
  END LOOP;

  INSERT INTO public.post_activity_log (post_id, client_id, actor_id, action, detail)
  VALUES (NEW.post_id, NEW.client_id, NEW.decided_by, 'approval_' || NEW.decision::text, NEW.feedback);

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_approval() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_approval() TO service_role;