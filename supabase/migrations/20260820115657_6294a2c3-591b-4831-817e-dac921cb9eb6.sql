ALTER TYPE public.landing_page_status ADD VALUE IF NOT EXISTS 'planning';
ALTER TYPE public.landing_page_status ADD VALUE IF NOT EXISTS 'ended';

ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS edit_url text,
  ADD COLUMN IF NOT EXISTS visible_to_client boolean NOT NULL DEFAULT false;

ALTER TABLE public.client_digital_assets
  ADD COLUMN IF NOT EXISTS visible_to_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.traffic_campaigns
  ADD COLUMN IF NOT EXISTS landing_page_id uuid REFERENCES public.landing_pages(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_digital_asset_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
    VALUES (NEW.client_id, 'asset_added', 'Ativo digital adicionado',
            coalesce(NEW.label, NEW.asset_type), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF coalesce(NEW.status,'') <> coalesce(OLD.status,'') THEN
      INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
      VALUES (NEW.client_id, 'asset_updated', 'Ativo digital atualizado',
              coalesce(NEW.label, NEW.asset_type) || ': ' || coalesce(OLD.status,'—') || ' → ' || coalesce(NEW.status,'—'),
              auth.uid());
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
    VALUES (OLD.client_id, 'asset_removed', 'Ativo digital removido',
            coalesce(OLD.label, OLD.asset_type), auth.uid());
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_digital_asset_change() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_digital_asset_change ON public.client_digital_assets;
CREATE TRIGGER trg_log_digital_asset_change
AFTER INSERT OR UPDATE OR DELETE ON public.client_digital_assets
FOR EACH ROW EXECUTE FUNCTION public.log_digital_asset_change();

CREATE OR REPLACE FUNCTION public.log_landing_page_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
    VALUES (NEW.client_id, 'lp_created', 'Landing Page criada', NEW.name, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status <> OLD.status THEN
      INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
      VALUES (NEW.client_id, 'lp_status_changed', 'Status da Landing Page alterado',
              NEW.name || ': ' || OLD.status::text || ' → ' || NEW.status::text, auth.uid());
    END IF;
    IF coalesce(NEW.owner_id::text,'') <> coalesce(OLD.owner_id::text,'') THEN
      INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
      VALUES (NEW.client_id, 'lp_owner_changed', 'Responsável da Landing Page alterado', NEW.name, auth.uid());
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.client_timeline (client_id, event_type, title, detail, actor_id)
    VALUES (OLD.client_id, 'lp_removed', 'Landing Page removida', OLD.name, auth.uid());
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_landing_page_change() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_landing_page_change ON public.landing_pages;
CREATE TRIGGER trg_log_landing_page_change
AFTER INSERT OR UPDATE OR DELETE ON public.landing_pages
FOR EACH ROW EXECUTE FUNCTION public.log_landing_page_change();