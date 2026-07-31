// linkedin-scenario-builder — génère AUTOMATIQUEMENT le scénario déterministe
// (steps Pagebolt) filmé pour un post LinkedIn.
//
// Pipeline (économe en tokens : 1 seul appel LLM court, mis en cache 14 jours) :
//   1. `capture_scenario` manuel dans le catalogue (source='manual') → renvoyé tel quel.
//   2. Cache : scénario auto/llm de moins de 14 jours → réutilisé (0 token, 0 requête Pagebolt).
//   3. Pagebolt /v1/inspect → sélecteurs RÉELS de la route (aucune invention possible).
//   4. LLM : ordonne un parcours narratif (arrivée → action → résultat) en ne choisissant
//      QUE parmi les sélecteurs inspectés, et en suivant le sujet du post.
//   5. Repli déterministe (scoring par mots-clés) si le LLM échoue.
//   6. Sanitize (20 étapes / 5 outputs max) + persistance dans linkedin_features_catalog.
//
// Appelée par linkedin-media-generator (service role) et par l'admin.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { callRoutedAI } from '../_shared/aiRouter.ts';
import {
  sanitizeScenario,
  inspectRoute,
  buildScenarioFromInspection,
  fallbackScenario,
  MAX_STEPS,
  MAX_OUTPUTS,
  type ScenarioStep,
  type InspectedElement,
} from '../_shared/pageboltScenario.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const PAGEBOLT_API_KEY = Deno.env.get('PAGEBOLT_API_KEY');
const CRON_SECRET = Deno.env.get('LINKEDIN_CRON_SECRET');

const CACHE_TTL_DAYS = 14;
const MAX_ELEMENTS_FOR_LLM = 60;

