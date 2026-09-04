ALTER TABLE public.client_services
  ADD COLUMN IF NOT EXISTS billing_day integer,
  ADD COLUMN IF NOT EXISTS auto_billing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_billed_on date;

CREATE OR REPLACE FUNCTION public.generate_recurring_charges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  s record;
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

  -- Serviços ativos sem contrato próprio: gera a mensalidade do serviço.
  FOR s IN
    SELECT cs.*
    FROM public.client_services cs
    JOIN public.clients cl ON cl.id = cs.client_id
    WHERE cs.situation = 'active'
      AND cs.auto_billing
      AND coalesce(cs.amount, 0) > 0
      AND cl.status = 'active'
      AND (cs.start_date IS NULL OR cs.start_date <= current_date)
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_contracts ct
        WHERE ct.client_id = cs.client_id
          AND ct.service_key = cs.service_key
          AND ct.status = 'active'
          AND ct.auto_billing
      )
  LOOP
    day_of_month := least(greatest(coalesce(s.billing_day, 5), 1), 28);
    due := make_date(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      day_of_month
    );

    IF EXISTS (
      SELECT 1 FROM public.finance_charges fc
      WHERE fc.client_id = s.client_id
        AND fc.service_key = s.service_key
        AND fc.contract_id IS NULL
        AND fc.due_date >= date_trunc('month', current_date)::date
        AND fc.due_date < (date_trunc('month', current_date) + interval '1 month')::date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.finance_charges (
      client_id, service_key, service_label, description,
      amount, due_date, status, notes
    ) VALUES (
      s.client_id, s.service_key, coalesce(s.label, s.service_key),
      coalesce(s.label, s.service_key) || ' · mensalidade',
      s.amount, due, 'pending', 'Gerada automaticamente pelo serviço ativo do cliente'
    );

    UPDATE public.client_services
       SET last_billed_on = due
     WHERE id = s.id;

    created := created + 1;
  END LOOP;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_charges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recurring_charges() TO authenticated, service_role;

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
     WHERE client_id = NEW.id AND auto_billing;
    UPDATE public.client_services
       SET auto_billing = false
     WHERE client_id = NEW.id AND auto_billing;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_billing_on_churn() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_billing_on_churn() TO authenticated, service_role;