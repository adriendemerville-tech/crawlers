-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create blog_articles table with status
CREATE TYPE public.article_status AS ENUM ('draft', 'published', 'unpublished', 'archived', 'deleted');

CREATE TABLE public.blog_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    content text,
    excerpt text,
    image_url text,
    author_id uuid REFERENCES auth.users(id),
    status article_status NOT NULL DEFAULT 'draft',
    published_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published articles are public"
ON public.blog_articles FOR SELECT
USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage articles"
ON public.blog_articles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create support_conversations table
CREATE TABLE public.support_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject text,
    status text NOT NULL DEFAULT 'open',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
ON public.support_conversations FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create conversations"
ON public.support_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all conversations"
ON public.support_conversations FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Create support_messages table
CREATE TABLE public.support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.support_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    is_admin boolean NOT NULL DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
ON public.support_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.support_conversations sc
        WHERE sc.id = conversation_id
        AND (sc.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

CREATE POLICY "Users can send messages"
ON public.support_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.support_conversations sc
        WHERE sc.id = conversation_id
        AND (sc.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

-- 7. Create analytics_events table for tracking
CREATE TABLE public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}',
    user_id uuid,
    session_id text,
    url text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics"
ON public.analytics_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert analytics"
ON public.analytics_events FOR INSERT
WITH CHECK (true);

-- 8. Create admin_dashboard_config for draggable cards
CREATE TABLE public.admin_dashboard_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    card_order jsonb NOT NULL DEFAULT '[]',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

ALTER TABLE public.admin_dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their dashboard config"
ON public.admin_dashboard_config FOR ALL
USING (auth.uid() = user_id);

-- 9. Add triggers for updated_at
CREATE TRIGGER update_blog_articles_updated_at
BEFORE UPDATE ON public.blog_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_dashboard_config_updated_at
BEFORE UPDATE ON public.admin_dashboard_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Insert first admin role for adriendemerville@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'adriendemerville@gmail.com'
ON CONFLICT DO NOTHING;