const BodySchema = z.object({
  feature_id: z.string().uuid().optional(),
  feature_slug: z.string().max(120).optional(),
  /** Sujet du post (titre + angle) : oriente le choix des écrans filmés. */
  subject: z.string().max(600).optional(),
  max_shots: z.number().int().min(1).max(MAX_OUTPUTS).default(4),
  force_regenerate: z.boolean().default(false),
  persist: z.boolean().default(true),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authHeader = req.headers.get('Authorization') ?? '';
    const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;
    const isInternal = authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`;

    if (!isCron && !isInternal) {
      if (!authHeader) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', {
        _user_id: userData.user.id,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Admin only' }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { feature_id, feature_slug, subject, max_shots, force_regenerate, persist } = parsed.data;
    if (!feature_id && !feature_slug) return json({ error: 'feature_id or feature_slug required' }, 400);

    let q = admin
      .from('linkedin_features_catalog')
      .select('id, slug, title, marketing_angle, short_description, capture_route, capture_steps, capture_scenario, capture_scenario_source, capture_scenario_updated_at');
    q = feature_id ? q.eq('id', feature_id) : q.eq('slug', feature_slug!);
    const { data: feature, error: fErr } = await q.maybeSingle();
    if (fErr || !feature) return json({ error: 'Feature not found' }, 404);

    const route = String(feature.capture_route ?? '');
    if (!route.startsWith('https://')) return json({ error: 'Feature has no https capture_route' }, 400);

    const topic = subject?.trim() ||
      `${feature.title ?? ''} ${feature.marketing_angle ?? feature.short_description ?? ''}`.trim();

    // 1. Scénario écrit à la main : autorité absolue.
    if (feature.capture_scenario_source === 'manual' && Array.isArray(feature.capture_scenario) && feature.capture_scenario.length) {
      return json({
        success: true, source: 'manual', cached: true,
        scenario: sanitizeScenario(feature.capture_scenario, route),
      });
    }

    // 2. Cache : évite une inspection Pagebolt et un appel LLM par post.
    if (!force_regenerate && Array.isArray(feature.capture_scenario) && feature.capture_scenario.length) {
      const updated = feature.capture_scenario_updated_at ? Date.parse(feature.capture_scenario_updated_at) : 0;
      const fresh = updated > Date.now() - CACHE_TTL_DAYS * 86_400_000;
      if (fresh) {
        return json({
          success: true, source: feature.capture_scenario_source ?? 'auto', cached: true,
          scenario: sanitizeScenario(feature.capture_scenario, route),
        });
      }
    }

    // 3. Inspection : la seule source de vérité pour les sélecteurs.
    let elements: InspectedElement[] = [];
    if (PAGEBOLT_API_KEY) {
      try {
        elements = await inspectRoute(PAGEBOLT_API_KEY, route, await buildAuthState(admin));
      } catch (e) {
        console.warn('[linkedin-scenario-builder] inspect KO', String(e));
      }
    }

    let scenario: ScenarioStep[] | null = null;
    let source = 'fallback';

    if (elements.length) {
      // 4. LLM : ordonne le parcours, contraint aux sélecteurs inspectés.
      try {
        scenario = await buildScenarioWithLLM(topic, route, elements, max_shots, feature.capture_steps);
        if (scenario && scenario.length >= 3) source = 'llm';
        else scenario = null;
      } catch (e) {
        console.warn('[linkedin-scenario-builder] LLM KO', String(e));
      }
      // 5. Repli déterministe sur l'inspection.
      if (!scenario) {
        scenario = buildScenarioFromInspection(route, topic, elements, max_shots);
        source = 'auto';
      }
    }
    if (!scenario) scenario = sanitizeScenario(fallbackScenario(route), route);

    if (persist) {
      await admin
        .from('linkedin_features_catalog')
        .update({
          capture_scenario: scenario,
          capture_scenario_source: source,
          capture_scenario_updated_at: new Date().toISOString(),
        })
        .eq('id', feature.id);
    }

    console.log('[linkedin-scenario-builder]', feature.slug, source, scenario.length, 'étapes');
    return json({ success: true, source, cached: false, scenario, inspected_elements: elements.length });
  } catch (e) {
    console.error('[linkedin-scenario-builder] fatal', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

/** Session de démo injectée dans le navigateur Pagebolt (outil connecté). */
async function buildAuthState(admin: ReturnType<typeof createClient>): Promise<Record<string, unknown> | null> {
  const email = Deno.env.get('PAGEBOLT_DEMO_EMAIL');
  if (!email) return null;
  try {
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hashed = (link as any)?.properties?.hashed_token;
    if (error || !hashed) throw error ?? new Error('no hashed_token');
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: verified, error: vErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: hashed });
    if (vErr || !verified?.session) throw vErr ?? new Error('no session');
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    return {
      localStorage: [{
        origin: 'https://crawlers.fr',
        items: [{ name: `sb-${ref}-auth-token`, value: JSON.stringify(verified.session) }],
      }],
    };
  } catch (e) {
    console.warn('[linkedin-scenario-builder] session démo indisponible', String(e));
    return null;
  }
}

/**
 * Appel LLM unique et court : on n'envoie qu'une liste compacte de sélecteurs
 * cliquables (60 max, textes tronqués) → quelques centaines de tokens.
 */
async function buildScenarioWithLLM(
  topic: string,
  route: string,
  elements: InspectedElement[],
  maxShots: number,
  narrativeSteps: unknown,
): Promise<ScenarioStep[] | null> {
  const candidates = elements
    .filter((e) => e.selector && String(e.text ?? '').trim().length > 1)
    .slice(0, MAX_ELEMENTS_FOR_LLM)
    .map((e, i) => ({
      i,
      sel: e.selector!,
      role: e.role ?? e.tag ?? '',
      txt: String(e.text ?? '').replace(/\s+/g, ' ').slice(0, 60),
    }));
  if (candidates.length === 0) return null;
  const allowed = new Set(candidates.map((c) => c.sel));

  const narrative = Array.isArray(narrativeSteps) ? narrativeSteps.map(String).join(' / ') : '';

  const system = [
    'Tu conçois un scénario de capture navigateur (Pagebolt) pour un screencast LinkedIn B2B SaaS.',
    'Tu ne peux utiliser QUE les sélecteurs fournis. Aucune invention de sélecteur.',
    `Actions autorisées: wait_for, click, hover, scroll, wait, screenshot. Maximum ${MAX_STEPS - 1} étapes et ${maxShots} screenshots.`,
    'Structure attendue: arrivée sur l\'écran, puis 2 à 4 interactions qui montrent la valeur réelle de l\'outil, un screenshot après chaque interaction aboutie.',
    'Chaque click doit être suivi d\'un wait (1500-2500 ms) puis d\'un screenshot.',
    'Réponds UNIQUEMENT en JSON: {"steps":[{"action":"...","selector":"...","ms":0,"name":"...","note":"..."}]}',
  ].join('\n');

  const user = [
    `Sujet du post: ${topic}`,
    narrative ? `Parcours souhaité (langage naturel): ${narrative}` : '',
    `URL: ${route}`,
    'Éléments cliquables disponibles (sel = sélecteur CSS exact):',
    JSON.stringify(candidates),
  ].filter(Boolean).join('\n');

  const { content } = await callRoutedAI('linkedin_scenario', {
    system,
    user,
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 900,
    fallbackModel: 'google/gemini-3-flash-preview',
    timeoutMs: 45_000,
  });

  let raw: unknown;
  try {
    raw = JSON.parse(content).steps;
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    raw = JSON.parse(m[0]).steps;
  }
  if (!Array.isArray(raw)) return null;

  // Garde-fou : tout sélecteur hors inspection est écarté (anti-hallucination).
  const filtered = (raw as Record<string, unknown>[]).filter((s) => {
    const sel = s?.selector ? String(s.selector) : '';
    if (!sel) return true;
    return allowed.has(sel);
  });

  const steps = sanitizeScenario([{ action: 'navigate', url: route }, ...filtered], route);
  return steps.some((s) => s.action === 'screenshot') ? steps : null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
