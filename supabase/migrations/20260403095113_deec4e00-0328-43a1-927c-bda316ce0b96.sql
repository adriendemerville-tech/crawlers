-- Add proactive_scan to diagnostic_source_type enum
ALTER TYPE public.diagnostic_source_type ADD VALUE IF NOT EXISTS 'proactive_scan';