-- Commercial pipeline belongs to RSM, not to clients' advertising campaigns.
CREATE TABLE public.commercial_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 prospect_name text NOT NULL CHECK(length(trim(prospect_name)) BETWEEN 2 AND 200),
 company text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 plan text NOT NULL CHECK(length(trim(plan)) BETWEEN 2 AND 200),
 scope text NOT NULL DEFAULT '' CHECK(length(scope)<=8000),
 amount numeric(12,2) NOT NULL CHECK(amount>0),
 start_date date NOT NULL, end_date date, first_due_date date NOT NULL,
 stage text NOT NULL DEFAULT 'lead' CHECK(stage IN ('lead','draft','sent','accepted','lost','converted')),
 acceptance_note text NOT NULL DEFAULT '' CHECK(length(acceptance_note)<=2000),
 accepted_at timestamptz, accepted_by uuid REFERENCES public.profiles(id),
 client_id uuid REFERENCES public.clients(id), contract_id uuid REFERENCES public.finance_contracts(id),
 converted_at timestamptz, created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date IS NULL OR end_date>=start_date), CHECK(first_due_date>=start_date)
);
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.commercial_proposals TO authenticated;
CREATE POLICY commercial_staff ON public.commercial_proposals FOR ALL TO authenticated
 USING ((public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) AND public.can_finance('view'))
 WITH CHECK ((public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) AND public.can_finance('edit'));
