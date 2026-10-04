CREATE TABLE public.meeting_recaps (
 meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
 summary text NOT NULL CHECK(length(trim(summary)) BETWEEN 2 AND 4000),
 decisions text NOT NULL DEFAULT '' CHECK(length(decisions)<=4000),
 next_steps text NOT NULL DEFAULT '' CHECK(length(next_steps)<=4000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_recaps ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.meeting_recaps TO authenticated;
CREATE POLICY recap_staff ON public.meeting_recaps FOR ALL TO authenticated
 USING(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
 WITH CHECK(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY recap_client ON public.meeting_recaps FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.meetings m JOIN public.clients c ON c.id=m.client_id WHERE m.id=meeting_id AND c.user_id=auth.uid()));
CREATE TRIGGER touch_meeting_recap BEFORE UPDATE ON public.meeting_recaps FOR EACH ROW EXECUTE FUNCTION public.touch_experience_row();
CREATE FUNCTION public.log_meeting_recap() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE cid uuid;
BEGIN
 SELECT client_id INTO cid FROM public.meetings WHERE id=NEW.meeting_id AND status='completed';
 IF cid IS NULL THEN RAISE EXCEPTION 'O resumo exige uma reunião concluída vinculada a um cliente'; END IF;
 INSERT INTO public.client_timeline(client_id,event_type,title,visibility,actor_id)
 VALUES(cid,'meeting_recap','Resumo de reunião disponível','client',auth.uid()); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_meeting_recap() FROM PUBLIC,anon;
CREATE TRIGGER log_meeting_recap AFTER INSERT OR UPDATE ON public.meeting_recaps FOR EACH ROW EXECUTE FUNCTION public.log_meeting_recap();

CREATE TABLE public.client_request_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 2 AND 4000),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_request_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.client_request_messages TO authenticated;
CREATE POLICY request_message_read ON public.client_request_messages FOR SELECT TO authenticated USING(
 public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') OR
 EXISTS(SELECT 1 FROM public.client_requests r JOIN public.clients c ON c.id=r.client_id WHERE r.id=request_id AND c.user_id=auth.uid()));
CREATE POLICY request_message_write ON public.client_request_messages FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND (
 public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') OR
 EXISTS(SELECT 1 FROM public.client_requests r JOIN public.clients c ON c.id=r.client_id WHERE r.id=request_id AND c.user_id=auth.uid() AND c.status='active' AND NOT c.churned)));
CREATE INDEX request_messages_parent ON public.client_request_messages(request_id,created_at);

CREATE FUNCTION public.initialize_new_account() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.status='active' AND NOT NEW.churned AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN
 PERFORM public.initialize_client_onboarding(NEW.id); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.initialize_new_account() FROM PUBLIC,anon;
CREATE TRIGGER initialize_new_account AFTER INSERT OR UPDATE OF status ON public.clients FOR EACH ROW EXECUTE FUNCTION public.initialize_new_account();
CREATE FUNCTION public.sync_all_onboarding() RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE cid uuid; n integer:=0;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Rotina de manutenção' USING ERRCODE='42501'; END IF;
 FOR cid IN SELECT DISTINCT s.client_id FROM public.client_onboarding_steps s JOIN public.clients c ON c.id=s.client_id WHERE c.status='active' AND NOT c.churned AND s.status IN ('todo','progress') LOOP
 n:=n+public.sync_client_onboarding(cid); END LOOP; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sync_all_onboarding() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('rsm-onboarding-sync','30 11 * * *','SELECT public.sync_all_onboarding();');

-- Do not bill before an already-created future first installment.
CREATE OR REPLACE FUNCTION public.generate_recurring_charges()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  s record;
  created int := 0;
  step int;
  day_of_month int;
  due date;
  months_elapsed int;
  anchor date;
