-- Profile creation trigger for Octoroom
-- Auto-creates octo_profiles entry when a user signs up

-- First, allow inserts on octo_profiles via trigger (service role)
CREATE POLICY "profiles_insert_trigger" ON octo_profiles
  FOR INSERT WITH CHECK (true);

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_octo_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.octo_profiles (id, role, company, display_name)
  VALUES (
    new.id,
    COALESCE((new.raw_user_meta_data ->> 'role')::user_role_enum, 'vendor'),
    COALESCE(new.raw_user_meta_data ->> 'company', 'Unknown'),
    COALESCE(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_octo ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created_octo
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_octo_user();
