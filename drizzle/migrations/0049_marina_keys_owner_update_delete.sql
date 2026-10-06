GRANT UPDATE (is_active) ON public.marina_api_keys TO authenticated;
GRANT DELETE ON public.marina_api_keys TO authenticated;
CREATE POLICY "Users can toggle own marina keys" ON public.marina_api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own marina keys" ON public.marina_api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);