CREATE INDEX commercial_stage ON public.commercial_proposals(stage,created_at DESC);
CREATE FUNCTION public.guard_commercial_proposal() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.stage='converted' THEN RAISE EXCEPTION 'Proposta convertida: edite o cadastro ou contrato do cliente'; END IF;
 IF NEW.stage='accepted' AND (TG_OP='INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
   IF length(trim(NEW.acceptance_note))<5 THEN RAISE EXCEPTION 'Registre como e quando o cliente aceitou a proposta'; END IF;
   NEW.accepted_at:=now(); NEW.accepted_by:=auth.uid();
 END IF;
 IF TG_OP='INSERT' AND NEW.stage='converted' THEN RAISE EXCEPTION 'Use a conversão da proposta'; END IF;
 NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_commercial_proposal() FROM PUBLIC,anon;
CREATE TRIGGER guard_commercial BEFORE INSERT OR UPDATE ON public.commercial_proposals FOR EACH ROW EXECUTE FUNCTION public.guard_commercial_proposal();

CREATE FUNCTION public.convert_commercial_proposal(_id uuid,_expected_updated_at timestamptz,_existing_client_id uuid DEFAULT NULL,_auto_billing boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.commercial_proposals; cid uuid; ct uuid; existing public.clients;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) OR NOT public.can_finance('edit') THEN RAISE EXCEPTION 'Conversão exige permissão de edição financeira' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.commercial_proposals WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
 IF p.stage='converted' THEN RETURN p.client_id; END IF;
 IF p.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'A proposta mudou. Atualize a página antes de converter'; END IF;
 IF p.stage<>'accepted' THEN RAISE EXCEPTION 'Registre o aceite antes de converter'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rsm-commercial-'||lower(trim(coalesce(nullif(p.email,''),p.prospect_name)))));
 IF _existing_client_id IS NOT NULL THEN
   SELECT * INTO existing FROM public.clients WHERE id=_existing_client_id FOR UPDATE;
   IF NOT FOUND OR existing.churned OR existing.status<>'prospect' THEN RAISE EXCEPTION 'Selecione um prospect sem churn para reaproveitar o cadastro'; END IF;
   cid:=existing.id;
   UPDATE public.clients SET status='active',journey_stage='onboarding',plan=p.plan,start_date=p.start_date WHERE id=cid;
 ELSE
   IF EXISTS(SELECT 1 FROM public.clients WHERE (p.email<>'' AND lower(trim(email))=lower(trim(p.email))) OR lower(trim(name))=lower(trim(p.prospect_name))) THEN RAISE EXCEPTION 'Já existe um cadastro com este nome ou e-mail. Vincule o prospect existente ou revise o cadastro'; END IF;
   INSERT INTO public.clients(name,trade_name,email,phone,plan,start_date,status,journey_stage,created_by)
   VALUES(p.prospect_name,nullif(p.company,''),nullif(p.email,''),nullif(p.phone,''),p.plan,p.start_date,'active','onboarding',auth.uid()) RETURNING id INTO cid;
 END IF;
 INSERT INTO public.finance_contracts(client_id,service_label,amount,periodicity,start_date,end_date,due_day,status,auto_billing,last_billed_on,created_by,notes)
 VALUES(cid,p.plan,p.amount,'monthly',p.start_date,p.end_date,least(extract(day FROM p.first_due_date)::int,28),'active',_auto_billing,p.first_due_date,auth.uid(),'Originado da proposta '||p.id||'. Aceite comercial registrado; assinatura acompanhada na aba Contrato.') RETURNING id INTO ct;
 INSERT INTO public.finance_charges(client_id,contract_id,description,amount,due_date,status,created_by)
 VALUES(cid,ct,p.plan||' · primeira mensalidade',p.amount,p.first_due_date,'pending',auth.uid());
 INSERT INTO public.client_contracts(client_id,title,status,expires_at,created_by)
 VALUES(cid,'Contrato · '||p.plan,'pending',p.end_date::timestamptz,auth.uid());
 PERFORM public.initialize_client_onboarding(cid);
 INSERT INTO public.file_folders(client_id,name,created_by) SELECT cid,n,auth.uid() FROM unnest(ARRAY['Identidade visual','Materiais','Relatórios','Contratos']) n
 WHERE NOT EXISTS(SELECT 1 FROM public.file_folders f WHERE f.client_id=cid AND f.name=n AND f.parent_id IS NULL);
 INSERT INTO public.client_timeline(client_id,event_type,title,detail,visibility,actor_id)
 VALUES(cid,'commercial_conversion','Proposta convertida em cliente','Cadastro, contrato, primeira mensalidade e onboarding criados.','internal',auth.uid());
 UPDATE public.commercial_proposals SET stage='converted',client_id=cid,contract_id=ct,converted_at=now() WHERE id=p.id;
 RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.convert_commercial_proposal(uuid,timestamptz,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_commercial_proposal(uuid,timestamptz,uuid,boolean) TO authenticated;

-- Shared support: only the client can submit their own request; only staff answers it.
CREATE TABLE public.client_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 kind text NOT NULL DEFAULT 'support' CHECK(kind IN ('support','complaint','material')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 200),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 2 AND 4000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting_client','done')),
 response text NOT NULL DEFAULT '' CHECK(length(response)<=4000), due_date date,
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.client_requests TO authenticated;
CREATE POLICY requests_staff ON public.client_requests FOR ALL TO authenticated
 USING(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
 WITH CHECK(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY requests_client_read ON public.client_requests FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.user_id=auth.uid()));
CREATE POLICY requests_client_insert ON public.client_requests FOR INSERT TO authenticated WITH CHECK(
 created_by=auth.uid() AND status='open' AND response='' AND kind IN ('support','complaint') AND due_date IS NULL
 AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.user_id=auth.uid() AND NOT c.churned AND c.status='active'));
CREATE INDEX requests_client_open ON public.client_requests(client_id,status,created_at);
CREATE TRIGGER touch_client_request BEFORE UPDATE ON public.client_requests FOR EACH ROW EXECUTE FUNCTION public.touch_experience_row();

-- Automatically confirm only objective milestones; keep manual exceptions and notes.
CREATE FUNCTION public.sync_client_onboarding(_client_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF current_user<>'postgres' AND (auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=_client_id AND status='active' AND NOT churned) THEN RETURN 0; END IF;
 UPDATE public.client_onboarding_steps s SET status='done'
 WHERE s.client_id=_client_id AND s.status IN ('todo','progress') AND CASE s.step_key
 WHEN 'contract' THEN EXISTS(SELECT 1 FROM public.client_contracts WHERE client_id=_client_id AND status='signed')
 WHEN 'payment' THEN EXISTS(SELECT 1 FROM public.finance_charges WHERE client_id=_client_id AND status='paid')
 WHEN 'briefing' THEN EXISTS(SELECT 1 FROM public.briefings WHERE client_id=_client_id AND status='completed')
 WHEN 'kickoff' THEN EXISTS(SELECT 1 FROM public.meetings WHERE client_id=_client_id AND status='completed')
 WHEN 'calendar' THEN EXISTS(SELECT 1 FROM public.posts WHERE client_id=_client_id AND scheduled_date IS NOT NULL AND status IN ('approved','to_schedule','scheduled','published'))
 ELSE false END;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sync_client_onboarding(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_client_onboarding(uuid) TO authenticated;
CREATE FUNCTION public.sync_onboarding_from_record() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user='postgres' OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team') THEN PERFORM public.sync_client_onboarding(NEW.client_id); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_onboarding_from_record() FROM PUBLIC,anon;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['client_contracts','finance_charges','briefings','meetings','posts'] LOOP
 EXECUTE format('CREATE TRIGGER sync_onboarding_record AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_onboarding_from_record()',t);
 END LOOP; END $$;
CREATE FUNCTION public.log_onboarding_step() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status THEN
 INSERT INTO public.client_timeline(client_id,event_type,title,detail,visibility,actor_id)
 VALUES(NEW.client_id,'onboarding','Etapa do onboarding atualizada',NEW.step_key||': '||NEW.status,'client',auth.uid()); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_onboarding_step() FROM PUBLIC,anon;
CREATE TRIGGER log_onboarding_step AFTER UPDATE ON public.client_onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.log_onboarding_step();

-- Staff-only churn details stay outside the shared clients table.
CREATE TABLE public.client_exit_details (
 client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
 last_month date, pending_items text NOT NULL DEFAULT '' CHECK(length(pending_items)<=2000),
 return_chance text NOT NULL DEFAULT 'unknown' CHECK(return_chance IN ('unknown','low','medium','high')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_exit_details ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.client_exit_details TO authenticated;
CREATE POLICY exit_staff ON public.client_exit_details FOR ALL TO authenticated USING(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) WITH CHECK(public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER touch_exit_details BEFORE UPDATE ON public.client_exit_details FOR EACH ROW EXECUTE FUNCTION public.touch_experience_row();
ALTER VIEW public.retention_overview RENAME TO retention_operational_overview;
CREATE VIEW public.retention_overview WITH(security_invoker=true) AS
WITH extra AS (
 SELECT b.*,
 (current_user='postgres' OR public.can_finance('view')) finance_available,
 (SELECT count(*)::int FROM public.finance_charges f WHERE f.client_id=b.client_id AND f.status IN ('pending','overdue') AND f.due_date<b.today AND f.amount>coalesce(f.amount_received,0)) overdue_payments,
 (SELECT count(*)::int FROM public.post_activity_log l WHERE l.client_id=b.client_id AND l.action='approval_changes_requested' AND l.created_at>=now()-interval '30 days') revisions,
 (SELECT count(*)::int FROM public.meetings m WHERE m.client_id=b.client_id AND m.status='cancelled' AND m.meeting_date>=b.today-30 AND m.meeting_date<=b.today) cancelled_meetings,
 greatest(0,b.today-coalesce((SELECT max(m.meeting_date) FROM public.meetings m WHERE m.client_id=b.client_id AND m.status='completed' AND m.meeting_date<=b.today),b.tracking_start)) days_without_meeting,
 (SELECT count(*)::int FROM public.client_requests r WHERE r.client_id=b.client_id AND r.kind='complaint' AND r.status<>'done') complaints,
 (SELECT count(*)::int FROM public.client_requests r WHERE r.client_id=b.client_id AND r.status='open' AND r.kind<>'material') awaiting_response,
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
REVOKE ALL ON public.retention_overview FROM anon;
GRANT SELECT ON public.retention_overview TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_retention_queue() RETURNS integer
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
 CASE signal WHEN 'late_posts' THEN 'Revisar entregas atrasadas' WHEN 'stale_approvals' THEN 'Acompanhar aprovações paradas' WHEN 'late_tasks' THEN 'Reorganizar demandas atrasadas' WHEN 'no_contact' THEN 'Realizar contato de acompanhamento' WHEN 'manual_risk' THEN 'Tratar risco sinalizado pela equipe' WHEN 'renewal' THEN 'Conversar sobre renovação' WHEN 'many_revisions' THEN 'Revisar alinhamento das aprovações' WHEN 'cancelled_meetings' THEN 'Reagendar reunião cancelada' WHEN 'no_meeting' THEN 'Agendar reunião de acompanhamento' WHEN 'complaint' THEN 'Tratar reclamação do cliente' WHEN 'late_materials' THEN 'Acompanhar envio de materiais' WHEN 'engagement_drop' THEN 'Revisar queda de engajamento' ELSE 'Revisar situação da conta' END,
 CASE signal WHEN 'manual_risk' THEN v.risk_reason ELSE 'Alerta interno. Consulte os indicadores da conta e registre o resultado do acompanhamento.' END,
 v.today+CASE WHEN v.health='critical' THEN 1 ELSE 3 END,v.account_manager_id,signal
 FROM public.retention_overview v CROSS JOIN LATERAL unnest(v.signals) signal
 WHERE signal<>'overdue_payment' AND v.automation_enabled AND NOT EXISTS (
 SELECT 1 FROM public.retention_actions a WHERE a.client_id=v.client_id AND a.auto_key=signal AND (a.status='open' OR a.closed_at>now()-interval '7 days'))
 ON CONFLICT (client_id,auto_key) WHERE status='open' AND auto_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION public.refresh_retention_queue() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_retention_queue() TO authenticated;

