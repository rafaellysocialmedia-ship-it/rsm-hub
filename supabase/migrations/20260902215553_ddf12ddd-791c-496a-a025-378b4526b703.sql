-- 1) Visibilidade do histórico do cliente
ALTER TABLE public.client_timeline
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_timeline_visibility_chk'
  ) THEN
    ALTER TABLE public.client_timeline
      ADD CONSTRAINT client_timeline_visibility_chk
      CHECK (visibility IN ('internal', 'client'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Clients read their visible timeline" ON public.client_timeline;
CREATE POLICY "Clients read their visible timeline"
ON public.client_timeline FOR SELECT TO authenticated
USING (
  visibility = 'client'
  AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- 2) Cobrança recorrente automática
ALTER TABLE public.finance_contracts
  ADD COLUMN IF NOT EXISTS auto_billing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_billed_on date;

CREATE OR REPLACE FUNCTION public.generate_recurring_charges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  created int := 0;
  step int;
  day_of_month int;
  due date;
  months_elapsed int;
  anchor date;
BEGIN
  FOR c IN
    SELECT ct.*
    FROM public.finance_contracts ct
    JOIN public.clients cl ON cl.id = ct.client_id
    WHERE ct.status = 'active'
      AND ct.auto_billing
      AND ct.periodicity <> 'once'
      AND cl.status = 'active'
      AND (ct.start_date IS NULL OR ct.start_date <= current_date)
      AND (ct.end_date IS NULL OR ct.end_date >= current_date)
  LOOP
    step := CASE c.periodicity
              WHEN 'monthly' THEN 1
              WHEN 'quarterly' THEN 3
              WHEN 'semiannual' THEN 6
              WHEN 'annual' THEN 12
              ELSE 1
            END;
    anchor := coalesce(c.start_date, c.created_at::date);
    months_elapsed :=
      (extract(year from current_date)::int * 12 + extract(month from current_date)::int)
      - (extract(year from anchor)::int * 12 + extract(month from anchor)::int);

    IF months_elapsed < 0 OR (months_elapsed % step) <> 0 THEN
      CONTINUE;
    END IF;

    day_of_month := least(greatest(coalesce(c.due_day, 5), 1), 28);
    due := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      day_of_month
    );

    IF EXISTS (
      SELECT 1 FROM public.finance_charges fc
      WHERE fc.contract_id = c.id
        AND fc.due_date >= date_trunc('month', current_date)::date
        AND fc.due_date < (date_trunc('month', current_date) + interval '1 month')::date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.finance_charges (
      client_id, contract_id, service_key, service_label, description,
      amount, due_date, status, notes
    ) VALUES (
      c.client_id, c.id, c.service_key, c.service_label,
      coalesce(c.service_label, 'Contrato') || ' · cobrança automática',
      c.amount, due, 'pending', 'Gerada automaticamente pela recorrência do contrato'
    );

    UPDATE public.finance_contracts
       SET last_billed_on = due
     WHERE id = c.id;

    created := created + 1;
  END LOOP;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_charges() FROM anon, authenticated;

-- Churn do cliente pausa a cobrança automática dos contratos
CREATE OR REPLACE FUNCTION public.pause_billing_on_churn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    UPDATE public.finance_contracts
       SET auto_billing = false,
           billing_paused_at = now()
     WHERE client_id = NEW.id
       AND auto_billing;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_billing_on_churn() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_pause_billing_on_churn ON public.clients;
CREATE TRIGGER trg_pause_billing_on_churn
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.pause_billing_on_churn();

-- Agenda diária
SELECT cron.unschedule('generate-recurring-charges')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-recurring-charges');

SELECT cron.schedule(
  'generate-recurring-charges',
  '0 6 * * *',
  $$SELECT public.generate_recurring_charges();$$
);
