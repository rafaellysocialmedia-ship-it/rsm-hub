-- =========================
-- SECTORS
-- =========================
CREATE TABLE public.app_sectors (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_sectors TO authenticated;
GRANT ALL ON public.app_sectors TO service_role;
ALTER TABLE public.app_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sectors_read" ON public.app_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors_admin_write" ON public.app_sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- =========================
-- MODULES
-- =========================
CREATE TABLE public.app_modules (
  key text PRIMARY KEY,
  label text NOT NULL,
  parent_key text REFERENCES public.app_modules(key) ON DELETE CASCADE,
  sector_key text REFERENCES public.app_sectors(key) ON DELETE SET NULL,
  route text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_modules TO authenticated;
GRANT ALL ON public.app_modules TO service_role;
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_read" ON public.app_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "modules_admin_write" ON public.app_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- =========================
-- PERMISSIONS
-- =========================
CREATE TABLE public.app_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL REFERENCES public.app_modules(key) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view','create','edit','delete')),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_key, action)
);
GRANT SELECT ON public.app_permissions TO authenticated;
GRANT ALL ON public.app_permissions TO service_role;
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read" ON public.app_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_admin_write" ON public.app_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- =========================
-- ROLES (dynamic)
-- =========================
CREATE TABLE public.app_roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  sector_key text REFERENCES public.app_sectors(key) ON DELETE SET NULL,
  is_system boolean NOT NULL DEFAULT false,
  legacy_role public.app_role,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON public.app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.app_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- =========================
-- ROLE <-> PERMISSION
-- =========================
CREATE TABLE public.app_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL REFERENCES public.app_roles(key) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.app_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_key, permission_id)
);
GRANT SELECT ON public.app_role_permissions TO authenticated;
GRANT ALL ON public.app_role_permissions TO service_role;
ALTER TABLE public.app_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read" ON public.app_role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_admin_write" ON public.app_role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- =========================
-- USER <-> ROLE
-- =========================
CREATE TABLE public.user_app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES public.app_roles(key) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);
GRANT SELECT ON public.user_app_roles TO authenticated;
GRANT ALL ON public.user_app_roles TO service_role;
ALTER TABLE public.user_app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_app_roles_self_read" ON public.user_app_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "user_app_roles_admin_write" ON public.user_app_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- updated_at triggers
CREATE TRIGGER trg_app_sectors_updated BEFORE UPDATE ON public.app_sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_app_modules_updated BEFORE UPDATE ON public.app_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_app_roles_updated BEFORE UPDATE ON public.app_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- SEED SECTORS
-- =========================
INSERT INTO public.app_sectors (key, label, sort_order) VALUES
  ('operations','Operações',1),
  ('social','Social Media',2),
  ('traffic','Tráfego Pago',3),
  ('creative','Criação',4),
  ('commercial','Comercial',5),
  ('finance','Financeiro',6),
  ('management','Gerência',7),
  ('client','Cliente',8);

-- =========================
-- SEED MODULES
-- =========================
INSERT INTO public.app_modules (key,label,parent_key,sector_key,route,sort_order) VALUES
  ('workspace','Workspace',NULL,'operations',NULL,1),
  ('social','Social Media',NULL,'social',NULL,2),
  ('traffic','Tráfego Pago',NULL,'traffic',NULL,3),
  ('academy','Academy',NULL,'operations',NULL,4),
  ('marketplace','Marketplace',NULL,'operations',NULL,5),
  ('commercial','Comercial',NULL,'commercial',NULL,6),
  ('finance','Financeiro',NULL,'finance',NULL,7),
  ('management','Gerência',NULL,'management',NULL,8);

