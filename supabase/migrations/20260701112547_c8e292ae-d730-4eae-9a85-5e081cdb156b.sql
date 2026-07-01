
-- Enums
DO $$ BEGIN
  CREATE TYPE public.finance_type AS ENUM ('income','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_status AS ENUM ('pending','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  type public.finance_type NOT NULL DEFAULT 'income',
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.finance_status NOT NULL DEFAULT 'pending',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

-- Staff full access
CREATE POLICY "Staff can view finance"
  ON public.finance_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can insert finance"
  ON public.finance_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can update finance"
  ON public.finance_transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can delete finance"
  ON public.finance_transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

-- Clients can view their own transactions
CREATE POLICY "Clients view own finance"
  ON public.finance_transactions FOR SELECT TO authenticated
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = finance_transactions.client_id AND c.user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_transactions;

CREATE INDEX finance_client_idx ON public.finance_transactions(client_id);
CREATE INDEX finance_status_idx ON public.finance_transactions(status);
CREATE INDEX finance_issue_idx ON public.finance_transactions(issue_date DESC);
