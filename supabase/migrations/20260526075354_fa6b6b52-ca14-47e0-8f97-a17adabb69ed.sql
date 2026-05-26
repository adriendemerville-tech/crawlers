REVOKE EXECUTE ON FUNCTION public.parmenion_verify_pull_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parmenion_rotate_pull_token(uuid) FROM PUBLIC, anon;
-- authenticated keeps execute on rotate (admin check is inside the function)
GRANT EXECUTE ON FUNCTION public.parmenion_rotate_pull_token(uuid) TO authenticated;