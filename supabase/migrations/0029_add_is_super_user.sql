ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_user boolean NOT NULL DEFAULT false;
-- Seed: existing admins become super users
UPDATE profiles SET is_super_user = true WHERE is_admin = true;
