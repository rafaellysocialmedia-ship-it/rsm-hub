
-- Approvals table for client area
CREATE TYPE public.approval_decision AS ENUM ('pending','approved','rejected','changes_requested');

CREATE TABLE public.post_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision public.approval_decision NOT NULL DEFAULT 'pending',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_approvals_post ON public.post_approvals(post_id);
CREATE INDEX idx_post_approvals_client ON public.post_approvals(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_approvals TO authenticated;
GRANT ALL ON public.post_approvals TO service_role;

ALTER TABLE public.post_approvals ENABLE ROW LEVEL SECURITY;

-- Staff full access
CREATE POLICY "Staff manage approvals" ON public.post_approvals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

-- Clients can view approvals of their own client record
CREATE POLICY "Clients view own approvals" ON public.post_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = post_approvals.client_id AND c.user_id = auth.uid()));

-- Clients can insert/update their own decisions
CREATE POLICY "Clients decide own approvals" ON public.post_approvals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = post_approvals.client_id AND c.user_id = auth.uid()));

CREATE POLICY "Clients update own approvals" ON public.post_approvals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = post_approvals.client_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = post_approvals.client_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_post_approvals_updated BEFORE UPDATE ON public.post_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.post_approvals;