BEGIN
  FOR c IN
    SELECT ct.*
    FROM public.finance_contracts ct
    JOIN public.clients cl ON cl.id = ct.client_id
    WHERE ct.status = 'active'
      AND ct.auto_billing
      AND (ct.last_billed_on IS NULL OR date_trunc('month',ct.last_billed_on)<=date_trunc('month',current_date))
      AND ct.periodicity <> 'once'
      AND cl.status = 'active'
      AND NOT cl.churned
      AND (ct.start_date IS NULL OR ct.start_date <= current_date)
      AND (ct.end_date IS NULL OR ct.end_date >= current_date)
  LOOP
    step := CASE c.periodicity
              WHEN 'monthly' THEN 1
              WHEN 'quarterly' THEN 3
              WHEN 'semiannual' THEN 6
              WHEN 'annual' THEN 12
              ELSE 1
            END;
    anchor := coalesce(c.start_date, c.created_at::date);
    months_elapsed :=
      (extract(year from current_date)::int * 12 + extract(month from current_date)::int)
      - (extract(year from anchor)::int * 12 + extract(month from anchor)::int);

    IF months_elapsed < 0 OR (months_elapsed % step) <> 0 THEN
      CONTINUE;
    END IF;

    day_of_month := least(greatest(coalesce(c.due_day, 5), 1), 28);
    due := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      day_of_month
    );

    IF EXISTS (
      SELECT 1 FROM public.finance_charges fc
      WHERE fc.contract_id = c.id
        AND fc.due_date >= date_trunc('month', current_date)::date
        AND fc.due_date < (date_trunc('month', current_date) + interval '1 month')::date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.finance_charges (
      client_id, contract_id, service_key, service_label, description,
      amount, due_date, status, notes
    ) VALUES (
      c.client_id, c.id, c.service_key, c.service_label,
      coalesce(c.service_label, 'Contrato') || ' · cobrança automática',
      c.amount, due, 'pending', 'Gerada automaticamente pela recorrência do contrato'
    );

    UPDATE public.finance_contracts
       SET last_billed_on = due
     WHERE id = c.id;

    created := created + 1;
  END LOOP;

  -- Serviços ativos sem contrato próprio: gera a mensalidade do serviço.
  FOR s IN
    SELECT cs.*
    FROM public.client_services cs
    JOIN public.clients cl ON cl.id = cs.client_id
    WHERE cs.situation = 'active'
      AND cs.auto_billing
      AND coalesce(cs.amount, 0) > 0
      AND cl.status = 'active'
      AND NOT cl.churned
      AND (cs.start_date IS NULL OR cs.start_date <= current_date)
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_contracts ct
        WHERE ct.client_id = cs.client_id
          AND ct.service_key = cs.service_key
          AND ct.status = 'active'
          AND ct.auto_billing
      )
  LOOP
    day_of_month := least(greatest(coalesce(s.billing_day, 5), 1), 28);
    due := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      day_of_month
    );

    IF EXISTS (
      SELECT 1 FROM public.finance_charges fc
      WHERE fc.client_id = s.client_id
        AND fc.service_key = s.service_key
        AND fc.contract_id IS NULL
        AND fc.due_date >= date_trunc('month', current_date)::date
        AND fc.due_date < (date_trunc('month', current_date) + interval '1 month')::date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.finance_charges (
      client_id, service_key, service_label, description,
      amount, due_date, status, notes
    ) VALUES (
      s.client_id, s.service_key, coalesce(s.label, s.service_key),
      coalesce(s.label, s.service_key) || ' · mensalidade',
      s.amount, due, 'pending', 'Gerada automaticamente pelo serviço ativo do cliente'
    );

    UPDATE public.client_services
       SET last_billed_on = due
     WHERE id = s.id;

    created := created + 1;
  END LOOP;

  RETURN created;
END;
$function$;

CREATE OR REPLACE VIEW public.retention_overview WITH(security_invoker=true) AS
WITH extra AS (
 SELECT b.*,
 (current_user='postgres' OR public.can_finance('view')) finance_available,
 (SELECT count(*)::int FROM public.finance_charges f WHERE f.client_id=b.client_id AND f.status IN ('pending','overdue') AND f.due_date<b.today AND f.amount>coalesce(f.amount_received,0)) overdue_payments,
 (SELECT count(*)::int FROM public.post_activity_log l WHERE l.client_id=b.client_id AND l.action='approval_changes_requested' AND l.created_at>=now()-interval '30 days') revisions,
 (SELECT count(*)::int FROM public.meetings m WHERE m.client_id=b.client_id AND m.status='cancelled' AND m.meeting_date>=b.today-30 AND m.meeting_date<=b.today) cancelled_meetings,
 greatest(0,b.today-coalesce((SELECT max(m.meeting_date) FROM public.meetings m WHERE m.client_id=b.client_id AND m.status='completed' AND m.meeting_date<=b.today),b.tracking_start)) days_without_meeting,
 (SELECT count(*)::int FROM public.client_requests r WHERE r.client_id=b.client_id AND r.kind='complaint' AND r.status<>'done') complaints,
 (SELECT count(*)::int FROM public.client_requests r WHERE r.client_id=b.client_id AND r.kind<>'material' AND (r.status='open' OR EXISTS(SELECT 1 FROM public.client_request_messages msg JOIN public.clients rc ON rc.id=r.client_id WHERE msg.request_id=r.id AND msg.created_by=rc.user_id AND msg.created_at>r.updated_at))) awaiting_response,
 (SELECT count(*)::int FROM public.tasks t WHERE t.client_id=b.client_id AND t.status='waiting_client' AND t.due_date<now()) +
 (SELECT count(*)::int FROM public.client_requests r WHERE r.client_id=b.client_id AND r.kind='material' AND r.status<>'done' AND r.due_date<b.today) late_materials,
 NOT EXISTS(SELECT 1 FROM public.posts p WHERE p.client_id=b.client_id AND p.status IN ('scheduled','to_schedule','approved') AND p.scheduled_date BETWEEN b.today AND b.today+30) no_scheduled,
 NOT EXISTS(SELECT 1 FROM public.posts p WHERE p.client_id=b.client_id AND p.status IN ('production','recording','editing')) no_production,
 (SELECT count(*)::int FROM public.posts p WHERE p.client_id=b.client_id AND p.status='review') approvals_pending,
 (SELECT count(*)::int FROM public.client_onboarding_steps s WHERE s.client_id=b.client_id AND s.status NOT IN ('done','not_applicable')) onboarding_pending,
 (SELECT min(f.end_date)::timestamptz FROM public.finance_contracts f WHERE f.client_id=b.client_id AND f.status='active') finance_renewal,
 (SELECT (a.metrics->>'engagement_rate')::numeric < (z.metrics->>'engagement_rate')::numeric*0.7
 FROM public.client_monthly_reports a JOIN public.client_monthly_reports z ON z.client_id=a.client_id AND z.report_month=(a.report_month-interval '1 month')::date
 WHERE a.client_id=b.client_id AND a.report_month=(date_trunc('month',b.today)-interval '1 month')::date
 AND (a.metrics->>'posts_with_metrics')::int>=3 AND (z.metrics->>'posts_with_metrics')::int>=3
 AND (z.metrics->>'engagement_rate')::numeric>0 LIMIT 1) engagement_drop
 FROM public.retention_operational_overview b
), scored AS (
 SELECT *,CASE WHEN score IS NULL AND overdue_payments+complaints+late_materials=0 THEN NULL ELSE greatest(0,coalesce(score,100)
 -least(overdue_payments*15,30)-CASE WHEN revisions>=3 THEN 10 ELSE 0 END
 -least(cancelled_meetings*5,10)-CASE WHEN days_without_meeting>=checkin_days THEN 10 ELSE 0 END
 -least(complaints*15,30)-CASE WHEN late_materials>0 THEN 10 ELSE 0 END-CASE WHEN engagement_drop THEN 10 ELSE 0 END) END full_score,
 array_remove(ARRAY[
 CASE WHEN overdue_payments>0 THEN 'overdue_payment' END,CASE WHEN revisions>=3 THEN 'many_revisions' END,
 CASE WHEN cancelled_meetings>0 THEN 'cancelled_meetings' END,CASE WHEN days_without_meeting>=checkin_days THEN 'no_meeting' END,
 CASE WHEN complaints>0 THEN 'complaint' END,CASE WHEN late_materials>0 THEN 'late_materials' END,
 CASE WHEN engagement_drop THEN 'engagement_drop' END,
 CASE WHEN finance_renewal IS NOT NULL AND finance_renewal::date<=today+30 AND NOT('renewal'=ANY(signals)) THEN 'renewal' END
 ],NULL) added_signals FROM extra
)
SELECT client_id,name,logo_url,account_manager_id,risk_level,risk_reason,checkin_days,automation_enabled,today,tracking_start,last_contact,
 late_posts,stale_approvals,late_tasks,post_count,task_count,least(renewal_at,finance_renewal) renewal_at,days_without_contact,
 full_score score,CASE WHEN full_score IS NULL THEN 'unknown' WHEN full_score<50 OR risk_level='high' THEN 'critical' WHEN full_score<80 OR risk_level='attention' THEN 'attention' ELSE 'healthy' END health,
 signals||added_signals signals,finance_available,overdue_payments,revisions,cancelled_meetings,days_without_meeting,complaints,awaiting_response,late_materials,no_scheduled,no_production,approvals_pending,onboarding_pending,coalesce(engagement_drop,false) engagement_drop
FROM scored;
