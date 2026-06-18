-- Links existing employees to their internet username/password.
-- Smart matching: exact name, partial name (2-part vs 3-part), or collapsed spaces.

INSERT INTO internet_users (emp_id, name, dept, network_label, username, password, device_id, notes, updated_at)
SELECT u.emp_id, u.name, u.dept, d.network_label, d.username, d.password, d.device_id, d.notes, now()
FROM device_usernames d
JOIN users u ON (
  -- exact match
  regexp_replace(trim(u.name), '\s+', ' ', 'g') = regexp_replace(trim(d.device_id), '\s+', ' ', 'g')
  -- device_id is first 2 words of user name (ثنائي)
  OR regexp_replace(trim(d.device_id), '\s+', ' ', 'g') =
     (split_part(regexp_replace(trim(u.name), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(trim(u.name), '\s+', ' ', 'g'), ' ', 2))
  -- user name is first 2 words of device_id
  OR regexp_replace(trim(u.name), '\s+', ' ', 'g') =
     (split_part(regexp_replace(trim(d.device_id), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(trim(d.device_id), '\s+', ' ', 'g'), ' ', 2))
  -- collapsed spaces match
  OR replace(trim(u.name), ' ', '') = replace(trim(d.device_id), ' ', '')
)
WHERE d.device_id NOT LIKE 'احتياطي%'
AND NOT EXISTS (
  SELECT 1 FROM internet_users iu
  WHERE iu.emp_id = u.emp_id AND iu.username = d.username AND iu.network_label = d.network_label
);
