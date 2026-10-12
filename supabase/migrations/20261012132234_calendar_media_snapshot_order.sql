-- Preserve the reviewed carousel order and wall-clock time in future approval snapshots.
CREATE OR REPLACE FUNCTION rsm_private.capture_review_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.posts;
BEGIN
 IF NEW.decision='pending' THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.posts WHERE id=NEW.post_id FOR UPDATE;
 NEW.reviewed_revision:=p.content_revision;NEW.decided_at:=clock_timestamp();NEW.decided_by:=auth.uid();
 INSERT INTO public.post_review_events(post_id,client_id,revision,decision,feedback,actor_id,actor_name,snapshot)
 VALUES(p.id,p.client_id,p.content_revision,NEW.decision,NEW.feedback,auth.uid(),(SELECT name FROM public.profiles WHERE id=auth.uid()),
 jsonb_build_object('title',p.title,'caption',p.caption,'script',p.script,'headline',p.headline,'slides',p.slides,'date',p.scheduled_date,'time',p.scheduled_time,'files',coalesce((SELECT jsonb_agg(jsonb_build_object('storage_path',f.storage_path,'file_name',f.file_name,'mime_type',f.mime_type,'sort_order',f.sort_order) ORDER BY f.sort_order,f.created_at,f.id) FROM public.post_files f WHERE f.post_id=p.id),'[]'::jsonb)));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION rsm_private.capture_review_event() FROM PUBLIC,anon,authenticated;
