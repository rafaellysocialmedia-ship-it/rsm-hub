
-- 1) New post status "changes_requested"
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- 2) Update sync_post_status_on_approval to route "changes_requested" to new status
CREATE OR REPLACE FUNCTION public.sync_post_status_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.decision IS NOT DISTINCT FROM NEW.decision THEN
    RETURN NEW;
  END IF;

  IF NEW.decision = 'approved' THEN
    UPDATE public.posts
       SET status = 'approved'::post_status, updated_at = now()
     WHERE id = NEW.post_id
       AND status IN ('review','idea','production');
  ELSIF NEW.decision = 'rejected' THEN
    UPDATE public.posts
       SET status = 'archived'::post_status, updated_at = now()
     WHERE id = NEW.post_id
       AND status NOT IN ('archived','published');
  ELSIF NEW.decision = 'changes_requested' THEN
    UPDATE public.posts
       SET status = 'changes_requested'::post_status, updated_at = now()
     WHERE id = NEW.post_id
       AND status NOT IN ('archived','published');
  END IF;

  RETURN NEW;
END $function$;

-- 3) Sync tasks with post status
CREATE OR REPLACE FUNCTION public.sync_task_with_post_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'scheduled'::post_status OR NEW.status = 'published'::post_status THEN
    UPDATE public.tasks
       SET status = 'done'::task_status, updated_at = now()
     WHERE source_post_id = NEW.id
       AND status <> 'done'::task_status;
  ELSIF NEW.status = 'production'::post_status THEN
    UPDATE public.tasks
       SET status = 'production'::task_status, updated_at = now()
     WHERE source_post_id = NEW.id
       AND status IN ('todo'::task_status, 'waiting_client'::task_status, 'review'::task_status);
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS sync_task_with_post_status_trigger ON public.posts;
CREATE TRIGGER sync_task_with_post_status_trigger
AFTER UPDATE OF status ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_with_post_status();

-- 4) Allow team members to view profiles (needed for comment author display)
DROP POLICY IF EXISTS "Team can view all profiles" ON public.profiles;
CREATE POLICY "Team can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'team'::app_role));

-- 5) Deadline notifications function
CREATE OR REPLACE FUNCTION public.notify_client_deadlines()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _c RECORD;
  _staff RECORD;
  _today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _diff INT;
  _label TEXT;
  _kind TEXT;
BEGIN
  FOR _c IN
    SELECT id, name, profile_project_deadline, editorial_deadline
    FROM public.clients
    WHERE status = 'active'
      AND (profile_project_deadline IS NOT NULL OR editorial_deadline IS NOT NULL)
  LOOP
    FOR _kind IN SELECT unnest(ARRAY['profile','editorial'])
    LOOP
      IF _kind = 'profile' AND _c.profile_project_deadline IS NULL THEN CONTINUE; END IF;
      IF _kind = 'editorial' AND _c.editorial_deadline IS NULL THEN CONTINUE; END IF;

      _diff := (CASE WHEN _kind='profile' THEN _c.profile_project_deadline ELSE _c.editorial_deadline END) - _today;
      _label := CASE WHEN _kind='profile' THEN 'Projeto de Perfil' ELSE 'Editorial' END;

      IF _diff NOT IN (7, 3, 1, 0, -1) THEN CONTINUE; END IF;

      FOR _staff IN
        SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('administrator','team')
      LOOP
        IF EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = _staff.user_id
            AND n.body = _c.id::text || ':' || _kind || ':' || _diff::text
            AND n.title LIKE 'Prazo%'
        ) THEN CONTINUE; END IF;

        INSERT INTO public.notifications (user_id, title, body, link)
        VALUES (
          _staff.user_id,
          CASE
            WHEN _diff < 0 THEN 'Prazo VENCIDO: ' || _label || ' — ' || _c.name
            WHEN _diff = 0 THEN 'Prazo hoje: ' || _label || ' — ' || _c.name
            ELSE 'Prazo próximo (' || _diff || 'd): ' || _label || ' — ' || _c.name
          END,
          _c.id::text || ':' || _kind || ':' || _diff::text,
          '/clients/' || _c.id::text
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $function$;

REVOKE EXECUTE ON FUNCTION public.notify_client_deadlines() FROM anon, authenticated;

-- 6) Schedule the deadline check daily at 9am BRT (12 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-client-deadlines-daily') THEN
    PERFORM cron.unschedule('notify-client-deadlines-daily');
  END IF;
  PERFORM cron.schedule(
    'notify-client-deadlines-daily',
    '0 12 * * *',
    $cron$ SELECT public.notify_client_deadlines(); $cron$
  );
END $$;
