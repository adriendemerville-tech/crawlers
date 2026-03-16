CREATE POLICY "Users can update their own cocoon recommendations"
  ON public.cocoon_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);