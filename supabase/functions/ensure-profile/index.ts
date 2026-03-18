import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Use user client to verify identity
    const anonClient = getUserClient(authHeader);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.error('Error getting user:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const user = userData.user;
    console.log(`Checking profile for user: ${user.id}`);

    // Use service_role client for DB operations to bypass RLS
    const supabase = getServiceClient();

    // Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileCheckError) {
      console.error('Error checking profile:', profileCheckError);
      return new Response(JSON.stringify({ error: 'Error checking profile' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (existingProfile) {
      console.log('Profile already exists');
      return new Response(JSON.stringify({ success: true, exists: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create profile
    const metadata = user.user_metadata || {};
    let firstName = metadata.first_name || metadata.given_name || '';
    let lastName = metadata.last_name || metadata.family_name || '';

    if (!firstName && (metadata.full_name || metadata.name)) {
      const fullName = metadata.full_name || metadata.name || '';
      const nameParts = fullName.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    if (!firstName) {
      firstName = (user.email?.split('@')[0] || 'User').charAt(0).toUpperCase() + 
                  (user.email?.split('@')[0] || 'user').slice(1);
    }

    console.log(`Creating profile for ${firstName} ${lastName} (${user.email})`);

    const personaType = metadata.persona_type || null;

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName || '',
        email: user.email || '',
        avatar_url: metadata.avatar_url || metadata.picture || null,
        ...(personaType ? { persona_type: personaType } : {}),
      });

    if (insertError) {
      console.error('Error creating profile:', insertError);
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ success: true, exists: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Error creating profile' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Profile created successfully');
    return new Response(JSON.stringify({ success: true, created: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ensure-profile function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
