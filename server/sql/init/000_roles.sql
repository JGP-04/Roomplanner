-- Local-development roles only. Production credentials must come from the
-- platform secret manager and use different random passwords.
CREATE ROLE roomplannr_app LOGIN PASSWORD 'roomplannr_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
