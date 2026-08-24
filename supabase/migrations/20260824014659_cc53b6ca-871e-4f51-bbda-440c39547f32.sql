-- ============ CATEGORIAS DE DESPESA ============
CREATE TABLE public.finance_expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  group_key text NOT NULL DEFAULT 'outros',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_expense_categories TO authenticated;
GRANT ALL ON public.finance_expense_categories TO service_role;
ALTER TABLE public.finance_expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read expense categories" ON public.finance_expense_categories
  FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage expense categories" ON public.finance_expense_categories
  FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE UNIQUE INDEX finance_expense_categories_unique_name
  ON public.finance_expense_categories (group_key, lower(name));
CREATE TRIGGER trg_finance_expense_categories_updated
  BEFORE UPDATE ON public.finance_expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FORNECEDORES ============
CREATE TABLE public.finance_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  whatsapp text,
  category_id uuid REFERENCES public.finance_expense_categories(id) ON DELETE SET NULL,
  cost_center text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_suppliers TO authenticated;
GRANT ALL ON public.finance_suppliers TO service_role;
ALTER TABLE public.finance_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read suppliers" ON public.finance_suppliers
  FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage suppliers" ON public.finance_suppliers
  FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE UNIQUE INDEX finance_suppliers_unique_name ON public.finance_suppliers (lower(name));
CREATE INDEX finance_suppliers_active_idx ON public.finance_suppliers (is_active, name);
CREATE TRIGGER trg_finance_suppliers_updated
  BEFORE UPDATE ON public.finance_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DESPESAS RECORRENTES ============
CREATE TABLE public.finance_recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description text NOT NULL,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.finance_expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  periodicity public.finance_periodicity NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  due_day integer NOT NULL DEFAULT 10,
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  cost_center text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_recurring_status_check CHECK (status IN ('active','paused','ended')),
  CONSTRAINT finance_recurring_due_day_check CHECK (due_day BETWEEN 1 AND 31)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_recurring_expenses TO authenticated;
GRANT ALL ON public.finance_recurring_expenses TO service_role;
ALTER TABLE public.finance_recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read recurring expenses" ON public.finance_recurring_expenses
  FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage recurring expenses" ON public.finance_recurring_expenses
  FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE UNIQUE INDEX finance_recurring_unique
  ON public.finance_recurring_expenses (lower(description), coalesce(supplier_id,'00000000-0000-0000-0000-000000000000'::uuid), periodicity)
  WHERE status <> 'ended';
CREATE TRIGGER trg_finance_recurring_updated
  BEFORE UPDATE ON public.finance_recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONTAS A PAGAR ============
