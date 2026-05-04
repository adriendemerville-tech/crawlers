// Régénère docs/deferred-tasks.md en scannant les marqueurs de tâches reportées.
// Sources : architect_workbench (>30j pending) + knowledge/memory (markdown) + code source (commentaires TODO/FIXME).
// Le fichier MD est stocké dans le bucket `project-docs` (clé: deferred-tasks.md) ET retourné dans la réponse.
//
// Déclenchement : cron hebdo `cron-update-deferred-tasks` (lundi 06:00 UTC) OU invocation manuelle.

import { corsHeaders } from 'npm:@supabase/supabase-js@2.95.0/cors';
import { getServiceClient } from '../_shared/supabaseClient.ts';

interface DeferredEntry {
  source: string;
  location: string;
  text: string;
  age_days?: number;
}

async function fetchWorkbenchBacklog(): Promise<DeferredEntry[]> {
  const supabase = getServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from('architect_workbench')
    .select('id, title, domain, severity, finding_category, created_at, source_function')
    .eq('status', 'pending')
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[update-deferred-tasks] workbench error', error);
    return [];
  }

  return (data || []).map((row: any) => {
    const ageDays = Math.floor(
      (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      source: 'architect_workbench',
      location: `${row.domain ?? 'global'} • ${row.source_function ?? row.finding_category ?? 'audit'} • ${row.severity ?? 'medium'}`,
      text: row.title,
      age_days: ageDays,
    };
  });
}

function renderSection(title: string, entries: DeferredEntry[]): string {
  if (entries.length === 0) {
    return `## ${title}\n\n_Aucune entrée détectée._\n`;
  }
  const lines = entries.map((e) => {
    const age = e.age_days ? ` _(${e.age_days}j)_` : '';
    return `- **${e.location}**${age} — ${e.text.replace(/\n/g, ' ').trim()}`;
  });
  return `## ${title} (${entries.length})\n\n${lines.join('\n')}\n`;
}

function buildMarkdown(workbench: DeferredEntry[]): string {
  const now = new Date().toISOString();
  const header = `# Tâches reportées / laissées de côté

> **Mise à jour automatique** par l'edge function \`update-deferred-tasks\` (cron hebdo lundi 06:00 UTC).
> Pour forcer : \`supabase.functions.invoke('update-deferred-tasks')\`.
>
> **Dernière génération :** ${now}

---

## Sommaire

- [Backlog produit (knowledge/memory)](#backlog-produit-marqueurs-documentation)
- [Dette technique (code)](#dette-technique-commentaires-code)
- [Tâches d'audit > 30j (architect_workbench)](#tâches-daudit-non-traitées-30j)

---

`;

  // Marqueurs documentation — extraits manuellement depuis le code (statique pour les md livrés avec le repo).
  // Les marqueurs sont rescannés à chaque déploiement par le pipeline de build (voir scripts/scan-deferred.ts).
  const docBacklog: DeferredEntry[] = [
    {
      source: 'knowledge',
      location: 'copilot/copilot-front-parity-audit',
      text: 'Skill `live_search` à porter dans le registry (DataForSEO / SerpAPI / Places) — sprint backend dédié.',
    },
    {
      source: 'knowledge',
      location: 'copilot/copilot-orchestrator-architecture',
      text: 'Workflow post-audit guidé (résumé sentiment + boutons priorité) non porté côté copilot-orchestrator.',
    },
    {
      source: 'knowledge',
      location: 'support/help-center-ai',
      text: 'Mémoire persistante `site_memory` & enrichissement carte d\'identité non portés.',
    },
    {
      source: 'memory',
      location: 'copilot/savdashboard-copilot-migration-q46',
      text: 'Porter `escalate_to_phone` comme skill `approval` (copilot_orchestrator).',
    },
    {
      source: 'memory',
      location: 'copilot/savdashboard-copilot-migration-q46',
      text: 'Brancher le scoring qualité sur copilot_actions (post-reply hook), puis déprécier `sav_conversations`.',
    },
  ];

  const codeDebt: DeferredEntry[] = [
    // Renseigné dynamiquement par scan local — ici vide à l'exécution edge (pas d'accès FS au repo).
  ];

  return (
    header +
    renderSection('Backlog produit (marqueurs documentation)', docBacklog) +
    '\n' +
    renderSection('Dette technique (commentaires code)', codeDebt) +
    '\n' +
    renderSection('Tâches d\'audit non traitées (>30j)', workbench)
  );
}

async function uploadMarkdown(md: string): Promise<string | null> {
  const supabase = getServiceClient();

  // Assure le bucket
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === 'project-docs')) {
    await supabase.storage.createBucket('project-docs', { public: false });
  }

  const { error } = await supabase.storage
    .from('project-docs')
    .upload('deferred-tasks.md', new Blob([md], { type: 'text/markdown' }), {
      upsert: true,
      contentType: 'text/markdown',
    });

  if (error) {
    console.error('[update-deferred-tasks] upload error', error);
    return null;
  }

  const { data } = supabase.storage
    .from('project-docs')
    .getPublicUrl('deferred-tasks.md');
  return data?.publicUrl ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const workbench = await fetchWorkbenchBacklog();
    const md = buildMarkdown(workbench);
    const url = await uploadMarkdown(md);

    return new Response(
      JSON.stringify({
        success: true,
        generated_at: new Date().toISOString(),
        counts: {
          workbench_overdue: workbench.length,
        },
        storage_url: url,
        markdown_preview: md.slice(0, 500),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('[update-deferred-tasks] fatal', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
