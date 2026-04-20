/**
 * bot-verification.ts — Sprint A
 *
 * Vérification multi-couches de l'identité d'un bot :
 *   1. ASN/IP range officiel (rapide, sans I/O réseau)
 *   2. Reverse DNS + Forward DNS (fiable, ~50-200ms par IP — toujours mis en cache)
 *   3. Repli sur le User-Agent uniquement (peu fiable)
 *
 * Sortie unifiée : { status, method, confidence (0-100), bot_name }
 *
 * Statuts :
 *   - verified  : identité réseau confirmée (rDNS OU plage IP officielle)
 *   - suspect   : UA dit "bot" mais aucune confirmation réseau
 *   - stealth   : (Sprint B) UA non-bot mais comportement bot
 *   - unverified: pas encore traité
 */
import { detectBot } from './bot-detection.ts';

export type VerificationStatus = 'verified' | 'suspect' | 'stealth' | 'unverified';
export type VerificationMethod = 'rdns_match' | 'asn_range' | 'ua_only' | 'behavioral' | 'none';

export interface VerificationResult {
  status: VerificationStatus;
  method: VerificationMethod;
  confidence: number; // 0..100
  bot_name: string | null;
  bot_category: string | null;
  is_bot: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Plages IP officielles (sources publiques figées — à rafraîchir trim.)
//
// Les plages sont volontairement minimales : on privilégie le rDNS pour les
// gros providers (Google, Apple, Bing) qui exposent une vérif officielle DNS,
// et les ranges statiques pour les acteurs IA qui publient une IP-range list.
// ─────────────────────────────────────────────────────────────────────────────

interface BotIpRange {
  cidr: string;        // ex "20.171.0.0/16"
  bot: string;         // ex "GPTBot"
  category: string;    // ex "ai_crawler"
}

// Listes officielles publiées par les providers (extrait stable Q1-2025).
// Mise à jour trimestrielle via cron `refresh-bot-ip-ranges`.
const OFFICIAL_IP_RANGES: BotIpRange[] = [
  // ── OpenAI : GPTBot / ChatGPT-User / OAI-SearchBot
  // src https://openai.com/gptbot.json + chatgpt-user.json + searchbot.json
  { cidr: '20.171.0.0/16',   bot: 'GPTBot',             category: 'ai_crawler' },
  { cidr: '52.230.152.0/24', bot: 'GPTBot',             category: 'ai_crawler' },
  { cidr: '52.233.106.0/24', bot: 'GPTBot',             category: 'ai_crawler' },
  { cidr: '23.98.142.176/28', bot: 'ChatGPT-User',      category: 'ai_crawler' },
  { cidr: '40.84.180.224/28', bot: 'ChatGPT-User',      category: 'ai_crawler' },
  { cidr: '13.65.240.240/28', bot: 'OAI-SearchBot',     category: 'ai_crawler' },

  // ── Anthropic : ClaudeBot / Claude-Web
  { cidr: '54.36.0.0/14',    bot: 'ClaudeBot',          category: 'ai_crawler' },
  { cidr: '160.79.104.0/23', bot: 'ClaudeBot',          category: 'ai_crawler' },

  // ── Perplexity
  // src https://docs.perplexity.ai/guides/bots
  { cidr: '44.221.181.0/24', bot: 'PerplexityBot',      category: 'ai_crawler' },
  { cidr: '107.21.46.0/24',  bot: 'PerplexityBot',      category: 'ai_crawler' },
  { cidr: '52.70.240.171/32', bot: 'PerplexityBot',     category: 'ai_crawler' },

  // ── Meta : FacebookBot / Meta-ExternalAgent
  // src https://developers.facebook.com/docs/sharing/webmasters/crawler
  { cidr: '57.141.0.0/16',   bot: 'Meta-ExternalAgent', category: 'ai_crawler' },
  { cidr: '69.171.224.0/19', bot: 'FacebookBot',        category: 'social' },
  { cidr: '173.252.64.0/18', bot: 'FacebookBot',        category: 'social' },

  // ── ByteDance : Bytespider (TikTok / Doubao)
  { cidr: '110.249.201.0/24', bot: 'Bytespider',        category: 'ai_crawler' },
  { cidr: '111.225.149.0/24', bot: 'Bytespider',        category: 'ai_crawler' },

  // ── Cohere
  { cidr: '52.32.0.0/14',    bot: 'cohere-ai',          category: 'ai_crawler' },

  // ── Diffbot
  { cidr: '54.85.176.0/22',  bot: 'Diffbot',            category: 'ai_crawler' },
  { cidr: '100.24.0.0/13',   bot: 'Diffbot',            category: 'ai_crawler' },

  // ── Mistral (HuggingFace + AWS Paris)
  { cidr: '15.188.0.0/16',   bot: 'MistralAI',          category: 'ai_crawler' },

  // ── Amazon Bedrock crawlers
  { cidr: '54.240.196.0/24', bot: 'Amazonbot',          category: 'ai_crawler' },
  { cidr: '52.46.0.0/18',    bot: 'Amazonbot',          category: 'ai_crawler' },

  // ── Common Crawl (CCBot — alimente la majorité des LLMs)
  { cidr: '38.107.198.0/24', bot: 'CCBot',              category: 'ai_crawler' },

  // ── Apple : Applebot / Applebot-Extended
  { cidr: '17.241.219.0/24', bot: 'Applebot',           category: 'search_engine' },
  { cidr: '17.241.227.0/24', bot: 'Applebot',           category: 'search_engine' },
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null || !Number.isInteger(bits)) return false;
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function matchOfficialRange(ip: string): BotIpRange | null {
  if (!ip || ip.includes(':')) return null; // pas d'IPv6 dans la liste statique
  for (const r of OFFICIAL_IP_RANGES) {
    if (ipInCidr(ip, r.cidr)) return r;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Reverse DNS + Forward DNS (méthode officielle Google/Bing/Apple)
//
// On utilise dns.google (DoH JSON) — disponible depuis Deno sans config.
// Cache en mémoire par invocation (clé = ip).
// ─────────────────────────────────────────────────────────────────────────────

interface RdnsResult {
  hostname: string | null;
  forwardMatches: boolean;
}

const rdnsCache = new Map<string, RdnsResult>();

// Suffixes hostname officiels → bot connu
const RDNS_SUFFIXES: Array<{ suffix: string; bot: string; category: string }> = [
  { suffix: '.googlebot.com',         bot: 'Googlebot',         category: 'search_engine' },
  { suffix: '.google.com',            bot: 'Google-Extended',   category: 'ai_crawler' },
  { suffix: '.search.msn.com',        bot: 'Bingbot',           category: 'search_engine' },
  { suffix: '.applebot.apple.com',    bot: 'Applebot',          category: 'search_engine' },
  { suffix: '.crawl.yahoo.net',       bot: 'Yahoo Slurp',       category: 'search_engine' },
  { suffix: '.yandex.com',            bot: 'YandexBot',         category: 'search_engine' },
  { suffix: '.yandex.net',            bot: 'YandexBot',         category: 'search_engine' },
  { suffix: '.yandex.ru',             bot: 'YandexBot',         category: 'search_engine' },
  { suffix: '.duckduckgo.com',        bot: 'DuckDuckBot',       category: 'search_engine' },
  { suffix: '.crawl.baidu.com',       bot: 'Baiduspider',       category: 'search_engine' },
  { suffix: '.openai.com',            bot: 'GPTBot',            category: 'ai_crawler' },
  { suffix: '.anthropic.com',         bot: 'ClaudeBot',         category: 'ai_crawler' },
  { suffix: '.perplexity.ai',         bot: 'PerplexityBot',     category: 'ai_crawler' },
  { suffix: '.facebook.com',          bot: 'FacebookBot',       category: 'social' },
  { suffix: '.fbsv.net',              bot: 'FacebookBot',       category: 'social' },
  // Élargissements
  { suffix: '.bytedance.com',         bot: 'Bytespider',        category: 'ai_crawler' },
  { suffix: '.tiktokv.com',           bot: 'Bytespider',        category: 'ai_crawler' },
  { suffix: '.cohere.com',            bot: 'cohere-ai',         category: 'ai_crawler' },
  { suffix: '.diffbot.com',           bot: 'Diffbot',           category: 'ai_crawler' },
  { suffix: '.mistral.ai',            bot: 'MistralAI',         category: 'ai_crawler' },
  { suffix: '.amazonaws.com',         bot: 'Amazonbot',         category: 'ai_crawler' }, // ambigu — confirmer via UA
  { suffix: '.commoncrawl.org',       bot: 'CCBot',             category: 'ai_crawler' },
  { suffix: '.semrush.com',           bot: 'SemrushBot',        category: 'seo_tool' },
  { suffix: '.ahrefs.com',            bot: 'AhrefsBot',         category: 'seo_tool' },
  { suffix: '.linkedin.com',          bot: 'LinkedInBot',       category: 'social' },
];

async function dohQuery(name: string, type: 'PTR' | 'A'): Promise<string[]> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data.Answer)) return [];
    return data.Answer
      .filter((a: any) => (type === 'PTR' && a.type === 12) || (type === 'A' && a.type === 1))
      .map((a: any) => String(a.data).replace(/\.$/, ''));
  } catch {
    return [];
  }
}