CREATE TABLE public.finance_payables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description text NOT NULL,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.finance_expense_categories(id) ON DELETE SET NULL,
  recurring_id uuid REFERENCES public.finance_recurring_expenses(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric,
  due_date date NOT NULL,
  paid_date date,
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  status public.finance_status NOT NULL DEFAULT 'pending',
  responsible_id uuid,
  cost_center text,
  competence date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payables TO authenticated;
GRANT ALL ON public.finance_payables TO service_role;
ALTER TABLE public.finance_payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read payables" ON public.finance_payables
  FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage payables" ON public.finance_payables
  FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE UNIQUE INDEX finance_payables_recurring_competence_unique
  ON public.finance_payables (recurring_id, competence)
  WHERE recurring_id IS NOT NULL AND competence IS NOT NULL;
CREATE INDEX finance_payables_due_idx ON public.finance_payables (due_date DESC);
CREATE INDEX finance_payables_status_idx ON public.finance_payables (status, due_date);
CREATE INDEX finance_payables_supplier_idx ON public.finance_payables (supplier_id);
CREATE TRIGGER trg_finance_payables_updated
  BEFORE UPDATE ON public.finance_payables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ANEXOS ============
CREATE TABLE public.finance_payable_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payable_id uuid NOT NULL REFERENCES public.finance_payables(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'documento',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payable_attachments TO authenticated;
GRANT ALL ON public.finance_payable_attachments TO service_role;
ALTER TABLE public.finance_payable_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read payable attachments" ON public.finance_payable_attachments
  FOR SELECT TO authenticated USING (public.can_finance('view'));
CREATE POLICY "finance manage payable attachments" ON public.finance_payable_attachments
  FOR ALL TO authenticated USING (public.can_finance('edit')) WITH CHECK (public.can_finance('edit'));
CREATE INDEX finance_payable_attachments_payable_idx ON public.finance_payable_attachments (payable_id);

-- ============ HISTÓRICO ============
ALTER TABLE public.finance_history
  ADD COLUMN IF NOT EXISTS payable_id uuid REFERENCES public.finance_payables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_payable_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_history (event_type, title, detail, amount, payable_id, supplier_id, actor_id)
    VALUES (
      CASE WHEN NEW.recurring_id IS NOT NULL THEN 'payable_generated' ELSE 'payable_created' END,
      CASE WHEN NEW.recurring_id IS NOT NULL THEN 'Conta recorrente gerada' ELSE 'Conta a pagar criada' END,
      NEW.description, NEW.amount, NEW.id, NEW.supplier_id, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    INSERT INTO public.finance_history (event_type, title, detail, amount, payable_id, supplier_id, actor_id)
    VALUES ('payable_paid', 'Conta paga', NEW.description, COALESCE(NEW.amount_paid, NEW.amount), NEW.id, NEW.supplier_id, auth.uid());
  ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.finance_history (event_type, title, detail, amount, payable_id, supplier_id, actor_id)
    VALUES ('payable_cancelled', 'Conta cancelada', NEW.description, NEW.amount, NEW.id, NEW.supplier_id, auth.uid());
  ELSIF NEW.amount <> OLD.amount THEN
    INSERT INTO public.finance_history (event_type, title, detail, amount, payable_id, supplier_id, actor_id)
    VALUES ('payable_updated', 'Conta editada', NEW.description, NEW.amount, NEW.id, NEW.supplier_id, auth.uid());
  ELSE
    INSERT INTO public.finance_history (event_type, title, detail, amount, payable_id, supplier_id, actor_id)
    VALUES ('payable_updated', 'Conta editada', NEW.description, NEW.amount, NEW.id, NEW.supplier_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_payable_history() FROM anon, authenticated;
CREATE TRIGGER trg_log_payable_history
  AFTER INSERT OR UPDATE ON public.finance_payables
  FOR EACH ROW EXECUTE FUNCTION public.log_payable_history();

CREATE OR REPLACE FUNCTION public.log_supplier_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.finance_history (event_type, title, detail, supplier_id, actor_id)
  VALUES ('supplier_created', 'Fornecedor criado', NEW.name, NEW.id, auth.uid());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_supplier_history() FROM anon, authenticated;
CREATE TRIGGER trg_log_supplier_history
  AFTER INSERT ON public.finance_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.log_supplier_history();

CREATE OR REPLACE FUNCTION public.log_recurring_expense_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.finance_history (event_type, title, detail, amount, supplier_id, actor_id)
  VALUES ('recurring_expense_created', 'Despesa recorrente criada', NEW.description, NEW.amount, NEW.supplier_id, auth.uid());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_recurring_expense_history() FROM anon, authenticated;
CREATE TRIGGER trg_log_recurring_expense_history
  AFTER INSERT ON public.finance_recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_recurring_expense_history();

-- ============ CATEGORIAS INICIAIS ============
INSERT INTO public.finance_expense_categories (name, group_key, sort_order) VALUES
  ('Softwares','operacionais',1),
  ('Ferramentas','operacionais',2),
  ('Internet','operacionais',3),
  ('Telefonia','operacionais',4),
  ('Hospedagem','operacionais',5),
  ('Domínios','operacionais',6),
  ('Escritório','operacionais',7),
  ('Anúncios próprios','marketing',1),
  ('Produção','marketing',2),
  ('Eventos','marketing',3),
  ('Materiais promocionais','marketing',4),
  ('Salários','equipe',1),
  ('Freelancers','equipe',2),
  ('Prestadores','equipe',3),
  ('Comissões','equipe',4),
  ('Benefícios','equipe',5),
  ('Contabilidade','administrativo',1),
  ('Jurídico','administrativo',2),
  ('Bancário','administrativo',3),
  ('Impostos','administrativo',4),
  ('Taxas','administrativo',5),
  ('Outros','outros',1)
ON CONFLICT DO NOTHING;

-- ============ MÓDULOS E PERMISSÕES ============
UPDATE public.app_modules SET route = '/finance/payables' WHERE key = 'finance.payables';
UPDATE public.app_modules SET route = '/finance/expenses' WHERE key = 'finance.expenses';

INSERT INTO public.app_modules (key, label, parent_key, route, sort_order)
VALUES
  ('finance.suppliers','Fornecedores','finance','/finance/suppliers',6),
  ('finance.expense_categories','Categorias de Despesa','finance','/finance/expense-categories',11),
  ('finance.recurring_expenses','Despesas Recorrentes','finance','/finance/expenses',12)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_permissions (module_key, action, label)
SELECT m.key, a.action, a.label
FROM (VALUES
  ('finance.payables'),('finance.expenses'),('finance.suppliers'),
  ('finance.expense_categories'),('finance.recurring_expenses')
) AS m(key)
CROSS JOIN (VALUES ('view','Visualizar'),('create','Criar'),('edit','Editar'),('delete','Excluir/Cancelar')) AS a(action,label)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_permissions p WHERE p.module_key = m.key AND p.action = a.action
);

-- Financeiro: acesso total aos novos módulos; Gerência: apenas visualização
INSERT INTO public.app_role_permissions (role_key, permission_id)
SELECT 'finance', p.id FROM public.app_permissions p
WHERE p.module_key IN ('finance.payables','finance.expenses','finance.suppliers','finance.expense_categories','finance.recurring_expenses')
  AND NOT EXISTS (SELECT 1 FROM public.app_role_permissions rp WHERE rp.role_key='finance' AND rp.permission_id=p.id);

INSERT INTO public.app_role_permissions (role_key, permission_id)
SELECT 'management', p.id FROM public.app_permissions p
WHERE p.module_key IN ('finance.payables','finance.expenses','finance.suppliers','finance.expense_categories','finance.recurring_expenses')
  AND p.action = 'view'
  AND NOT EXISTS (SELECT 1 FROM public.app_role_permissions rp WHERE rp.role_key='management' AND rp.permission_id=p.id);