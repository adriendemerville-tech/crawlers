-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Create billing_info table (backend only, prepared for future)
CREATE TABLE public.billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  billing_address TEXT,
  billing_city TEXT,
  billing_postal_code TEXT,
  billing_country TEXT,
  vat_number TEXT,
  company_name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on billing_info
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;

-- Create policies for billing_info
CREATE POLICY "Users can view their own billing info"
ON public.billing_info FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own billing info"
ON public.billing_info FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing info"
ON public.billing_info FOR UPDATE
USING (auth.uid() = user_id);

-- Create report_folders table (supports nested folders)
CREATE TABLE public.report_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.report_folders(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on report_folders
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for report_folders
CREATE POLICY "Users can view their own folders"
ON public.report_folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
ON public.report_folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
ON public.report_folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
ON public.report_folders FOR DELETE
USING (auth.uid() = user_id);

-- Create report_type enum
CREATE TYPE public.report_type AS ENUM ('seo_technical', 'seo_strategic', 'llm', 'geo', 'pagespeed', 'crawlers');

-- Create saved_reports table
CREATE TABLE public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES public.report_folders(id) ON DELETE SET NULL,
  report_type report_type NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  report_data JSONB NOT NULL,
  pdf_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on saved_reports
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_reports
CREATE POLICY "Users can view their own reports"
ON public.saved_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports"
ON public.saved_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
ON public.saved_reports FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
ON public.saved_reports FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_info_updated_at
BEFORE UPDATE ON public.billing_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_report_folders_updated_at
BEFORE UPDATE ON public.report_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_reports_updated_at
BEFORE UPDATE ON public.saved_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for report PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-reports', 'user-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for user-reports bucket
CREATE POLICY "Users can view their own report files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own report files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own report files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-reports' AND auth.uid()::text = (storage.foldername(name))[1]);