INSERT INTO public.app_modules (key,label,parent_key,sector_key,route,sort_order) VALUES
  ('workspace.dashboard','Dashboard','workspace','operations','/dashboard',1),
  ('workspace.tasks','Tarefas','workspace','operations','/tasks',2),
  ('workspace.meetings','Reuniões','workspace','operations','/meetings',3),
  ('workspace.library','Biblioteca','workspace','operations','/library',4),
  ('workspace.vault','Acessos','workspace','operations','/vault',5),
  ('workspace.clients','Clientes','workspace','operations','/clients',6),
  ('social.calendar','Calendário','social','social','/posts',1),
  ('social.approvals','Aprovações','social','social','/portal',2),
  ('social.content','Conteúdos','social','social',NULL,3),
  ('social.analytics','Analytics','social','social','/analytics',4),
  ('social.briefings','Briefings','social','social','/briefings',5),
  ('social.ai','IA','social','social','/ai',6),
  ('traffic.dashboard','Dashboard','traffic','traffic','/traffic',1),
  ('traffic.crm','CRM','traffic','traffic','/traffic/crm',2),
  ('traffic.analytics','Analytics','traffic','traffic','/traffic/analytics',3),
  ('academy.courses','Cursos','academy','operations','/courses',1),
  ('marketplace.services','Serviços','marketplace','operations','/marketplace',1),
  ('commercial.dashboard','Dashboard','commercial','commercial',NULL,1),
  ('commercial.crm','CRM','commercial','commercial',NULL,2),
  ('commercial.leads','Leads','commercial','commercial',NULL,3),
  ('commercial.proposals','Propostas','commercial','commercial',NULL,4),
  ('commercial.contracts','Contratos','commercial','commercial',NULL,5),
  ('finance.dashboard','Dashboard','finance','finance','/finance',1),
  ('finance.revenues','Receitas','finance','finance',NULL,2),
  ('finance.expenses','Despesas','finance','finance',NULL,3),
  ('finance.receivables','Contas a Receber','finance','finance',NULL,4),
  ('finance.payables','Contas a Pagar','finance','finance',NULL,5),
  ('finance.cashflow','Fluxo de Caixa','finance','finance',NULL,6),
  ('finance.contracts','Contratos','finance','finance',NULL,7),
  ('management.clients','Clientes','management','management','/clients',1),
  ('management.team','Equipe','management','management','/team',2),
  ('management.permissions','Permissões','management','management','/admin/permissions',3),
  ('management.services','Serviços','management','management',NULL,4),
  ('management.sectors','Setores','management','management',NULL,5),
  ('management.settings','Configurações','management','management','/settings',6),
  ('management.courses','Gerenciar Cursos','management','management','/admin/courses',7);

-- =========================
-- SEED PERMISSIONS (view/create/edit/delete for every module)
-- =========================
INSERT INTO public.app_permissions (module_key, action, label)
SELECT m.key, a.action,
       m.label || ' — ' || CASE a.action WHEN 'view' THEN 'Visualizar' WHEN 'create' THEN 'Criar' WHEN 'edit' THEN 'Editar' ELSE 'Excluir' END
FROM public.app_modules m
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete')) AS a(action);

-- =========================
-- SEED ROLES
-- =========================
INSERT INTO public.app_roles (key,label,description,sector_key,is_system,legacy_role,sort_order) VALUES
  ('administrator','Administrador','Acesso completo a todos os módulos e configurações.','management',true,'administrator',1),
  ('management','Gerência','Gestão de clientes, equipe, permissões e setores.','management',true,'team',2),
  ('finance','Financeiro','Gestão financeira, contratos e fluxo de caixa.','finance',true,'team',3),
  ('commercial','Comercial','Gestão de leads, propostas e CRM comercial.','commercial',true,'team',4),
  ('social_media','Social Media','Planejamento, produção e aprovação de conteúdo.','social',true,'team',5),
  ('traffic_manager','Gestor de Tráfego','Gestão de campanhas, CRM e analytics de tráfego.','traffic',true,'team',6),
  ('designer','Designer','Criação de peças e criativos.','creative',true,'team',7),
  ('video_editor','Editor de Vídeo','Edição e finalização de vídeos.','creative',true,'team',8),
  ('copywriter','Copywriter','Redação de roteiros, legendas e copies.','creative',true,'team',9),
  ('support','Atendimento','Relacionamento e suporte ao cliente.','operations',true,'team',10),
  ('client','Cliente','Acesso ao portal do cliente.','client',true,'client',11),
  ('team','Equipe (legado)','Perfil legado equivalente à equipe interna completa.','operations',true,'team',99);

