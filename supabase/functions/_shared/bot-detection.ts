/**
 * Bot detection module for log analysis.
 * Matches user-agent strings against known bot patterns.
 */

interface BotDetectionResult {
  is_bot: boolean;
  bot_name?: string;
  bot_category?: 'search_engine' | 'ai_crawler' | 'seo_tool' | 'social' | 'unknown';
}

const BOT_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
  category: BotDetectionResult['bot_category'];
}> = [
  // Search engines
  { pattern: /googlebot/i,           name: 'Googlebot',          category: 'search_engine' },
  { pattern: /bingbot/i,             name: 'Bingbot',            category: 'search_engine' },
  { pattern: /yandexbot/i,           name: 'YandexBot',          category: 'search_engine' },
  { pattern: /duckduckbot/i,         name: 'DuckDuckBot',        category: 'search_engine' },
  { pattern: /baidu/i,               name: 'Baiduspider',        category: 'search_engine' },
  { pattern: /slurp/i,               name: 'Yahoo Slurp',        category: 'search_engine' },
  { pattern: /qwantify/i,            name: 'Qwantify',           category: 'search_engine' },
  // AI crawlers
  { pattern: /gptbot/i,              name: 'GPTBot',             category: 'ai_crawler' },
  { pattern: /chatgpt-user/i,        name: 'ChatGPT-User',       category: 'ai_crawler' },
  { pattern: /claude-web/i,          name: 'Claude-Web',         category: 'ai_crawler' },
  { pattern: /claudebot/i,           name: 'ClaudeBot',          category: 'ai_crawler' },
  { pattern: /anthropic/i,           name: 'Anthropic',          category: 'ai_crawler' },
  { pattern: /bytespider/i,          name: 'Bytespider',         category: 'ai_crawler' },
  { pattern: /ccbot/i,               name: 'CCBot',              category: 'ai_crawler' },
  { pattern: /perplexitybot/i,       name: 'PerplexityBot',      category: 'ai_crawler' },
  { pattern: /meta-externalagent/i,  name: 'Meta-ExternalAgent', category: 'ai_crawler' },
  { pattern: /amazonbot/i,           name: 'AmazonBot',          category: 'ai_crawler' },
  { pattern: /google-extended/i,     name: 'Google-Extended',    category: 'ai_crawler' },
  { pattern: /applebot-extended/i,   name: 'Applebot-Extended',  category: 'ai_crawler' },
  { pattern: /cohere-ai/i,           name: 'Cohere-AI',         category: 'ai_crawler' },
  // SEO tools
  { pattern: /ahrefsbot/i,           name: 'AhrefsBot',          category: 'seo_tool' },
  { pattern: /semrushbot/i,          name: 'SemrushBot',         category: 'seo_tool' },
  { pattern: /mj12bot/i,             name: 'MJ12bot',            category: 'seo_tool' },
  { pattern: /dotbot/i,              name: 'DotBot',             category: 'seo_tool' },
  { pattern: /screaming.?frog/i,     name: 'Screaming Frog',     category: 'seo_tool' },
  { pattern: /rogerbot/i,            name: 'Rogerbot',           category: 'seo_tool' },
  { pattern: /serpstatbot/i,         name: 'SerpstatBot',        category: 'seo_tool' },
  { pattern: /dataforseo/i,          name: 'DataForSEO',         category: 'seo_tool' },
  // Social
  { pattern: /facebookexternalhit/i, name: 'Facebook',           category: 'social' },
  { pattern: /twitterbot/i,          name: 'TwitterBot',         category: 'social' },
  { pattern: /linkedinbot/i,         name: 'LinkedInBot',        category: 'social' },
  { pattern: /whatsapp/i,            name: 'WhatsApp',           category: 'social' },
  { pattern: /telegrambot/i,         name: 'TelegramBot',        category: 'social' },
  { pattern: /discordbot/i,          name: 'DiscordBot',         category: 'social' },
  { pattern: /pinterestbot/i,        name: 'Pinterest',          category: 'social' },
  // Generic bot patterns (last resort)
  { pattern: /bot[\s\/;)]/i,         name: 'Unknown Bot',        category: 'unknown' },
  { pattern: /crawler/i,             name: 'Unknown Crawler',    category: 'unknown' },
  { pattern: /spider/i,              name: 'Unknown Spider',     category: 'unknown' },
];

export function detectBot(userAgent: string | null | undefined): BotDetectionResult {
  if (!userAgent) return { is_bot: false };

  for (const { pattern, name, category } of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { is_bot: true, bot_name: name, bot_category: category };
    }
  }

  return { is_bot: false };
}

/**
 * Check if a user-agent is a known bot (lightweight, returns boolean only).
 */
export function isBot(userAgent: string | null | undefined): boolean {
  return detectBot(userAgent).is_bot;
}