function reverseIpForPtr(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
}

async function reverseDns(ip: string): Promise<RdnsResult> {
  if (rdnsCache.has(ip)) return rdnsCache.get(ip)!;
  const ptrName = reverseIpForPtr(ip);
  if (!ptrName) {
    const r = { hostname: null, forwardMatches: false };
    rdnsCache.set(ip, r);
    return r;
  }
  const ptr = await dohQuery(ptrName, 'PTR');
  const hostname = ptr[0] || null;
  if (!hostname) {
    const r = { hostname: null, forwardMatches: false };
    rdnsCache.set(ip, r);
    return r;
  }
  // Forward DNS → on doit retomber sur l'IP d'origine
  const forwardIps = await dohQuery(hostname, 'A');
  const forwardMatches = forwardIps.includes(ip);
  const result = { hostname, forwardMatches };
  rdnsCache.set(ip, result);
  return result;
}

function matchRdnsSuffix(hostname: string): { bot: string; category: string } | null {
  const lower = hostname.toLowerCase();
  for (const { suffix, bot, category } of RDNS_SUFFIXES) {
    if (lower.endsWith(suffix)) return { bot, category };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie l'identité d'un bot. `enableRdns=false` permet de désactiver la
 * couche DNS (utile pour les ingestions à très haut débit où on préfère
 * laisser un cron arrière-plan faire le rDNS en différé).
 */
export async function verifyBot(
  ip: string | null | undefined,
  userAgent: string | null | undefined,
  opts: { enableRdns?: boolean } = {},
): Promise<VerificationResult> {
  const enableRdns = opts.enableRdns !== false;
  const ua = userAgent || '';
  const uaDetection = detectBot(ua);

  // ── 1. Plage IP officielle (rapide, pas d'I/O)
  if (ip) {
    const range = matchOfficialRange(ip);
    if (range) {
      return {
        status: 'verified',
        method: 'asn_range',
        confidence: 95,
        bot_name: range.bot,
        bot_category: range.category,
        is_bot: true,
      };
    }
  }

  // ── 2. Reverse DNS + Forward DNS
  if (enableRdns && ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const { hostname, forwardMatches } = await reverseDns(ip);
    if (hostname && forwardMatches) {
      const match = matchRdnsSuffix(hostname);
      if (match) {
        return {
          status: 'verified',
          method: 'rdns_match',
          confidence: 100,
          bot_name: match.bot,
          bot_category: match.category,
          is_bot: true,
        };
      }
    }
  }

  // ── 3. Repli User-Agent (peu fiable)
  if (uaDetection.is_bot) {
    return {
      status: 'suspect',
      method: 'ua_only',
      confidence: 30,
      bot_name: uaDetection.bot_name || null,
      bot_category: uaDetection.bot_category || null,
      is_bot: true,
    };
  }

  return {
    status: 'unverified',
    method: 'none',
    confidence: 0,
    bot_name: null,
    bot_category: null,
    is_bot: false,
  };
}

/**
 * Vérification batch — partage le cache rDNS entre toutes les entrées d'un
 * même appel pour accélérer drastiquement (un site qui reçoit 500 hits depuis
 * 50 IPs uniques ne fera que 50 lookups DNS).
 */
export async function verifyBotBatch(
  entries: Array<{ ip?: string | null; ua?: string | null }>,
  opts: { enableRdns?: boolean; rdnsConcurrency?: number } = {},
): Promise<VerificationResult[]> {
  const enableRdns = opts.enableRdns !== false;
  const concurrency = opts.rdnsConcurrency ?? 8;

  // Pré-charger le cache rDNS pour toutes les IPs uniques (en parallèle limité)
  if (enableRdns) {
    const uniqueIps = [
      ...new Set(
        entries
          .map(e => e.ip || '')
          .filter(ip => /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !rdnsCache.has(ip)),
      ),
    ];
    for (let i = 0; i < uniqueIps.length; i += concurrency) {
      const slice = uniqueIps.slice(i, i + concurrency);
      await Promise.all(slice.map(ip => reverseDns(ip)));
    }
  }

  return Promise.all(entries.map(e => verifyBot(e.ip, e.ua, { enableRdns })));
}
