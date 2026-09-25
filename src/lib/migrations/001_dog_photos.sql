CREATE TABLE dog_photos (
  id uuid NOT NULL UNIQUE,
  club_id text NOT NULL,
  dog_id uuid NOT NULL,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 1572864),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1200),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1200),
  PRIMARY KEY (club_id, dog_id),
  FOREIGN KEY (club_id, dog_id) REFERENCES dogs(club_id, id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, DELETE ON dog_photos TO club_app;
ALTER TABLE dog_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dog_photos FORCE ROW LEVEL SECURITY;
-- The dog policy already checks current membership, role and audience, including public-only contexts.
CREATE POLICY photo_read ON dog_photos FOR SELECT TO club_app USING (
  club_id=current_setting('app.club_id',true)
  AND EXISTS (SELECT 1 FROM dogs d WHERE d.club_id=dog_photos.club_id AND d.id=dog_photos.dog_id)
);
CREATE POLICY photo_insert ON dog_photos FOR INSERT TO club_app WITH CHECK (
  club_id=current_setting('app.club_id',true)
  AND current_setting('app.public',true)='false'
  AND EXISTS (SELECT 1 FROM dogs d WHERE d.club_id=dog_photos.club_id AND d.id=dog_photos.dog_id AND d.owner_id=current_setting('app.account_id',true))
);
CREATE POLICY photo_delete ON dog_photos FOR DELETE TO club_app USING (
  club_id=current_setting('app.club_id',true)
  AND current_setting('app.public',true)='false'
  AND EXISTS (SELECT 1 FROM dogs d WHERE d.club_id=dog_photos.club_id AND d.id=dog_photos.dog_id AND d.owner_id=current_setting('app.account_id',true))
);
