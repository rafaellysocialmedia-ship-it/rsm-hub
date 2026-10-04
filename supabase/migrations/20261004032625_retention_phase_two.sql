-- Internal retention only. No client-facing grants or financial changes.
CREATE TABLE public.client_retention_settings (
 client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
 risk_level text NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal','attention','high')),
 risk_reason text NOT NULL DEFAULT '' CHECK (length(risk_reason)<=2000),
 checkin_days integer NOT NULL DEFAULT 30 CHECK (checkin_days BETWEEN 7 AND 90),
 automation_enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (risk_level='normal' OR length(trim(risk_reason))>0)
);
CREATE TABLE public.client_contact_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 contact_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
 channel text NOT NULL CHECK (channel IN ('whatsapp','meeting','email','phone','other')),
 summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 2000),
 created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (contact_date <= (now() AT TIME ZONE 'America/Fortaleza')::date)
);
CREATE TABLE public.retention_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
 description text NOT NULL DEFAULT '' CHECK (length(description)<=3000),
 due_date date NOT NULL,
 assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
 outcome text NOT NULL DEFAULT '' CHECK (length(outcome)<=2000),
 auto_key text,
 created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 CHECK (status='open' OR length(trim(outcome))>0)
);
CREATE INDEX contact_log_client_date ON public.client_contact_log(client_id,contact_date DESC);
CREATE INDEX retention_actions_client_status ON public.retention_actions(client_id,status,due_date);
CREATE UNIQUE INDEX retention_actions_auto_open ON public.retention_actions(client_id,auto_key) WHERE status='open' AND auto_key IS NOT NULL;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['client_retention_settings','client_contact_log','retention_actions'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY retention_staff ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''administrator'') OR public.has_role(auth.uid(),''team'')) WITH CHECK (public.has_role(auth.uid(),''administrator'') OR public.has_role(auth.uid(),''team''))',t);
 END LOOP;
END $$;

