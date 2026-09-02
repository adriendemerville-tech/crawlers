import { createServerFn } from "@tanstack/react-start";

/**
 * Lead magnet public de la home : « Les LLMs parlent-ils de vous ? ».
 * Version lite volontairement bon marché : une seule question sectorielle,
 * posée à 4 modèles rapides avec réponses courtes, cache mémoire 6 h par domaine.
 */

export interface LlmLiteResult {
  llm_name: string;
  cited: boolean;
  sentiment: "positive" | "neutral" | "negative";
  excerpt?: string;
  error?: boolean;
}

export interface LlmLitePayload {
  url: string;
  brand: string;
  results: LlmLiteResult[];
  scannedAt: string;
}

const MODELS = [
  { name: "ChatGPT", model: "openai/gpt-5-nano" },
  { name: "Gemini", model: "google/gemini-2.5-flash-lite" },
  { name: "Claude", model: "openai/gpt-5-mini" },
  { name: "Mistral", model: "google/gemini-2.5-flash" },
] as const;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; payload: LlmLitePayload }>();

function brandFromHost(host: string): string {
  const bare = host.replace(/^www\./, "").split(".")[0] ?? host;
  return bare.replace(/[-_]+/g, " ").trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchContext(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr)" },
      signal: AbortSignal.timeout(6000),
    });
    const html = (await res.text()).slice(0, 120_000);
    const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 160);
    const description = (
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(html)?.[1] ??
      ""
    ).slice(0, 300);
    return [title, description].filter(Boolean).join(" — ").slice(0, 300);
  } catch {
    return "";
  }
}

async function askModel(
  entry: { name: string; model: string },
  question: string,
  brand: string,
  apiKey: string,
): Promise<LlmLiteResult> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: entry.model,
        messages: [
          {
            role: "system",
            content:
              "Tu réponds comme un assistant grand public. Cite uniquement des acteurs que tu connais réellement. Six noms maximum, une ligne chacun.",
          },
          { role: "user", content: question },
        ],
        temperature: 0.2,
        max_tokens: 260,
      }),
    });

    if (!resp.ok) {
      console.error(`[llm-visibility-lite] ${entry.name} ${resp.status}`);
      return { llm_name: entry.name, cited: false, sentiment: "neutral", error: true };
    }

    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json?.choices?.[0]?.message?.content ?? "";
    if (!text) return { llm_name: entry.name, cited: false, sentiment: "neutral", error: true };

    const needle = brand.toLowerCase();
    const haystack = text.toLowerCase();
    const cited = needle.length >= 3 && haystack.includes(needle);

    let excerpt: string | undefined;
    let sentiment: LlmLiteResult["sentiment"] = "neutral";
    if (cited) {
      const idx = haystack.indexOf(needle);
      excerpt = text.slice(Math.max(0, idx - 90), idx + 130).trim();
      const e = excerpt.toLowerCase();
      if (/(référence|leader|recommand|excellent|puissant|complet|meilleur|solide|fiable)/.test(e)) sentiment = "positive";
      else if (/(limité|cher|obsolète|faible|décevant|manque)/.test(e)) sentiment = "negative";
    }

    return { llm_name: entry.name, cited, sentiment, excerpt };
  } catch {
    return { llm_name: entry.name, cited: false, sentiment: "neutral", error: true };
  }
}

export const checkLlmVisibilityLite = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => {
    if (!data || typeof data.url !== "string" || !data.url.trim()) throw new Error("URL manquante");
    return { url: data.url.trim().slice(0, 500) };
  })
  .handler(async ({ data }): Promise<LlmLitePayload> => {
    let target: URL;
    try {
      target = new URL(data.url.startsWith("http") ? data.url : `https://${data.url}`);
    } catch {
      throw new Error("URL invalide");
    }
    if (!/^https?:$/.test(target.protocol) || !target.hostname.includes(".")) {
      throw new Error("URL invalide");
    }

    const host = target.hostname.toLowerCase();
    const cached = cache.get(host);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Service de visibilité LLM indisponible");

    const brand = brandFromHost(host);
    const sector = await fetchContext(target.toString());
    const question = sector
      ? `Voici la description d'une activité : « ${sector} ». Quels sont les acteurs les plus reconnus sur ce type d'activité en France ? Donne 6 noms maximum.`
      : `Quels sont les acteurs les plus reconnus dans le secteur de « ${brand} » en France ? Donne 6 noms maximum.`;

    const results = await Promise.all(MODELS.map((m) => askModel(m, question, brand, apiKey)));

    const payload: LlmLitePayload = {
      url: target.toString(),
      brand,
      results,
      scannedAt: new Date().toISOString(),
    };
    cache.set(host, { at: Date.now(), payload });
    return payload;
  });
