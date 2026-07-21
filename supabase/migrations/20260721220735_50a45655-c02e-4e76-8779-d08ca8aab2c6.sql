
CREATE TABLE IF NOT EXISTS public.client_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  network TEXT NOT NULL DEFAULT 'instagram',
  captured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  followers INTEGER NOT NULL DEFAULT 0,
  avg_reach INTEGER NOT NULL DEFAULT 0,
  avg_impressions INTEGER NOT NULL DEFAULT 0,
  avg_likes INTEGER NOT NULL DEFAULT 0,
  avg_comments INTEGER NOT NULL DEFAULT 0,
  avg_shares INTEGER NOT NULL DEFAULT 0,
  avg_saves INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, network)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_baselines TO authenticated;
GRANT ALL ON public.client_baselines TO service_role;

ALTER TABLE public.client_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage baselines"
  ON public.client_baselines FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients read own baselines"
  ON public.client_baselines FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_baselines.client_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_client_baselines_updated_at
  BEFORE UPDATE ON public.client_baselines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_overdue_and_upcoming()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _t RECORD;
  _m RECORD;
  _staff RECORD;
  _now_br TIMESTAMP;
  _limit_br TIMESTAMP;
BEGIN
  _now_br := (now() AT TIME ZONE 'America/Sao_Paulo');
  _limit_br := _now_br + INTERVAL '24 hours';

  FOR _t IN
    SELECT t.id, t.title, t.assignee_id
    FROM public.tasks t
    WHERE t.due_date IS NOT NULL
      AND t.due_date < now()
      AND t.status <> 'done'
      AND t.assignee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = t.assignee_id
          AND n.body = t.id::text
          AND n.title LIKE 'Tarefa vencida:%'
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_t.assignee_id, 'Tarefa vencida: ' || _t.title, _t.id::text, '/tasks');
  END LOOP;

  FOR _m IN
    SELECT mt.id, mt.title, mt.client_id,
           c.user_id AS client_user_id, c.name AS client_name
    FROM public.meetings mt
    LEFT JOIN public.clients c ON c.id = mt.client_id
    WHERE mt.status IN ('scheduled','confirmed')
      AND (mt.meeting_date + COALESCE(mt.meeting_time,'00:00'::time)) BETWEEN _now_br AND _limit_br
  LOOP
    IF _m.client_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = _m.client_user_id AND n.body = _m.id::text
        AND n.title LIKE 'Reunião próxima:%' AND n.created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_m.client_user_id, 'Reunião próxima: ' || _m.title, _m.id::text, '/portal');
    END IF;

    FOR _staff IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('administrator','team')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = _staff.user_id AND n.body = _m.id::text
          AND n.title LIKE 'Reunião próxima:%' AND n.created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.notifications (user_id, title, body, link)
        VALUES (_staff.user_id, 'Reunião próxima: ' || _m.title || COALESCE(' — ' || _m.client_name,''), _m.id::text, '/meetings');
      END IF;
    END LOOP;
  END LOOP;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.notify_overdue_and_upcoming() FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-overdue-and-upcoming') THEN
    PERFORM cron.schedule(
      'notify-overdue-and-upcoming',
      '0 * * * *',
      'SELECT public.notify_overdue_and_upcoming();'
    );
  END IF;
END $$;
