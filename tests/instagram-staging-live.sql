-- Run only on dtladsjhmnzdxcmgivne with staging fixtures. Every test rolls back.
BEGIN;
DO $$
DECLARE
 a uuid:='20000000-0000-4000-8000-000000000001';
 t uuid:='20000000-0000-4000-8000-000000000002';
 u uuid:='20000000-0000-4000-8000-000000000003';
 c uuid:='10000000-0000-4000-8000-000000000001';
 rejected boolean; consumed integer; tid uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND name='RSM TESTE — Cliente fictício') THEN
  RAISE EXCEPTION 'Staging fixtures required';
 END IF;
 SET LOCAL ROLE service_role;
 IF NOT public.can_manage_instagram(a,c) OR NOT public.can_manage_instagram(t,c) THEN RAISE EXCEPTION 'Staff permission denied'; END IF;
 IF public.can_manage_instagram(u,c) OR public.can_manage_instagram(NULL,c) OR public.can_manage_instagram(a,gen_random_uuid()) THEN RAISE EXCEPTION 'Unauthorized identity allowed'; END IF;
 RESET ROLE;
 DELETE FROM public.user_app_roles WHERE user_id=t;
 INSERT INTO public.user_app_roles(user_id,role_key) VALUES(t,'designer');
 IF public.can_manage_instagram(t,c) THEN RAISE EXCEPTION 'Designer gained client edit'; END IF;
 DELETE FROM public.user_app_roles WHERE user_id=t;
 INSERT INTO public.user_app_roles(user_id,role_key) VALUES(t,'team');
 INSERT INTO public.module_visibility(scope,scope_id,module_key,visible) VALUES('user',t::text,'workspace',false);
 IF public.can_manage_instagram(t,c) THEN RAISE EXCEPTION 'Hidden parent allowed'; END IF;
 UPDATE public.clients SET status='inactive' WHERE id=c;
 IF public.can_manage_instagram(a,c) THEN RAISE EXCEPTION 'Inactive client allowed'; END IF;
 UPDATE public.clients SET status='active',churned=true,churn_date=current_date,churn_reason='Fixture rollback' WHERE id=c;
 IF public.can_manage_instagram(a,c) THEN RAISE EXCEPTION 'Churn allowed'; END IF;
 UPDATE public.clients SET churned=false WHERE id=c;
 SET LOCAL ROLE anon;
 rejected:=false; BEGIN PERFORM 1 FROM public.instagram_connections; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Anonymous token read allowed'; END IF;
 RESET ROLE; SET LOCAL ROLE authenticated;
 rejected:=false; BEGIN PERFORM 1 FROM public.instagram_oauth_states; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Authenticated state read allowed'; END IF;
 rejected:=false; BEGIN PERFORM public.can_manage_instagram(a,c); EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Authorization RPC exposed'; END IF;
 RESET ROLE; SET LOCAL ROLE service_role;
 INSERT INTO public.instagram_oauth_states(state_hash,user_id,client_id,browser_hash,expires_at)
 VALUES(repeat('a',64),a,c,repeat('b',64),now()+interval '5 minutes');
 DELETE FROM public.instagram_oauth_states WHERE state_hash=repeat('a',64) AND browser_hash=repeat('c',64) AND expires_at>now();
 GET DIAGNOSTICS consumed=ROW_COUNT; IF consumed<>0 THEN RAISE EXCEPTION 'Wrong browser consumed state'; END IF;
 DELETE FROM public.instagram_oauth_states WHERE state_hash=repeat('a',64) AND browser_hash=repeat('b',64) AND expires_at>now();
 GET DIAGNOSTICS consumed=ROW_COUNT; IF consumed<>1 THEN RAISE EXCEPTION 'State not consumed'; END IF;
 DELETE FROM public.instagram_oauth_states WHERE state_hash=repeat('a',64);
 GET DIAGNOSTICS consumed=ROW_COUNT; IF consumed<>0 THEN RAISE EXCEPTION 'Replay accepted'; END IF;
 INSERT INTO public.instagram_connections(user_id,client_id,instagram_user_id,encrypted_access_token)
 VALUES(a,c,'fixture-not-a-real-account','fixture-not-a-real-token')
 ON CONFLICT(client_id,instagram_user_id) DO UPDATE SET username='fixture';
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 INSERT INTO public.tasks(title,client_id,status) VALUES('Fixture lifecycle',c,'todo') RETURNING id INTO tid;
 UPDATE public.tasks SET status='done' WHERE id=tid;
 IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id=tid AND status='done') THEN RAISE EXCEPTION 'Task update failed'; END IF;
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',u::text,true); SET LOCAL ROLE authenticated;
 UPDATE public.tasks SET status='todo' WHERE id=tid;
 IF FOUND THEN RAISE EXCEPTION 'Client changed staff task'; END IF;
 RESET ROLE;
END $$;
ROLLBACK;
SELECT 'PASS: OAuth role matrix, visibility, churn/inactive, grants, state/browser binding/replay, service write and task isolation' AS result;
