CREATE OR REPLACE FUNCTION public.get_max_sessions(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 3 + COALESCE(
    (SELECT COUNT(*)::integer FROM agency_team_members 
     WHERE owner_user_id = p_user_id),
    0
  );
$function$;