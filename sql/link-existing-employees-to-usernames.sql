-- Run this once in the Supabase SQL Editor (after the HA-11/HA-12/A23 import scripts).
-- Links existing employees to their internet username/password by matching
-- their full name against the device_usernames "device_id" column.

INSERT INTO internet_users (emp_id, name, dept, network_label, username, password, device_id, notes, updated_at)
SELECT u.emp_id, u.name, u.dept, d.network_label, d.username, d.password, d.device_id, d.notes, now()
FROM device_usernames d
JOIN users u ON trim(u.name) = trim(d.device_id)
WHERE NOT EXISTS (
  SELECT 1 FROM internet_users iu
  WHERE iu.emp_id = u.emp_id AND iu.username = d.username AND iu.network_label = d.network_label
);
