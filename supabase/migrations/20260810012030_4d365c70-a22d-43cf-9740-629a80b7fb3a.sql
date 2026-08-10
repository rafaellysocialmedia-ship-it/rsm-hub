
-- helper: finance access
CREATE OR REPLACE FUNCTION public.can_finance(_action text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'administrator')
      OR public.user_has_permission(auth.uid(),'finance',_action);
$$;
REVOKE ALL ON FUNCTION public.can_finance(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_finance(text) TO authenticated, service_role;

-- payment methods
CREATE TABLE public.finance_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  gateway text,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payment_methods TO authenticated;
GRANT ALL ON public.finance_payment_methods TO service_role;
ALTER TABLE public.finance_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read methods" ON public.finance_payment_methods FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage methods" ON public.finance_payment_methods FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE TRIGGER trg_finance_payment_methods_updated BEFORE UPDATE ON public.finance_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.finance_payment_methods (key,label,sort_order,is_default) VALUES
  ('pix','PIX',1,true),
  ('boleto','Boleto',2,false),
  ('credit_card','Cartão de crédito',3,false),
  ('debit_card','Cartão de débito',4,false),
  ('bank_transfer','Transferência bancária',5,false),
  ('cash','Dinheiro',6,false),
  ('other','Outro',7,false);

-- contracts
CREATE TYPE public.finance_periodicity AS ENUM ('once','monthly','quarterly','semiannual','annual');
CREATE TYPE public.finance_contract_status AS ENUM ('active','pending','ended','cancelled');

CREATE TABLE public.finance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_number text,
  service_key text,
  service_label text,
  amount numeric NOT NULL DEFAULT 0,
  periodicity public.finance_periodicity NOT NULL DEFAULT 'monthly',
  start_date date,
  end_date date,
  due_day integer,
  status public.finance_contract_status NOT NULL DEFAULT 'active',
  notes text,
  storage_path text,
  file_name text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_contracts_client ON public.finance_contracts(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_contracts TO authenticated;
GRANT ALL ON public.finance_contracts TO service_role;
ALTER TABLE public.finance_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read contracts" ON public.finance_contracts FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage contracts" ON public.finance_contracts FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE TRIGGER trg_finance_contracts_updated BEFORE UPDATE ON public.finance_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- charges (accounts receivable)
CREATE TABLE public.finance_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.finance_contracts(id) ON DELETE SET NULL,
  service_key text,
  service_label text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  status public.finance_status NOT NULL DEFAULT 'pending',
  paid_date date,
  amount_received numeric,
  responsible_id uuid REFERENCES auth.users(id),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_charges_client ON public.finance_charges(client_id);
CREATE INDEX idx_finance_charges_due ON public.finance_charges(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_charges TO authenticated;
GRANT ALL ON public.finance_charges TO service_role;
ALTER TABLE public.finance_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read charges" ON public.finance_charges FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage charges" ON public.finance_charges FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE TRIGGER trg_finance_charges_updated BEFORE UPDATE ON public.finance_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- financial history
CREATE TABLE public.finance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.finance_charges(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.finance_contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  detail text,
  amount numeric,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_history_client ON public.finance_history(client_id, created_at DESC);
GRANT SELECT, INSERT ON public.finance_history TO authenticated;
GRANT ALL ON public.finance_history TO service_role;
ALTER TABLE public.finance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read history" ON public.finance_history FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance insert history" ON public.finance_history FOR INSERT TO authenticated WITH CHECK (public.can_finance('view'));

-- automatic history logging
CREATE OR REPLACE FUNCTION public.log_finance_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'finance_charges' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.finance_history (client_id, charge_id, contract_id, event_type, title, detail, amount, actor_id)
      VALUES (NEW.client_id, NEW.id, NEW.contract_id, 'charge_created', 'Cobrança criada', NEW.description, NEW.amount, auth.uid());
    ELSE
      IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
        INSERT INTO public.finance_history (client_id, charge_id, contract_id, event_type, title, detail, amount, actor_id)
        VALUES (NEW.client_id, NEW.id, NEW.contract_id, 'payment_registered', 'Pagamento registrado', NEW.description, COALESCE(NEW.amount_received, NEW.amount), auth.uid());
      ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
        INSERT INTO public.finance_history (client_id, charge_id, contract_id, event_type, title, detail, amount, actor_id)
        VALUES (NEW.client_id, NEW.id, NEW.contract_id, 'charge_cancelled', 'Cobrança cancelada', NEW.description, NEW.amount, auth.uid());
      ELSIF OLD.amount IS DISTINCT FROM NEW.amount THEN
        INSERT INTO public.finance_history (client_id, charge_id, contract_id, event_type, title, detail, amount, actor_id)
        VALUES (NEW.client_id, NEW.id, NEW.contract_id, 'amount_changed', 'Alteração de valor', OLD.amount::text || ' → ' || NEW.amount::text, NEW.amount, auth.uid());
      ELSE
        INSERT INTO public.finance_history (client_id, charge_id, contract_id, event_type, title, detail, amount, actor_id)
        VALUES (NEW.client_id, NEW.id, NEW.contract_id, 'charge_updated', 'Cobrança editada', NEW.description, NEW.amount, auth.uid());
      END IF;
    END IF;
    RETURN NEW;
  ELSE
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.finance_history (client_id, contract_id, event_type, title, detail, amount, actor_id)
      VALUES (NEW.client_id, NEW.id, 'contract_created', 'Contrato criado', COALESCE(NEW.service_label, NEW.service_key), NEW.amount, auth.uid());
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.finance_history (client_id, contract_id, event_type, title, detail, amount, actor_id)
      VALUES (NEW.client_id, NEW.id, 'contract_status_changed', 'Status do contrato alterado', OLD.status::text || ' → ' || NEW.status::text, NEW.amount, auth.uid());
    ELSIF OLD.amount IS DISTINCT FROM NEW.amount THEN
      INSERT INTO public.finance_history (client_id, contract_id, event_type, title, detail, amount, actor_id)
      VALUES (NEW.client_id, NEW.id, 'contract_amount_changed', 'Alteração de valor do contrato', OLD.amount::text || ' → ' || NEW.amount::text, NEW.amount, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.log_finance_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_finance_charges_history AFTER INSERT OR UPDATE ON public.finance_charges FOR EACH ROW EXECUTE FUNCTION public.log_finance_history();
CREATE TRIGGER trg_finance_contracts_history AFTER INSERT OR UPDATE ON public.finance_contracts FOR EACH ROW EXECUTE FUNCTION public.log_finance_history();

-- menu + permissions for new finance screens
INSERT INTO public.app_modules (key,label,parent_key,sector_key,route,sort_order)
VALUES
  ('finance.clients','Clientes','finance','finance','/finance/clients',8),
  ('finance.payment_methods','Formas de Pagamento','finance','finance','/finance/payment-methods',9),
  ('finance.settings','Configurações','finance','finance','/finance/settings',10)
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_modules SET route = '/finance/receivables' WHERE key = 'finance.receivables' AND route IS NULL;
UPDATE public.app_modules SET route = '/finance/contracts' WHERE key = 'finance.contracts' AND route IS NULL;

INSERT INTO public.app_permissions (module_key, action, label)
SELECT m.key, a.action, a.action
FROM (VALUES ('finance.clients'),('finance.payment_methods'),('finance.settings')) AS m(key)
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete')) AS a(action)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_permissions p WHERE p.module_key = m.key AND p.action = a.action
);

INSERT INTO public.app_role_permissions (role_key, permission_id)
SELECT 'administrator', p.id FROM public.app_permissions p
WHERE p.module_key IN ('finance.clients','finance.payment_methods','finance.settings')
AND NOT EXISTS (
  SELECT 1 FROM public.app_role_permissions rp WHERE rp.role_key='administrator' AND rp.permission_id = p.id
);
