-- Unifica o dashboard financeiro (finance_transactions) com o sistema de
-- cobrancas/contratos (finance_charges + finance_contracts).
--
-- Ate aqui, pagar/criar uma cobranca em Contas a Receber nunca refletia no
-- dashboard principal (/finance), porque as duas telas liam de tabelas
-- diferentes e nada as mantinha em sincronia. Esta migration cria um
-- espelhamento automatico via trigger: toda cobranca criada, editada ou
-- excluida em finance_charges gera/atualiza/remove o lancamento
-- correspondente em finance_transactions.

-- 1) Coluna de vinculo (idempotencia) + evita duplicar o mesmo lancamento
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS source_charge_id uuid REFERENCES public.finance_charges(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_transactions_source_charge
  ON public.finance_transactions(source_charge_id)
  WHERE source_charge_id IS NOT NULL;

-- 2) Funcao de sincronizacao
CREATE OR REPLACE FUNCTION public.sync_finance_charge_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _method_label text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.finance_transactions WHERE source_charge_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT label INTO _method_label
  FROM public.finance_payment_methods
  WHERE id = NEW.payment_method_id;

  INSERT INTO public.finance_transactions (
    source_charge_id, client_id, type, category, description, amount,
    status, issue_date, due_date, paid_date, payment_method, notes, created_by
  )
  VALUES (
    NEW.id, NEW.client_id, 'income', COALESCE(NEW.service_label, 'Contrato'),
    NEW.description, COALESCE(NEW.amount_received, NEW.amount), NEW.status,
    NEW.created_at::date, NEW.due_date, NEW.paid_date, _method_label, NEW.notes,
    NEW.created_by
  )
  ON CONFLICT (source_charge_id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    due_date = EXCLUDED.due_date,
    paid_date = EXCLUDED.paid_date,
    payment_method = EXCLUDED.payment_method,
    notes = EXCLUDED.notes;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_finance_charge_to_transaction() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_finance_charge_to_transaction ON public.finance_charges;
CREATE TRIGGER trg_sync_finance_charge_to_transaction
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_charges
  FOR EACH ROW EXECUTE FUNCTION public.sync_finance_charge_to_transaction();

-- 3) Backfill: espelha cobrancas ja existentes que ainda nao tem lancamento
INSERT INTO public.finance_transactions (
  source_charge_id, client_id, type, category, description, amount,
  status, issue_date, due_date, paid_date, payment_method, notes, created_by
)
SELECT
  fc.id, fc.client_id, 'income', COALESCE(fc.service_label, 'Contrato'),
  fc.description, COALESCE(fc.amount_received, fc.amount), fc.status,
  fc.created_at::date, fc.due_date, fc.paid_date, pm.label, fc.notes, fc.created_by
FROM public.finance_charges fc
LEFT JOIN public.finance_payment_methods pm ON pm.id = fc.payment_method_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_transactions ft WHERE ft.source_charge_id = fc.id
);