-- A live, explainable operational score. No private financial data is projected.
CREATE VIEW public.retention_overview WITH (security_invoker=true) AS
WITH metrics AS (
 SELECT c.id client_id,c.name,c.logo_url,c.account_manager_id,
 coalesce(s.risk_level,'normal') risk_level,coalesce(s.risk_reason,'') risk_reason,
 coalesce(s.checkin_days,30) checkin_days,coalesce(s.automation_enabled,true) automation_enabled,
 (now() AT TIME ZONE 'America/Fortaleza')::date today,
 greatest(coalesce(c.start_date,c.created_at::date),c.created_at::date) tracking_start,
 greatest((SELECT max(l.contact_date) FROM public.client_contact_log l WHERE l.client_id=c.id),
 (SELECT max(m.meeting_date) FROM public.meetings m WHERE m.client_id=c.id AND m.status='completed' AND m.meeting_date<=(now() AT TIME ZONE 'America/Fortaleza')::date)) last_contact,
 (SELECT count(*)::integer FROM public.posts p WHERE p.client_id=c.id AND p.scheduled_date<(now() AT TIME ZONE 'America/Fortaleza')::date AND p.status NOT IN ('published','archived','rejected')) late_posts,
 (SELECT count(*)::integer FROM public.posts p WHERE p.client_id=c.id AND p.status='review' AND p.updated_at < now()-interval '7 days') stale_approvals,
 (SELECT count(*)::integer FROM public.tasks t WHERE t.client_id=c.id AND t.status<>'done' AND t.due_date<now()) late_tasks,
 (SELECT count(*)::integer FROM public.posts p WHERE p.client_id=c.id) post_count,
 (SELECT count(*)::integer FROM public.tasks t WHERE t.client_id=c.id) task_count,
 (SELECT min(k.expires_at) FROM public.client_contracts k WHERE k.client_id=c.id AND k.status='signed') renewal_at
 FROM public.clients c LEFT JOIN public.client_retention_settings s ON s.client_id=c.id
 WHERE c.status='active' AND NOT c.churned
 AND (current_user='postgres' OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
), scored AS (
 SELECT *,greatest(0,today-coalesce(last_contact,tracking_start)) days_without_contact,
 CASE WHEN post_count+task_count=0 AND last_contact IS NULL AND risk_level='normal' AND today-tracking_start<checkin_days THEN NULL
 ELSE greatest(0,100-least(late_posts*10,30)-least(stale_approvals*5,20)-least(late_tasks*5,20)
 -CASE WHEN today-coalesce(last_contact,tracking_start)>=checkin_days THEN 15 ELSE 0 END
 -CASE risk_level WHEN 'high' THEN 35 WHEN 'attention' THEN 15 ELSE 0 END) END score
 FROM metrics
)
SELECT *, CASE WHEN score IS NULL THEN 'unknown' WHEN score<50 OR risk_level='high' THEN 'critical' WHEN score<80 OR risk_level='attention' THEN 'attention' ELSE 'healthy' END health,
 array_remove(ARRAY[
 CASE WHEN late_posts>0 THEN 'late_posts' END,
 CASE WHEN stale_approvals>0 THEN 'stale_approvals' END,
 CASE WHEN late_tasks>0 THEN 'late_tasks' END,
 CASE WHEN days_without_contact>=checkin_days THEN 'no_contact' END,
 CASE WHEN risk_level<>'normal' THEN 'manual_risk' END,
 CASE WHEN renewal_at IS NOT NULL AND (renewal_at AT TIME ZONE 'America/Fortaleza')::date<=today+30 THEN 'renewal' END
 ],NULL) signals
FROM scored;
REVOKE ALL ON public.retention_overview FROM anon;
GRANT SELECT ON public.retention_overview TO authenticated;

-- Queue refresh is idempotent, respects per-account opt-out, and never sends messages.
CREATE FUNCTION public.refresh_retention_queue() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE inserted_count integer;
BEGIN
 IF current_user<>'postgres' AND NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN
 RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rsm-retention-queue'));
 UPDATE public.retention_actions a SET status='cancelled',closed_at=now(),outcome='Acompanhamento encerrado: conta fora da operação ativa.'
 WHERE a.status='open' AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=a.client_id AND c.status='active' AND NOT c.churned);
 UPDATE public.retention_actions a SET status='cancelled',closed_at=now(),outcome='Alerta resolvido pelos dados atuais da conta.'
 WHERE a.status='open' AND a.auto_key IS NOT NULL AND EXISTS(SELECT 1 FROM public.retention_overview v WHERE v.client_id=a.client_id AND NOT(a.auto_key=ANY(v.signals)));
 INSERT INTO public.retention_actions(client_id,title,description,due_date,assignee_id,auto_key)
 SELECT v.client_id,
 CASE signal WHEN 'late_posts' THEN 'Revisar entregas atrasadas' WHEN 'stale_approvals' THEN 'Acompanhar aprovações paradas' WHEN 'late_tasks' THEN 'Reorganizar demandas atrasadas' WHEN 'no_contact' THEN 'Realizar contato de acompanhamento' WHEN 'manual_risk' THEN 'Tratar risco sinalizado pela equipe' WHEN 'renewal' THEN 'Conversar sobre renovação' END,
 CASE signal WHEN 'manual_risk' THEN v.risk_reason ELSE 'Alerta interno. Consulte os indicadores da conta e registre o resultado do acompanhamento.' END,
 v.today+CASE WHEN v.health='critical' THEN 1 ELSE 3 END,v.account_manager_id,signal
 FROM public.retention_overview v CROSS JOIN LATERAL unnest(v.signals) signal
 WHERE v.automation_enabled AND NOT EXISTS (
 SELECT 1 FROM public.retention_actions a WHERE a.client_id=v.client_id AND a.auto_key=signal AND (a.status='open' OR a.closed_at>now()-interval '7 days'))
 ON CONFLICT (client_id,auto_key) WHERE status='open' AND auto_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION public.refresh_retention_queue() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_retention_queue() TO authenticated;

CREATE FUNCTION public.guard_retention_action() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.status='open' AND NOT EXISTS (SELECT 1 FROM public.clients WHERE id=NEW.client_id AND status='active' AND NOT churned) THEN
 RAISE EXCEPTION 'Ações abertas exigem um cliente ativo sem churn'; END IF;
 IF NEW.status<>'open' THEN NEW.closed_at:=now(); ELSE NEW.closed_at:=NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_retention_action() FROM PUBLIC,anon;
CREATE TRIGGER retention_action_guard BEFORE INSERT OR UPDATE ON public.retention_actions FOR EACH ROW EXECUTE FUNCTION public.guard_retention_action();
CREATE FUNCTION public.close_retention_after_churn() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.churned OR NEW.status<>'active' THEN
 UPDATE public.retention_actions SET status='cancelled',outcome='Conta encerrada ou inativa. Histórico preservado.',closed_at=now() WHERE client_id=NEW.id AND status='open';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.close_retention_after_churn() FROM PUBLIC,anon;
CREATE TRIGGER close_retention_after_churn AFTER UPDATE OF churned,status ON public.clients FOR EACH ROW EXECUTE FUNCTION public.close_retention_after_churn();
SELECT cron.schedule('rsm-retention-followups','0 12 * * *','SELECT public.refresh_retention_queue();');
