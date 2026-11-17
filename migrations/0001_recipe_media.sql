-- Recipe photo and how-to video links. image_url already exists in production;
-- IF NOT EXISTS keeps this safe on fresh databases too.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS video_url text;
