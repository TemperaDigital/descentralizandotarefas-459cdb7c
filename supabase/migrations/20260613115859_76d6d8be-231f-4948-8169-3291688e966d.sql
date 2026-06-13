-- Remove allowlist restriction: allow any user to sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.shortcuts (user_id, nome, url, icone, ordem) VALUES
    (NEW.id, 'SPED', 'http://sped3.1gpte.eb.mil.br/#/login', 'FileText', 1),
    (NEW.id, 'SISBOL', 'http://10.45.17.242/band/', 'BookOpen', 2),
    (NEW.id, 'Webmail', 'https://1gpte.webmail.eb.mil.br/', 'Mail', 3);

  RETURN NEW;
END;
$function$;