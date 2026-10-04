CREATE TABLE public.client_onboarding_steps (
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 step_key text NOT NULL CHECK (step_key IN ('contract','payment','briefing','access','identity','kickoff','strategy','calendar')),
 status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','progress','done','not_applicable')),
 owner_scope text NOT NULL DEFAULT 'rsm' CHECK (owner_scope IN ('rsm','client')),
 due_date date,
 shared_note text NOT NULL DEFAULT '' CHECK (length(shared_note)<=1000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(client_id,step_key)
);
CREATE TABLE public.client_report_drafts (
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 report_month date NOT NULL CHECK (extract(day FROM report_month)=1),
 analysis text NOT NULL DEFAULT '' CHECK (length(analysis)<=8000),
 next_steps text NOT NULL DEFAULT '' CHECK (length(next_steps)<=8000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(client_id,report_month)
);
CREATE TABLE public.client_monthly_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 report_month date NOT NULL CHECK (extract(day FROM report_month)=1),
 analysis text NOT NULL CHECK (length(trim(analysis)) BETWEEN 1 AND 8000),
 next_steps text NOT NULL DEFAULT '' CHECK (length(next_steps)<=8000),
 metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics)='object'),
 published_at timestamptz NOT NULL DEFAULT now(),
 published_by uuid REFERENCES public.profiles(id),
 UNIQUE(client_id,report_month)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['client_onboarding_steps','client_report_drafts','client_monthly_reports'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY experience_staff ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''administrator'') OR public.has_role(auth.uid(),''team'')) WITH CHECK (public.has_role(auth.uid(),''administrator'') OR public.has_role(auth.uid(),''team''))',t);
 END LOOP;
END $$;
CREATE POLICY onboarding_client_read ON public.client_onboarding_steps FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.user_id=auth.uid()));
CREATE POLICY report_client_read ON public.client_monthly_reports FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.user_id=auth.uid()));

CREATE FUNCTION public.touch_experience_row() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.touch_experience_row() FROM PUBLIC,anon;
CREATE TRIGGER touch_report_draft BEFORE UPDATE ON public.client_report_drafts FOR EACH ROW EXECUTE FUNCTION public.touch_experience_row();
CREATE TRIGGER touch_onboarding_step BEFORE UPDATE ON public.client_onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.touch_experience_row();
CREATE FUNCTION public.initialize_client_onboarding(_client_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=_client_id AND NOT churned AND status<>'inactive') THEN RAISE EXCEPTION 'Conta encerrada ou inexistente'; END IF;
 INSERT INTO public.client_onboarding_steps(client_id,step_key,owner_scope)
 SELECT _client_id,s,CASE WHEN s IN ('payment','briefing','access','identity') THEN 'client' ELSE 'rsm' END
 FROM unnest(ARRAY['contract','payment','briefing','access','identity','kickoff','strategy','calendar']) s
 ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.initialize_client_onboarding(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.initialize_client_onboarding(uuid) TO authenticated;

-- Latest capture per post and network; never sum repeated snapshots of the same metric.
CREATE FUNCTION public.get_monthly_report_metrics(_client_id uuid,_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 IF extract(day FROM _month)<>1 THEN RAISE EXCEPTION 'Use o primeiro dia do mês'; END IF;
 WITH posts AS (
 SELECT p.id,p.title,p.scheduled_date FROM public.posts p WHERE p.client_id=_client_id AND p.status='published' AND p.scheduled_date>=_month AND p.scheduled_date<(_month+interval '1 month')::date
 ), latest AS (
 SELECT DISTINCT ON (m.post_id,lower(trim(m.network))) m.post_id,m.network,m.reach,m.impressions,m.likes,m.comments,m.shares,m.saves,m.video_views,m.followers_gained,m.collected_at
 FROM public.post_metrics m JOIN posts p ON p.id=m.post_id
 ORDER BY m.post_id,lower(trim(m.network)),m.collected_at DESC,m.updated_at DESC,m.id DESC
 ), ranked AS (
 SELECT p.id,p.title,p.scheduled_date,sum(l.reach) reach,sum(l.likes+l.comments+l.shares+l.saves) interactions FROM posts p JOIN latest l ON l.post_id=p.id GROUP BY p.id,p.title,p.scheduled_date
 ORDER BY sum(l.likes+l.comments+l.shares+l.saves) DESC,p.id LIMIT 3
 )
 SELECT jsonb_build_object(
 'published_posts',(SELECT count(*) FROM posts),
 'posts_with_metrics',(SELECT count(DISTINCT post_id) FROM latest),
 'reach',(SELECT sum(reach) FROM latest),
 'impressions',(SELECT sum(impressions) FROM latest),
 'video_views',(SELECT sum(video_views) FROM latest),
 'followers_gained',(SELECT sum(followers_gained) FROM latest),
 'interactions',(SELECT sum(likes+comments+shares+saves) FROM latest),
 'engagement_rate',(SELECT CASE WHEN sum(reach)>0 THEN round(100.0*sum(likes+comments+shares+saves)/sum(reach),2) ELSE NULL END FROM latest),
 'latest_collection',(SELECT max(collected_at) FROM latest),
 'top_posts',coalesce((SELECT jsonb_agg(to_jsonb(ranked)) FROM ranked),'[]'::jsonb),
 'captured_at',now()
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_monthly_report_metrics(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_report_metrics(uuid,date) TO authenticated;

-- Publishing copies an explicit draft into a separate client-visible snapshot.
CREATE FUNCTION public.publish_monthly_report(_client_id uuid,_month date,_expected_updated_at timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE draft public.client_report_drafts; rid uuid; snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 SELECT * INTO draft FROM public.client_report_drafts WHERE client_id=_client_id AND report_month=_month FOR UPDATE;
 IF NOT FOUND OR draft.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'O rascunho mudou. Recarregue antes de publicar.'; END IF;
 IF length(trim(draft.analysis))=0 THEN RAISE EXCEPTION 'Escreva a análise da RSM antes de publicar.'; END IF;
 snapshot:=public.get_monthly_report_metrics(_client_id,_month);
 INSERT INTO public.client_monthly_reports(client_id,report_month,analysis,next_steps,metrics,published_by)
 VALUES(_client_id,_month,trim(draft.analysis),trim(draft.next_steps),snapshot,auth.uid())
 ON CONFLICT(client_id,report_month) DO UPDATE SET analysis=excluded.analysis,next_steps=excluded.next_steps,metrics=excluded.metrics,published_by=excluded.published_by,published_at=now()
 RETURNING id INTO rid;
 INSERT INTO public.client_timeline(client_id,event_type,title,detail,visibility,actor_id)
 VALUES(_client_id,'report_published','Relatório mensal disponível',to_char(_month,'MM/YYYY') || ' · Confira a análise e os próximos passos na aba Relatórios.','client',auth.uid());
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.publish_monthly_report(uuid,date,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_monthly_report(uuid,date,timestamptz) TO authenticated;
