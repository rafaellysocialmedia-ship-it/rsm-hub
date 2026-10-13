-- Extended regression script. The smaller creation/reschedule and client-denial transactions
-- were executed successfully; this combined script hit a connector requestState timeout.
BEGIN;
DO $$
DECLARE cid uuid; uid uuid; pid uuid; ts timestamptz; result jsonb; today date; rejected boolean;
BEGIN
 SELECT id,user_id INTO cid,uid FROM public.clients WHERE user_id IS NOT NULL AND status='active' AND NOT churned LIMIT 1;
 IF cid IS NULL THEN RAISE EXCEPTION 'Existing account required';END IF;
 PERFORM set_config('request.jwt.claim.sub','957e2e55-69ed-4e12-bcc0-529ea83380a5',true);
 SET LOCAL ROLE authenticated;
 today:=(now() AT TIME ZONE public.calendar_timezone())::date;
 IF NOT public.can_create_calendar() THEN RAISE EXCEPTION 'Admin creation denied';END IF;
 INSERT INTO public.posts(client_id,title,status,scheduled_date,scheduled_time)VALUES(cid,'QA today calendar','production',today,'15:40')RETURNING id,updated_at INTO pid,ts;
 result:=public.save_calendar_post(pid,ts,jsonb_build_object('scheduled_date',today+1));ts:=(result->>'updated_at')::timestamptz;
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=pid AND scheduled_date=today+1 AND scheduled_time='15:40') THEN RAISE EXCEPTION 'Today to tomorrow persistence failed';END IF;
 result:=public.save_calendar_post(pid,ts,jsonb_build_object('scheduled_date',today+8));ts:=(result->>'updated_at')::timestamptz;
 result:=public.save_calendar_post(pid,ts,jsonb_build_object('scheduled_date',today+40));ts:=(result->>'updated_at')::timestamptz;
 IF NOT EXISTS(SELECT 1 FROM public.posts WHERE id=pid AND scheduled_date=today+40 AND scheduled_time='15:40') THEN RAISE EXCEPTION 'Week/month move lost persisted time';END IF;
 RESET ROLE;PERFORM set_config('request.jwt.claim.sub',uid::text,true);SET LOCAL ROLE authenticated;
 IF public.can_create_calendar() THEN RAISE EXCEPTION 'Client gained creation';END IF;
 rejected:=false;BEGIN INSERT INTO public.posts(client_id,title)VALUES(cid,'Forbidden calendar creation');EXCEPTION WHEN insufficient_privilege THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Client created publication';END IF;
 RESET ROLE;PERFORM set_config('request.jwt.claim.sub','2b31ad51-1a75-448f-aa2b-0ef935d127b9',true);
 DELETE FROM public.module_visibility WHERE scope='user' AND scope_id='2b31ad51-1a75-448f-aa2b-0ef935d127b9' AND module_key='social.calendar';
 INSERT INTO public.module_visibility(scope,scope_id,module_key,visible)VALUES('user','2b31ad51-1a75-448f-aa2b-0ef935d127b9','social.calendar',false);
 SET LOCAL ROLE authenticated;
 IF public.can_create_calendar() THEN RAISE EXCEPTION 'Hidden module creation allowed';END IF;
 rejected:=false;BEGIN INSERT INTO public.posts(client_id,title)VALUES(cid,'Forbidden team creation');EXCEPTION WHEN insufficient_privilege THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Team bypassed create permission';END IF;
 RESET ROLE;
END $$;
ROLLBACK;
SELECT 'PASS: create on selected day, persisted today/tomorrow/week/month rescheduling, original time, client/team creation restrictions' result;
