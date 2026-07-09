
-- ============ MEETINGS ============
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage all meetings"
  ON public.meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients read own meetings"
  ON public.meetings FOR SELECT TO authenticated
  USING (
    client_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = meetings.client_id AND c.user_id = auth.uid())
  );

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX meetings_date_idx ON public.meetings(meeting_date);
CREATE INDEX meetings_client_idx ON public.meetings(client_id);

-- ============ AUTO-APPROVE POST STATUS ============
CREATE OR REPLACE FUNCTION public.sync_post_status_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decision = 'approved' AND (TG_OP = 'INSERT' OR OLD.decision IS DISTINCT FROM NEW.decision) THEN
    UPDATE public.posts
       SET status = 'approved'::post_status,
           updated_at = now()
     WHERE id = NEW.post_id
       AND status IN ('review','idea','production');
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_post_status_on_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS post_approvals_sync_status ON public.post_approvals;
CREATE TRIGGER post_approvals_sync_status
  AFTER INSERT OR UPDATE ON public.post_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_status_on_approval();
