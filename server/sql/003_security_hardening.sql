-- Defense in depth for tenant data. The application sets app.user_id inside
-- each transaction; without it, every policy below denies access.
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS encrypted_payload bytea,
  ADD COLUMN IF NOT EXISTS encryption_key_version smallint;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_instances ENABLE ROW LEVEL SECURITY;

-- FORCE also subjects the table owner to RLS. Authentication tables are
-- reached only through narrowly granted SECURITY DEFINER functions below.
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE catalog_items FORCE ROW LEVEL SECURITY;
ALTER TABLE object_instances FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self ON users;
CREATE POLICY users_self ON users
  USING (id = app_current_user_id())
  WITH CHECK (id = app_current_user_id());

DROP POLICY IF EXISTS sessions_self ON sessions;
CREATE POLICY sessions_self ON sessions
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

DROP POLICY IF EXISTS projects_owner ON projects;
CREATE POLICY projects_owner ON projects
  USING (owner_id = app_current_user_id())
  WITH CHECK (owner_id = app_current_user_id());

DROP POLICY IF EXISTS catalog_items_owner ON catalog_items;
CREATE POLICY catalog_items_owner ON catalog_items
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = catalog_items.project_id
        AND projects.owner_id = app_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = catalog_items.project_id
        AND projects.owner_id = app_current_user_id()
    )
  );

DROP POLICY IF EXISTS object_instances_owner ON object_instances;
CREATE POLICY object_instances_owner ON object_instances
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = object_instances.project_id
        AND projects.owner_id = app_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = object_instances.project_id
        AND projects.owner_id = app_current_user_id()
    )
  );

-- Auth functions are the only runtime entry points to users/sessions. Their
-- fixed search_path prevents object-shadowing attacks against definer rights.
CREATE OR REPLACE FUNCTION app_register_user(p_email text, p_password_hash text)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.users (email, password_hash)
  VALUES (lower(p_email), p_password_hash)
  RETURNING users.id, users.email
$$;

CREATE OR REPLACE FUNCTION app_find_user_for_login(p_email text)
RETURNS TABLE(id uuid, email text, password_hash text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT users.id, users.email, users.password_hash
  FROM public.users
  WHERE users.email = lower(p_email)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app_create_session(
  p_user_id uuid,
  p_token_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.sessions WHERE expires_at <= now();
  INSERT INTO public.sessions (token_hash, user_id, expires_at)
  VALUES (p_token_hash, p_user_id, now() + interval '7 days');
  DELETE FROM public.sessions
  WHERE user_id = p_user_id
    AND token_hash <> p_token_hash
    AND token_hash IN (
      SELECT token_hash FROM public.sessions
      WHERE user_id = p_user_id AND token_hash <> p_token_hash
      ORDER BY created_at DESC, token_hash DESC OFFSET 9
    );
END
$$;

CREATE OR REPLACE FUNCTION app_get_session_user(p_token_hash text)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT users.id, users.email
  FROM public.sessions
  JOIN public.users ON users.id = sessions.user_id
  WHERE sessions.token_hash = p_token_hash
    AND sessions.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app_delete_session(p_token_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  DELETE FROM public.sessions WHERE token_hash = p_token_hash
$$;

REVOKE ALL ON FUNCTION app_register_user(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_find_user_for_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_create_session(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_get_session_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_delete_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_current_user_id() FROM PUBLIC;

REVOKE ALL ON users, sessions, projects, catalog_items, object_instances FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
