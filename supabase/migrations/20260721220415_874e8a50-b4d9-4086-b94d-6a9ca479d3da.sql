
DO $$ BEGIN
  CREATE TYPE public.client_journey_stage AS ENUM (
    'closing','kickoff','onboarding','ongoing','renewal','offboarded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS journey_stage public.client_journey_stage NOT NULL DEFAULT 'closing',
  ADD COLUMN IF NOT EXISTS journey_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.client_journey_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage public.client_journey_stage NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_journey_events TO authenticated;
GRANT ALL ON public.client_journey_events TO service_role;
ALTER TABLE public.client_journey_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and owner can view journey events" ON public.client_journey_events
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
);
CREATE POLICY "Staff can insert journey events" ON public.client_journey_events
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
);

CREATE TABLE IF NOT EXISTS public.client_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contracts TO authenticated;
GRANT ALL ON public.client_contracts TO service_role;
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage contracts" ON public.client_contracts
FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
) WITH CHECK (
  public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
);
CREATE POLICY "Client view own contracts" ON public.client_contracts
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
);

CREATE TRIGGER trg_client_contracts_updated
BEFORE UPDATE ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies
CREATE POLICY "Staff read contracts storage" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'client-contracts' AND (
    public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
  )
);
CREATE POLICY "Staff write contracts storage" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'client-contracts' AND (
    public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
  )
);
CREATE POLICY "Staff update contracts storage" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'client-contracts' AND (
    public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
  )
);
CREATE POLICY "Staff delete contracts storage" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'client-contracts' AND (
    public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')
  )
);
CREATE POLICY "Client read own contract files" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'client-contracts' AND EXISTS (
    SELECT 1 FROM public.client_contracts cc
    JOIN public.clients c ON c.id = cc.client_id
    WHERE cc.storage_path = storage.objects.name AND c.user_id = auth.uid()
  )
);

-- Journey stage change → log event automatically
CREATE OR REPLACE FUNCTION public.log_client_journey_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.journey_stage IS DISTINCT FROM NEW.journey_stage THEN
    NEW.journey_updated_at := now();
    INSERT INTO public.client_journey_events (client_id, stage, changed_by)
    VALUES (NEW.id, NEW.journey_stage, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_client_journey_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_client_journey ON public.clients;
CREATE TRIGGER trg_log_client_journey
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.log_client_journey_change();

-- Auto-generate onboarding tasks when a client is created
CREATE OR REPLACE FUNCTION public.seed_onboarding_tasks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _titles TEXT[] := ARRAY[
    'Dia 1 — Reunião de kickoff e alinhamento inicial',
    'Dia 2 — Coletar acessos e credenciais das plataformas',
    'Dia 3 — Preencher briefing completo com o cliente',
    'Dia 4 — Definir tom de voz, referências visuais e pilares',
    'Dia 5 — Planejar calendário editorial do primeiro mês',
    'Dia 6 — Produzir e aprovar primeiro lote de conteúdo',
    'Dia 7 — Revisão da semana de onboarding e próximos passos'
  ];
  _i INT;
BEGIN
  FOR _i IN 1..array_length(_titles,1) LOOP
    INSERT INTO public.tasks (title, client_id, status, priority, due_date, created_by)
    VALUES (
      _titles[_i], NEW.id, 'todo', 'high',
      (CURRENT_DATE + (_i - 1))::date,
      NEW.created_by
    );
  END LOOP;
  INSERT INTO public.client_journey_events (client_id, stage, note, changed_by)
  VALUES (NEW.id, NEW.journey_stage, 'Cliente cadastrado', NEW.created_by);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seed_onboarding_tasks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_seed_onboarding ON public.clients;
CREATE TRIGGER trg_seed_onboarding
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.seed_onboarding_tasks();
