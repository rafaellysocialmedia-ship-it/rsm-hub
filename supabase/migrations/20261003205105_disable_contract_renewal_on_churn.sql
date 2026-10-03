CREATE OR REPLACE FUNCTION public.pause_billing_on_churn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.churned OR (NEW.status <> 'active' AND OLD.status = 'active') THEN
    UPDATE public.finance_contracts
       SET auto_billing = false, auto_renew = CASE WHEN NEW.churned THEN false ELSE auto_renew END,
           billing_paused_at = now()
     WHERE client_id = NEW.id AND (auto_billing OR (NEW.churned AND auto_renew));
    UPDATE public.client_services
       SET auto_billing = false
     WHERE client_id = NEW.id AND auto_billing;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pause_billing_on_churn() FROM PUBLIC, anon, authenticated;
UPDATE public.finance_contracts ct
SET auto_billing = false, auto_renew = false, billing_paused_at = now()
FROM public.clients cl
WHERE cl.id = ct.client_id AND cl.churned AND (ct.auto_billing OR ct.auto_renew);
