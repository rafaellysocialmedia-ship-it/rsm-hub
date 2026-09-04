ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS recurrence_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.finance_transactions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_transactions_recurrence_chk'
  ) THEN
    ALTER TABLE public.finance_transactions
      ADD CONSTRAINT finance_transactions_recurrence_chk
      CHECK (recurrence IS NULL OR recurrence = 'monthly');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS finance_transactions_recurrence_idx
  ON public.finance_transactions (recurrence, recurrence_active)
  WHERE recurrence IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_recurring_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  created int := 0;
  new_issue date;
  new_due date;
BEGIN
  FOR t IN
    SELECT *
    FROM public.finance_transactions
    WHERE recurrence = 'monthly'
      AND recurrence_active
      AND recurrence_parent_id IS NULL
      AND status <> 'cancelled'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.finance_transactions x
      WHERE (x.id = t.id OR x.recurrence_parent_id = t.id)
        AND date_trunc('month', coalesce(x.due_date, x.issue_date))
            = date_trunc('month', current_date)
    ) THEN
      CONTINUE;
    END IF;

    new_issue := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      least(extract(day from t.issue_date)::int, 28)
    );
    new_due := CASE
      WHEN t.due_date IS NULL THEN NULL
      ELSE make_date(
        extract(year from current_date)::int,
        extract(month from current_date)::int,
        least(extract(day from t.due_date)::int, 28)
      )
    END;

    INSERT INTO public.finance_transactions (
      client_id, type, category, description, amount, currency, status,
      issue_date, due_date, payment_method, notes, created_by,
      recurrence, recurrence_active, recurrence_parent_id
    ) VALUES (
      t.client_id, t.type, t.category, t.description, t.amount, t.currency, 'pending',
      new_issue, new_due, t.payment_method, t.notes, t.created_by,
      NULL, true, t.id
    );

    created := created + 1;
  END LOOP;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_transactions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_recurring_transactions() FROM anon, authenticated;
