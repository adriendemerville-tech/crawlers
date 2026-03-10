import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find published articles missing EN or ES translations
    const { data: articles, error } = await supabase
      .from("blog_articles")
      .select("id, slug, title, excerpt, content, title_en, title_es")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) throw error;

    const toTranslate = (articles || []).filter(
      (a: any) => a.content && (!a.title_en || !a.title_es)
    );

    console.log(`[backfill] Found ${toTranslate.length} articles needing translations`);

    let translated = 0;

    for (const article of toTranslate) {
      const missingEn = !article.title_en;
      const missingEs = !article.title_es;

      const translationPrompt = (langLabel: string) =>
        `You are a professional SEO translator. Translate this French blog article to ${langLabel}.

RULES:
- Keep ALL HTML structure intact (tags, classes, attributes)
- Keep brand names (Crawlers.fr, Google, ChatGPT, etc.) unchanged
- Keep URLs unchanged
- Adapt cultural references naturally
- The translation must be fluent and native-sounding, NOT literal
- Keep technical SEO/GEO terms that are commonly used in ${langLabel}
- Return ONLY a JSON object with exactly these fields:

{
  "title": "Translated SEO title < 60 chars",
  "excerpt": "Translated meta description < 155 chars",
  "content": "Full translated HTML content"
}

FRENCH ARTICLE TO TRANSLATE:
Title: ${article.title}
Excerpt: ${article.excerpt || ""}
Content: ${article.content}`;

      const requests: Promise<Response>[] = [];
      const langs: string[] = [];

      if (missingEn) {
        langs.push("en");
        requests.push(
          fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a professional translator. Return only valid JSON." },
                { role: "user", content: translationPrompt("English") },
              ],
              temperature: 0.3,
            }),
          })
        );
      }

      if (missingEs) {
        langs.push("es");
        requests.push(
          fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a professional translator. Return only valid JSON." },
                { role: "user", content: translationPrompt("Spanish") },
              ],
              temperature: 0.3,
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const updateData: Record<string, string | null> = {};

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const lang = langs[i];
        try {
          if (res.ok) {
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content || "";
            const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            if (lang === "en") {
              updateData.title_en = parsed.title || null;
              updateData.excerpt_en = parsed.excerpt || null;
              updateData.content_en = parsed.content || null;
            } else {
              updateData.title_es = parsed.title || null;
              updateData.excerpt_es = parsed.excerpt || null;
              updateData.content_es = parsed.content || null;
            }
            console.log(`[backfill] ✅ ${article.slug} → ${lang.toUpperCase()}`);
          } else {
            console.warn(`[backfill] ⚠️ ${article.slug} ${lang} failed: ${res.status}`);
          }
        } catch (e) {
          console.warn(`[backfill] ⚠️ ${article.slug} ${lang} parse error:`, e);
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateErr } = await supabase
          .from("blog_articles")
          .update(updateData)
          .eq("id", article.id);

        if (updateErr) {
          console.error(`[backfill] Update error for ${article.slug}:`, updateErr);
        } else {
          translated++;
        }
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log(`[backfill] Done: ${translated}/${toTranslate.length} articles translated`);

    return new Response(
      JSON.stringify({ success: true, total: toTranslate.length, translated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[backfill] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
