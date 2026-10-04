BEGIN;
DO $$
DECLARE cid uuid;uid uuid;pid uuid;fid uuid;link jsonb;token text;stamp timestamptz;failed boolean;otheruid uuid:=gen_random_uuid();
BEGIN
 SELECT id,user_id INTO cid,uid FROM public.clients WHERE user_id IS NOT NULL AND status='active' AND NOT churned LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub','957e2e55-69ed-4e12-bcc0-529ea83380a5',true);
 UPDATE public.client_portal_settings SET can_view_posts=true,can_view_media=true,can_view_history=true,can_view_captions=true,can_approve=true,visible_statuses=ARRAY['review','approved'] WHERE client_id=cid;
 INSERT INTO public.posts(client_id,title,status) VALUES(cid,'QA archive','review')RETURNING id INTO pid;
 INSERT INTO public.post_files(post_id,file_name,storage_path,mime_type)VALUES(pid,'QA archive.png',pid::text||'/immutable.png','image/png')RETURNING id INTO fid;
 SELECT updated_at INTO stamp FROM public.posts WHERE id=pid;
 SET LOCAL ROLE authenticated;link:=public.create_approval_link(pid,1);token:=link->>'token';RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',otheruid::text,true);SET LOCAL ROLE authenticated;
 IF EXISTS(SELECT 1 FROM public.portal_posts WHERE id=pid) THEN RAISE EXCEPTION 'Wrong identity can read';END IF;
 failed:=false;BEGIN PERFORM public.get_approval_link_post(token);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Link permits another identity';END IF;
 RESET ROLE;
 UPDATE public.approval_links SET expires_at=now()-interval '1 second' WHERE id=(link->>'id')::uuid;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);SET LOCAL ROLE authenticated;
 failed:=false;BEGIN PERFORM public.get_approval_link_post(token);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Expired link accepted';END IF;
 PERFORM public.decide_my_account_post(pid,stamp,'approved',NULL);
 RESET ROLE;PERFORM set_config('request.jwt.claim.sub','957e2e55-69ed-4e12-bcc0-529ea83380a5',true);SET LOCAL ROLE authenticated;
 DELETE FROM public.post_files WHERE id=fid;
 IF NOT rsm_private.media_is_reviewed(pid::text||'/immutable.png') THEN RAISE EXCEPTION 'Old file lost from ledger';END IF;
 RESET ROLE;PERFORM set_config('request.jwt.claim.sub',uid::text,true);SET LOCAL ROLE authenticated;
 IF NOT rsm_private.review_media_access(pid::text||'/immutable.png') THEN RAISE EXCEPTION 'Owner cannot read past media';END IF;
 IF public.get_post_review_history(pid)->0->'snapshot'->'files'->0->>'storage_path'<>pid::text||'/immutable.png' THEN RAISE EXCEPTION 'Snapshot missing';END IF;
 RESET ROLE;
END $$;
ROLLBACK;
SELECT 'PASS: expiry, wrong identity, archived review file reference and authorized history access' result;
