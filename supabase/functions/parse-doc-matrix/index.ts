import { corsHeaders } from '../_shared/cors.ts';
import { trackTokenUsage } from '../_shared/tokenTracker.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let base64 = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    base64 = btoa(base64);

    const systemPrompt = `Tu es un extracteur de données tabulaires. On te donne le contenu d'un fichier document (.doc, .docx).
Tu dois extraire les données de matrice/tableau qu'il contient et les retourner en JSON.

Le format de sortie DOIT être un tableau JSON d'objets avec ces colonnes possibles :
- prompt (obligatoire) : le texte du prompt, critère ou KPI
- poids : le poids/coefficient numérique (défaut: 1)
- axe : l'axe ou catégorie (défaut: "technique")
- seuil_bon : seuil score bon (défaut: 80)
- seuil_moyen : seuil score moyen (défaut: 50)
- seuil_mauvais : seuil score mauvais (défaut: 30)
- llm_name : nom du modèle LLM si spécifié

Règles :
- Extrais TOUS les critères/prompts trouvés dans le document
- Si le document contient un tableau, extrais ses lignes
- Si c'est une liste de critères/questions, chaque item = une ligne
- Retourne UNIQUEMENT le tableau JSON, sans markdown, sans explication
- Si aucune donnée exploitable n'est trouvée, retourne un tableau vide []`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extrais les données de matrice/tableau de ce document "${file.name}". Retourne uniquement le JSON.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type || 'application/octet-stream'};base64,${base64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'Extraction AI failed', status: response.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // Track usage
    if (data.usage) {
      trackTokenUsage('parse-doc-matrix', 'google/gemini-2.5-flash', data.usage).catch(() => {});
    }

    // Parse JSON
    let rows: any[];
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      rows = JSON.parse(cleaned);
      if (!Array.isArray(rows)) rows = [];
    } catch {
      console.error('Failed to parse AI response:', content);
      rows = [];
    }

    return new Response(JSON.stringify({ rows, fileName: file.name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-doc-matrix error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
