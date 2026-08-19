// Lancement d'un job Marina sous la clé API interne du compte technique admin.
// Utilisé par les parcours sans compte (essai gratuit et audit payé à l'unité) :
// aucun crédit utilisateur n'est débité.

type LaunchOk = { job_id: string; status: string; queue_position: number | null };
type LaunchErr = { error: 'launch_failed'; message: string };

export async function launchMarinaJob(
  supabaseAdmin: any,
  targetUrl: string,
  lang: string,
): Promise<LaunchOk | LaunchErr> {
  const { data: adminRole } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();
  const adminUserId = adminRole?.user_id;
  if (!adminUserId) {
    console.error('[MarinaLaunch] no admin account available to host guest runs');
    return { error: 'launch_failed', message: 'Service momentanément indisponible' };
  }

  const { data: keyRow } = await supabaseAdmin
    .from('marina_api_keys')
    .select('api_key')
    .eq('user_id', adminUserId)
    .maybeSingle();
  let internalKey: string | undefined = keyRow?.api_key;
  if (!internalKey) {
    internalKey = `mk_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
    const { error: keyErr } = await supabaseAdmin
      .from('marina_api_keys')
      .upsert({ user_id: adminUserId, api_key: internalKey }, { onConflict: 'user_id' });
    if (keyErr) {
      console.error('[MarinaLaunch] cannot provision internal key', keyErr);
      return { error: 'launch_failed', message: 'Service momentanément indisponible' };
    }
  }

  const publishableKey = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const supabaseUrl = process.env['SUPABASE_URL']!;
  const launchRes = await fetch(`${supabaseUrl}/functions/v1/marina`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publishableKey}`,
      apikey: publishableKey,
      'x-marina-key': internalKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: targetUrl, lang }),
  });
  const launch = (await launchRes.json().catch(() => ({}))) as {
    job_id?: string;
    status?: string;
    queue_position?: number;
    error?: string;
  };
  if (!launchRes.ok || launch.error || !launch.job_id) {
    console.error('[MarinaLaunch] launch failed', launchRes.status, launch);
    return { error: 'launch_failed', message: launch.error || 'Lancement impossible' };
  }
  return {
    job_id: launch.job_id,
    status: launch.status || 'pending',
    queue_position: launch.queue_position ?? null,
  };
}
