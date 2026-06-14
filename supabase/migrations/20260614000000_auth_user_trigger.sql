-- =============================================================
-- Auto-create public.users row when a Supabase auth user
-- confirms their email (INSERT on auth.users).
--
-- The trigger fires AFTER INSERT so auth.users.id is available.
-- user_metadata is populated by RegisterForm.tsx signUp options.data
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email     = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      phone     = COALESCE(EXCLUDED.phone,     public.users.phone),
      role      = COALESCE(EXCLUDED.role,      public.users.role);

  RETURN NEW;
END;
$$;

-- Drop if it already exists from a prior attempt, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
