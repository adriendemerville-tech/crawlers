-- Fix: Tighten RLS on cocoon_chat_histories to enforce ownership via tracked_sites

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can insert chat histories" ON public.cocoon_chat_histories;
DROP POLICY IF EXISTS "Users can update chat histories" ON public.cocoon_chat_histories;
DROP POLICY IF EXISTS "Users can select chat histories" ON public.cocoon_chat_histories;
DROP POLICY IF EXISTS "Users can delete chat histories" ON public.cocoon_chat_histories;

-- SELECT: user owns the tracked_site, or is admin
CREATE POLICY "Owner can select chat histories"
ON public.cocoon_chat_histories FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tracked_sites
    WHERE id = cocoon_chat_histories.tracked_site_id::uuid
      AND user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- INSERT: user must own the tracked_site
CREATE POLICY "Owner can insert chat histories"
ON public.cocoon_chat_histories FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tracked_sites
    WHERE id = cocoon_chat_histories.tracked_site_id::uuid
      AND user_id = auth.uid()
  )
);

-- UPDATE: user must own the tracked_site
CREATE POLICY "Owner can update chat histories"
ON public.cocoon_chat_histories FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tracked_sites
    WHERE id = cocoon_chat_histories.tracked_site_id::uuid
      AND user_id = auth.uid()
  )
);

-- DELETE: user must own the tracked_site, or is admin
CREATE POLICY "Owner can delete chat histories"
ON public.cocoon_chat_histories FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tracked_sites
    WHERE id = cocoon_chat_histories.tracked_site_id::uuid
      AND user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);