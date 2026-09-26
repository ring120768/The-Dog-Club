ALTER TABLE mobile_sessions ADD COLUMN id uuid;
ALTER TABLE mobile_sessions ADD COLUMN device_name text;

UPDATE mobile_sessions
SET id=gen_random_uuid(),
    device_name=CASE platform
      WHEN 'ios' THEN 'Apple device'
      WHEN 'android' THEN 'Android device'
      ELSE 'Browser preview'
    END
WHERE id IS NULL;

ALTER TABLE mobile_sessions ALTER COLUMN id SET NOT NULL;
ALTER TABLE mobile_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE mobile_sessions ALTER COLUMN device_name SET NOT NULL;
ALTER TABLE mobile_sessions ADD CONSTRAINT mobile_sessions_id_unique UNIQUE(id);
ALTER TABLE mobile_sessions ADD CONSTRAINT mobile_sessions_device_name_length
  CHECK (char_length(device_name) BETWEEN 1 AND 80);