-- =========================
-- SEED ROLE PERMISSIONS
-- =========================
-- administrator: everything
INSERT INTO public.app_role_permissions (role_key, permission_id)
SELECT 'administrator', id FROM public.app_permissions;

-- helper: grant all actions of given module prefixes to a role
CREATE OR REPLACE FUNCTION public.seed_role_modules(_role text, _modules text[], _actions text[])
RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.app_role_permissions (role_key, permission_id)
  SELECT _role, p.id FROM public.app_permissions p
  WHERE (p.module_key = ANY(_modules) OR EXISTS (
          SELECT 1 FROM unnest(_modules) m WHERE p.module_key LIKE m || '.%'))
    AND p.action = ANY(_actions)
  ON CONFLICT DO NOTHING;
$$;

SELECT public.seed_role_modules('team', ARRAY['workspace','social','traffic','academy','marketplace','finance'], ARRAY['view','create','edit','delete']);
SELECT public.seed_role_modules('management', ARRAY['workspace','social','traffic','academy','marketplace','finance','commercial','management'], ARRAY['view','create','edit','delete']);
SELECT public.seed_role_modules('finance', ARRAY['workspace.dashboard','finance','academy','marketplace'], ARRAY['view','create','edit','delete']);
SELECT public.seed_role_modules('commercial', ARRAY['workspace.dashboard','commercial','academy','marketplace'], ARRAY['view','create','edit','delete']);
SELECT public.seed_role_modules('social_media', ARRAY['workspace','social','academy','marketplace'], ARRAY['view','create','edit','delete']);
SELECT public.seed_role_modules('traffic_manager', ARRAY['workspace','traffic','academy','marketplace'], ARRAY['view','create','edit','delete']);
SELECT public.seed_role_modules('designer', ARRAY['workspace.dashboard','workspace.tasks','workspace.library','social.calendar','social.content','academy','marketplace'], ARRAY['view','create','edit']);
SELECT public.seed_role_modules('video_editor', ARRAY['workspace.dashboard','workspace.tasks','workspace.library','social.calendar','social.content','academy','marketplace'], ARRAY['view','create','edit']);
SELECT public.seed_role_modules('copywriter', ARRAY['workspace.dashboard','workspace.tasks','workspace.library','social.calendar','social.content','social.ai','academy','marketplace'], ARRAY['view','create','edit']);
SELECT public.seed_role_modules('support', ARRAY['workspace.dashboard','workspace.tasks','workspace.meetings','workspace.library','social.approvals','academy','marketplace'], ARRAY['view','create','edit']);
SELECT public.seed_role_modules('client', ARRAY['workspace.dashboard','workspace.library','social.approvals','social.analytics','academy','marketplace'], ARRAY['view']);

DROP FUNCTION public.seed_role_modules(text, text[], text[]);

-- =========================
-- BACKFILL user assignments from legacy user_roles
-- =========================
INSERT INTO public.user_app_roles (user_id, role_key)
SELECT ur.user_id,
       CASE ur.role WHEN 'administrator' THEN 'administrator' WHEN 'client' THEN 'client' ELSE 'team' END
FROM public.user_roles ur
ON CONFLICT DO NOTHING;

-- =========================
-- HELPER FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _module text, _action text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_app_roles uar
    JOIN public.app_role_permissions arp ON arp.role_key = uar.role_key
    JOIN public.app_permissions p ON p.id = arp.permission_id
    WHERE uar.user_id = _user_id AND p.module_key = _module AND p.action = _action
  );
$$;
REVOKE ALL ON FUNCTION public.user_has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE (module_key text, action text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.module_key, p.action
  FROM public.user_app_roles uar
  JOIN public.app_role_permissions arp ON arp.role_key = uar.role_key
  JOIN public.app_permissions p ON p.id = arp.permission_id
  WHERE uar.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated, service_role;

-- keep dynamic assignments in sync when legacy roles change
CREATE OR REPLACE FUNCTION public.sync_user_app_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_app_roles (user_id, role_key)
  VALUES (NEW.user_id, CASE NEW.role WHEN 'administrator' THEN 'administrator' WHEN 'client' THEN 'client' ELSE 'team' END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_user_app_role() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_user_app_role
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_user_app_role();