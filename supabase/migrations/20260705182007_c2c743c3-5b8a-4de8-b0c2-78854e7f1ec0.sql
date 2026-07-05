
CREATE OR REPLACE FUNCTION public.notify_client_on_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client RECORD;
BEGIN
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, name, user_id INTO _client FROM public.clients WHERE id = NEW.client_id;
  IF _client.user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    _client.user_id,
    'Novo arquivo disponível: ' || NEW.name,
    COALESCE(NEW.description, 'Um novo documento foi adicionado à sua biblioteca.'),
    '/library'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_client_on_file ON public.files;
CREATE TRIGGER trg_notify_client_on_file
AFTER INSERT ON public.files
FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_file();
