CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _post RECORD;
  _client RECORD;
  _author_is_staff BOOLEAN;
  _author_name TEXT;
  _target RECORD;
  _comment_hash TEXT;
BEGIN
  SELECT * INTO _post FROM public.posts WHERE id = NEW.post_id;
  IF _post.client_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _client FROM public.clients WHERE id = _post.client_id;

  _author_is_staff := public.has_role(NEW.author_id,'administrator') OR public.has_role(NEW.author_id,'team');
  SELECT COALESCE(name, email) INTO _author_name FROM public.profiles WHERE id = NEW.author_id;
  _comment_hash := '&comment=' || NEW.id::text || '#comments';

  INSERT INTO public.post_activity_log (post_id, client_id, actor_id, action, detail)
  VALUES (NEW.post_id, _post.client_id, NEW.author_id, 'commented', LEFT(NEW.content, 280));

  IF _author_is_staff THEN
    IF _client.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_client.user_id,
              COALESCE(_author_name,'Equipe') || ' comentou em "' || COALESCE(_post.title,'publicação') || '"',
              LEFT(NEW.content, 200),
              '/portal?open=' || NEW.post_id::text || _comment_hash);
    END IF;
  ELSE
    FOR _target IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('administrator','team')
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_target.user_id,
              COALESCE(_client.name,'Cliente') || ' comentou em "' || COALESCE(_post.title,'publicação') || '"',
              LEFT(NEW.content, 200),
              '/posts?open=' || NEW.post_id::text || _comment_hash);
    END LOOP;
  END IF;

  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.notify_on_comment() FROM anon, authenticated;