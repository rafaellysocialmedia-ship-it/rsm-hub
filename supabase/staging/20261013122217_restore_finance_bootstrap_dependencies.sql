-- Homologation bootstrap only. Apply before 20261003205105 on a fresh staging DB.
-- These dependencies were missing from git; definitions were inspected read-only
-- from the existing schema. No production records or credentials are included.
ALTER TABLE public.finance_contracts ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS default_payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.apply_client_default_payment_method()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.payment_method_id IS NULL AND NEW.client_id IS NOT NULL THEN
  SELECT c.default_payment_method_id INTO NEW.payment_method_id FROM public.clients c WHERE c.id=NEW.client_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apply_client_default_payment_method() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_apply_client_default_payment_method BEFORE INSERT ON public.finance_charges
 FOR EACH ROW EXECUTE FUNCTION public.apply_client_default_payment_method();

CREATE FUNCTION public.renew_expired_finance_contracts() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; renewed integer:=0; term_days integer;
BEGIN
 IF NOT ((auth.uid() IS NULL AND current_setting('role',true) IN ('none','postgres','service_role')) OR public.can_finance('edit')) THEN
  RAISE EXCEPTION 'A automação financeira exige permissão de edição' USING ERRCODE='42501';
 END IF;
 FOR c IN SELECT * FROM public.finance_contracts WHERE status='active' AND auto_renew=true
 AND EXISTS(SELECT 1 FROM public.clients cl WHERE cl.id=finance_contracts.client_id AND cl.status='active' AND NOT cl.churned)
 AND end_date IS NOT NULL AND end_date<current_date LOOP
  IF c.start_date IS NOT NULL AND c.end_date>=c.start_date THEN
   term_days:=greatest(1,(c.end_date-c.start_date)+1);
   WHILE c.end_date<current_date LOOP c.end_date:=c.end_date+term_days; END LOOP;
  ELSE
   WHILE c.end_date<current_date LOOP c.end_date:=(c.end_date+interval '1 month')::date; END LOOP;
  END IF;
  UPDATE public.finance_contracts SET end_date=c.end_date,auto_billing=true,billing_paused_at=null,updated_at=now() WHERE id=c.id;
  renewed:=renewed+1;
 END LOOP;
 RETURN renewed;
END $$;
CREATE FUNCTION public.run_finance_automation() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE renewed integer; generated integer;
BEGIN
 IF NOT ((auth.uid() IS NULL AND current_setting('role',true) IN ('none','postgres','service_role')) OR public.can_finance('edit')) THEN
  RAISE EXCEPTION 'A automação financeira exige permissão de edição' USING ERRCODE='42501';
 END IF;
 renewed:=public.renew_expired_finance_contracts();
 generated:=public.generate_recurring_charges();
 RETURN jsonb_build_object('renewed_contracts',renewed,'generated_charges',generated);
END $$;
REVOKE ALL ON FUNCTION public.renew_expired_finance_contracts(),public.run_finance_automation() FROM PUBLIC,anon,authenticated;
