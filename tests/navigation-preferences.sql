BEGIN;
DO $$
DECLARE u1 uuid; u2 uuid; denied boolean:=false;
BEGIN
 SELECT id INTO u1 FROM auth.users ORDER BY created_at LIMIT 1;
 SELECT id INTO u2 FROM auth.users WHERE id<>u1 ORDER BY created_at LIMIT 1;
 IF u1 IS NULL OR u2 IS NULL THEN RAISE EXCEPTION 'Two accounts required';END IF;
 PERFORM set_config('request.jwt.claim.sub',u1::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.navigation_preferences(user_id,sidebar_open,favorites) VALUES(u1,false,'[{"href":"/dashboard","label":"Início","module":"workspace.dashboard"}]') ON CONFLICT(user_id) DO UPDATE SET sidebar_open=false,favorites=excluded.favorites;
 IF NOT EXISTS(SELECT 1 FROM public.navigation_preferences WHERE user_id=u1 AND NOT sidebar_open AND jsonb_array_length(favorites)=1) THEN RAISE EXCEPTION 'Own preference persistence failed';END IF;
 BEGIN INSERT INTO public.navigation_preferences(user_id)VALUES(u2);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-user insert allowed';END IF;
 PERFORM set_config('request.jwt.claim.sub',u2::text,true);
 IF EXISTS(SELECT 1 FROM public.navigation_preferences WHERE user_id=u1) THEN RAISE EXCEPTION 'Cross-user read allowed';END IF;
 UPDATE public.navigation_preferences SET sidebar_open=true WHERE user_id=u1;
 IF FOUND THEN RAISE EXCEPTION 'Cross-user update allowed';END IF;
 DELETE FROM public.navigation_preferences WHERE user_id=u1;
 IF FOUND THEN RAISE EXCEPTION 'Cross-user delete allowed';END IF;
 RESET ROLE;
 SET LOCAL ROLE anon;
 denied:=false;
 BEGIN PERFORM 1 FROM public.navigation_preferences;EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous access allowed';END IF;
 RESET ROLE;
END $$;
ROLLBACK;
SELECT 'PASS: own preferences persist; cross-user read/write/delete and anonymous access denied' result;
