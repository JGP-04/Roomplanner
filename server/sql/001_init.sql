CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(100) NOT NULL,
  room jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_owner_updated_idx
  ON projects(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  kind varchar(12) NOT NULL CHECK (kind IN ('box', 'table', 'shelf')),
  width double precision NOT NULL CHECK (width > 0),
  depth double precision NOT NULL CHECK (depth > 0),
  height double precision NOT NULL CHECK (height > 0),
  color char(7) NOT NULL,
  UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS catalog_items_project_idx ON catalog_items(project_id);

CREATE TABLE IF NOT EXISTS object_instances (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL,
  position jsonb NOT NULL,
  rotation_y double precision NOT NULL DEFAULT 0,
  scale jsonb NOT NULL,
  FOREIGN KEY (catalog_item_id, project_id) REFERENCES catalog_items(id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS object_instances_project_idx ON object_instances(project_id);
