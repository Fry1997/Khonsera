ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN profiles.is_admin IS 'Platform admin — access to system tools like rail network seeding.';
