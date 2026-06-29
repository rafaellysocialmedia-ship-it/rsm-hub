
-- Promote current sole user to administrator
UPDATE public.user_roles SET role = 'administrator'
WHERE user_id = '957e2e55-69ed-4e12-bcc0-529ea83380a5';

-- Update handle_new_user so the very first user becomes administrator,
-- and subsequent signups default to client.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_first boolean;
  _assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url, cargo, phone, company)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'cargo',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'company'
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;
  _assigned_role := CASE WHEN _is_first THEN 'administrator'::public.app_role
                         ELSE 'client'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _assigned_role);

  RETURN NEW;
END;
$function$;
