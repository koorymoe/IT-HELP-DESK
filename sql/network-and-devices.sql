-- Run this once in the Supabase SQL Editor.

-- 1) Network code per department (set manually by admin from "إدارة الأقسام")
ALTER TABLE departments ADD COLUMN IF NOT EXISTS network_label text;

-- 2) Device-number -> username mapping (per network), used for auto-matching
CREATE TABLE IF NOT EXISTS device_usernames (
  id uuid primary key default gen_random_uuid(),
  network_label text not null,
  device_id text not null,
  username text not null,
  created_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS device_usernames_device_id_idx ON device_usernames (device_id);

ALTER TABLE device_usernames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON device_usernames;
CREATE POLICY "allow all" ON device_usernames FOR ALL USING (true) WITH CHECK (true);
