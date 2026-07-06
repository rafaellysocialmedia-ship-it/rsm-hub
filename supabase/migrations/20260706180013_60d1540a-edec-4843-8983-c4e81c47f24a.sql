-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Auto-publish function
CREATE OR REPLACE FUNCTION public.auto_publish_scheduled_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET status = 'published'::post_status,
      updated_at = now()
  WHERE status = 'scheduled'::post_status
    AND scheduled_date IS NOT NULL
    AND (scheduled_date + COALESCE(scheduled_time, '00:00:00'::time)) <= (now() AT TIME ZONE 'America/Sao_Paulo');
END $$;

REVOKE EXECUTE ON FUNCTION public.auto_publish_scheduled_posts() FROM PUBLIC, anon, authenticated;

-- Schedule every 5 minutes (unschedule if exists)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-publish-scheduled-posts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-publish-scheduled-posts',
  '*/5 * * * *',
  $$ SELECT public.auto_publish_scheduled_posts(); $$
);

-- Notify client when post enters review (awaiting approval)
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
    '/portal'
  );
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_client_on_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_client_on_review_ins ON public.posts;
DROP TRIGGER IF EXISTS trg_notify_client_on_review_upd ON public.posts;

CREATE TRIGGER trg_notify_client_on_review_ins
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_review();

CREATE TRIGGER trg_notify_client_on_review_upd
AFTER UPDATE OF status ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_review();