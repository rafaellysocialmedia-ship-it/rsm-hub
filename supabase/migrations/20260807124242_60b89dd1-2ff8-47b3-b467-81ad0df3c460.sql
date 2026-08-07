-- 1. Incremental fields on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS responsible_role text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS account_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS social_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS traffic_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Services
CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_key text NOT NULL,
  label text,
  situation text NOT NULL DEFAULT 'active',
  start_date date,
  amount numeric,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_services TO authenticated;
GRANT ALL ON public.client_services TO service_role;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage client services" ON public.client_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER trg_client_services_updated BEFORE UPDATE ON public.client_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Team assignments
CREATE TABLE IF NOT EXISTS public.client_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_label text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id, role_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_team_members TO authenticated;
GRANT ALL ON public.client_team_members TO service_role;
ALTER TABLE public.client_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage client team" ON public.client_team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER trg_client_team_updated BEFORE UPDATE ON public.client_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Accounts / accesses (no secrets here — passwords stay in the vault)
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL,
  platform text NOT NULL,
  identifier text,
  url text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_accounts TO authenticated;
GRANT ALL ON public.client_accounts TO service_role;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage client accounts" ON public.client_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER trg_client_accounts_updated BEFORE UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Integrations placeholders
CREATE TABLE IF NOT EXISTS public.client_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'not_connected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_integrations TO authenticated;
GRANT ALL ON public.client_integrations TO service_role;
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage client integrations" ON public.client_integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER trg_client_integrations_updated BEFORE UPDATE ON public.client_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Reusable timeline
CREATE TABLE IF NOT EXISTS public.client_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  detail text,
  metadata jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_timeline TO authenticated;
GRANT ALL ON public.client_timeline TO service_role;
ALTER TABLE public.client_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read client timeline" ON public.client_timeline FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Staff write client timeline" ON public.client_timeline FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE INDEX IF NOT EXISTS idx_client_timeline_client ON public.client_timeline(client_id, created_at DESC);

-- 7. Internal chat (never visible to clients)
CREATE TABLE IF NOT EXISTS public.client_internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_internal_messages TO authenticated;
GRANT ALL ON public.client_internal_messages TO service_role;
ALTER TABLE public.client_internal_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read internal chat" ON public.client_internal_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Staff post internal chat" ON public.client_internal_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));
CREATE POLICY "Authors edit internal chat" ON public.client_internal_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or admins delete internal chat" ON public.client_internal_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'administrator'));
CREATE INDEX IF NOT EXISTS idx_client_internal_messages_client ON public.client_internal_messages(client_id, created_at);

-- 8. Sector visibility architecture (configuration comes later)
CREATE TABLE IF NOT EXISTS public.client_section_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  sectors text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_key, client_id)
);
GRANT SELECT ON public.client_section_visibility TO authenticated;
GRANT ALL ON public.client_section_visibility TO service_role;
ALTER TABLE public.client_section_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read section visibility" ON public.client_section_visibility FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER trg_client_section_visibility_updated BEFORE UPDATE ON public.client_section_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Automatic timeline logging
CREATE OR REPLACE FUNCTION public.log_client_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'clients' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.client_timeline (client_id, event_type, title, actor_id)
      VALUES (NEW.id, 'client_created', 'Cliente criado', NEW.created_by);
    ELSE
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
        VALUES (NEW.id, 'status_changed', 'Status alterado', OLD.status::text || ' → ' || NEW.status::text, auth.uid());
      END IF;
      IF OLD.account_manager_id IS DISTINCT FROM NEW.account_manager_id
         OR OLD.social_manager_id IS DISTINCT FROM NEW.social_manager_id
         OR OLD.traffic_manager_id IS DISTINCT FROM NEW.traffic_manager_id THEN
        INSERT INTO public.client_timeline (client_id, event_type, title, actor_id)
        VALUES (NEW.id, 'owner_changed', 'Responsável interno alterado', auth.uid());
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'client_services' THEN
    INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
    VALUES (NEW.client_id, 'service_updated',
            CASE WHEN TG_OP = 'INSERT' THEN 'Serviço contratado' ELSE 'Serviço atualizado' END,
            COALESCE(NEW.label, NEW.service_key) || ' · ' || NEW.situation, auth.uid());
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'client_team_members' THEN
    INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
    VALUES (NEW.client_id, 'team_updated', 'Equipe atualizada', NEW.role_label, auth.uid());
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'files' THEN
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
      VALUES (NEW.client_id, 'document_uploaded', 'Documento enviado', NEW.name, NEW.uploaded_by);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_client_timeline() FROM anon, authenticated;

CREATE TRIGGER trg_clients_timeline_ins AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_client_timeline();
CREATE TRIGGER trg_clients_timeline_upd AFTER UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_client_timeline();
CREATE TRIGGER trg_client_services_timeline AFTER INSERT OR UPDATE ON public.client_services
  FOR EACH ROW EXECUTE FUNCTION public.log_client_timeline();
CREATE TRIGGER trg_client_team_timeline AFTER INSERT ON public.client_team_members
  FOR EACH ROW EXECUTE FUNCTION public.log_client_timeline();
CREATE TRIGGER trg_files_client_timeline AFTER INSERT ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.log_client_timeline();

-- 10. Management module in the permission catalog (non-destructive)
INSERT INTO public.app_modules (key, label, parent_key, sector_key, route, icon, sort_order, is_active)
VALUES ('management.clients', 'Clientes (Gerência)', NULL, NULL, '/management/clients', 'Building2', 95, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_permissions (module_key, action, label)
SELECT 'management.clients', a, 'Clientes (Gerência)'
FROM unnest(ARRAY['view','create','edit','delete']) a
ON CONFLICT DO NOTHING;

INSERT INTO public.app_role_permissions (role_key, permission_id)
SELECT r.key, p.id
FROM public.app_roles r
JOIN public.app_permissions p ON p.module_key = 'management.clients'
WHERE r.key IN ('administrator','management','gerencia')
ON CONFLICT DO NOTHING;