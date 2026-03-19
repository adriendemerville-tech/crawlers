ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS agency_brand_font text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS agency_brand_font_size integer DEFAULT 16,
ADD COLUMN IF NOT EXISTS agency_brand_bold boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS agency_brand_italic boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS agency_brand_underline boolean DEFAULT false;