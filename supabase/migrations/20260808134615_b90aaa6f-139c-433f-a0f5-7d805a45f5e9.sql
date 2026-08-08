-- ENUMS
CREATE TYPE public.traffic_platform AS ENUM ('meta_ads','google_ads','tiktok_ads','linkedin_ads','other');
CREATE TYPE public.traffic_objective AS ENUM ('leads','conversions','whatsapp','messages','traffic','awareness','sales');
CREATE TYPE public.traffic_campaign_status AS ENUM ('setup','active','paused','ended');
CREATE TYPE public.traffic_lead_stage AS ENUM ('new','first_contact','in_service','proposal','client','lost');
CREATE TYPE public.landing_page_status AS ENUM ('development','review','published','paused');

-- CAMPAIGNS
CREATE TABLE public.traffic_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform public.traffic_platform NOT NULL DEFAULT 'meta_ads',
  objective public.traffic_objective NOT NULL DEFAULT 'leads',
  status public.traffic_campaign_status NOT NULL DEFAULT 'setup',
  daily_budget numeric,
  total_budget numeric,
  start_date date,
  end_date date,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_id text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_campaigns TO authenticated;
GRANT ALL ON public.traffic_campaigns TO service_role;
ALTER TABLE public.traffic_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage campaigns" ON public.traffic_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Clients view own campaigns" ON public.traffic_campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE TRIGGER traffic_campaigns_updated_at BEFORE UPDATE ON public.traffic_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_traffic_campaigns_client ON public.traffic_campaigns(client_id);

-- METRICS
CREATE TABLE public.traffic_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.traffic_campaigns(id) ON DELETE CASCADE,
  collected_at date NOT NULL DEFAULT CURRENT_DATE,
  impressions integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  revenue numeric,
  roas numeric,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_metrics TO authenticated;
GRANT ALL ON public.traffic_metrics TO service_role;
ALTER TABLE public.traffic_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage metrics" ON public.traffic_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Clients view own metrics" ON public.traffic_metrics FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.traffic_campaigns tc
    JOIN public.clients c ON c.id = tc.client_id
    WHERE tc.id = campaign_id AND c.user_id = auth.uid()));
CREATE TRIGGER traffic_metrics_updated_at BEFORE UPDATE ON public.traffic_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_traffic_metrics_campaign ON public.traffic_metrics(campaign_id, collected_at);

-- LEADS
CREATE TABLE public.traffic_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.traffic_campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  source text,
  platform public.traffic_platform,
  stage public.traffic_lead_stage NOT NULL DEFAULT 'new',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  value numeric,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_leads TO authenticated;
GRANT ALL ON public.traffic_leads TO service_role;
ALTER TABLE public.traffic_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage leads" ON public.traffic_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Clients view own leads" ON public.traffic_leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE TRIGGER traffic_leads_updated_at BEFORE UPDATE ON public.traffic_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_traffic_leads_client ON public.traffic_leads(client_id, stage);

-- LANDING PAGES
CREATE TABLE public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  production_url text,
  staging_url text,
  domain text,
  builder text,
  status public.landing_page_status NOT NULL DEFAULT 'development',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT ALL ON public.landing_pages TO service_role;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage landing pages" ON public.landing_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Clients view own landing pages" ON public.landing_pages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid()));
CREATE TRIGGER landing_pages_updated_at BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_landing_pages_client ON public.landing_pages(client_id);

-- DIGITAL ASSETS
CREATE TABLE public.client_digital_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  label text,
  identifier text,
  url text,
  provider text,
  status text NOT NULL DEFAULT 'active',
  expires_at date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_digital_assets TO authenticated;
GRANT ALL ON public.client_digital_assets TO service_role;
ALTER TABLE public.client_digital_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage digital assets" ON public.client_digital_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE TRIGGER client_digital_assets_updated_at BEFORE UPDATE ON public.client_digital_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_client_digital_assets_client ON public.client_digital_assets(client_id);