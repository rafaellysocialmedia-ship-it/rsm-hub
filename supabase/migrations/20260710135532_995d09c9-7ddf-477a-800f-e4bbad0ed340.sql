
-- 1. Extend post_status enum
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. Extend approval sync trigger: rejected/changes_requested handling
CREATE OR REPLACE FUNCTION public.sync_post_status_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.decision IS NOT DISTINCT FROM NEW.decision THEN
    RETURN NEW;
  END IF;

  IF NEW.decision = 'approved' THEN
    UPDATE public.posts
       SET status = 'approved'::post_status, updated_at = now()
     WHERE id = NEW.post_id
       AND status IN ('review','idea','production');
  ELSIF NEW.decision = 'rejected' THEN
    UPDATE public.posts
       SET status = 'archived'::post_status, updated_at = now()
     WHERE id = NEW.post_id
       AND status NOT IN ('archived','published');
  ELSIF NEW.decision = 'changes_requested' THEN
    UPDATE public.posts
       SET status = 'production'::post_status, updated_at = now()
     WHERE id = NEW.post_id
       AND status IN ('review','approved');
  END IF;

  RETURN NEW;
END $function$;

-- 3. When a post moves to 'published', auto-approve pending approval
CREATE OR REPLACE FUNCTION public.auto_approve_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'published'::post_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.client_id IS NOT NULL THEN
    UPDATE public.post_approvals
       SET decision = 'approved'::approval_decision,
           feedback = COALESCE(feedback, 'Auto-aprovado ao publicar'),
           decided_by = COALESCE(decided_by, NEW.created_by),
           updated_at = now()
     WHERE post_id = NEW.id
       AND decision = 'pending'::approval_decision;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS auto_approve_on_publish_trg ON public.posts;
CREATE TRIGGER auto_approve_on_publish_trg
AFTER INSERT OR UPDATE OF status ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_on_publish();
