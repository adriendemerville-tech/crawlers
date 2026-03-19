ALTER TABLE tracked_sites ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'business';
ALTER TABLE tracked_sites ADD COLUMN IF NOT EXISTS media_specialties text[] DEFAULT '{}';