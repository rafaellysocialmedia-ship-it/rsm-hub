-- Add multi social networks to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS social_networks text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill from legacy single column
UPDATE public.posts
SET social_networks = ARRAY[social_network]::text[]
WHERE (social_networks IS NULL OR array_length(social_networks,1) IS NULL)
  AND social_network IS NOT NULL AND social_network <> '';

-- Keep legacy social_network in sync with first element via trigger (for backward compat)
CREATE OR REPLACE FUNCTION public.sync_post_social_network()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.social_networks IS NOT NULL AND array_length(NEW.social_networks,1) > 0 THEN
    NEW.social_network := NEW.social_networks[1];
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_post_social_network ON public.posts;
CREATE TRIGGER trg_sync_post_social_network
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_social_network();