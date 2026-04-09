/**
 * Maps bot_name to intent: 'training' (systematic crawl) vs 'fetch_user' (answering a user question)
 */

export type BotIntent = 'training' | 'fetch_user' | 'indexing' | 'unknown';

const INTENT_MAP: Record<string, BotIntent> = {
  // AI training crawlers
  'GPTBot': 'training',
  'ClaudeBot': 'training',
  'Claude-Web': 'training',
  'Anthropic': 'training',
  'Google-Extended': 'training',
  'CCBot': 'training',
  'Bytespider': 'training',
  'Cohere': 'training',
  'Diffbot': 'training',
  'FacebookBot': 'training',
  'ImagesiftBot': 'training',
  'Applebot-Extended': 'training',
  'Meta-ExternalAgent': 'training',

  // User-fetch (answering a real-time question)
  'ChatGPT-User': 'fetch_user',
  'PerplexityBot': 'fetch_user',
  'YouBot': 'fetch_user',
  'Phind': 'fetch_user',

  // Search engine indexing
  'Googlebot': 'indexing',
  'bingbot': 'indexing',
  'Baiduspider': 'indexing',
  'YandexBot': 'indexing',
  'DuckDuckBot': 'indexing',
  'Applebot': 'indexing',
  'Qwantify': 'indexing',
  'NaverBot': 'indexing',
};

export function getBotIntent(botName: string | null): BotIntent {
  if (!botName) return 'unknown';
  return INTENT_MAP[botName] ?? 'unknown';
}

export function getIntentLabel(intent: BotIntent, lang: string = 'fr'): string {
  const labels: Record<BotIntent, Record<string, string>> = {
    training: { fr: 'Entraînement', en: 'Training', es: 'Entrenamiento' },
    fetch_user: { fr: 'Fetch utilisateur', en: 'User fetch', es: 'Consulta usuario' },
    indexing: { fr: 'Indexation', en: 'Indexing', es: 'Indexación' },
    unknown: { fr: 'Inconnu', en: 'Unknown', es: 'Desconocido' },
  };
  return labels[intent]?.[lang] ?? labels[intent]?.fr ?? intent;
}

export function getIntentColor(intent: BotIntent): string {
  switch (intent) {
    case 'training': return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    case 'fetch_user': return 'text-orange-600 bg-orange-500/10 border-orange-500/20';
    case 'indexing': return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

// Bot icon/avatar mapping (emoji fallback)
export function getBotIcon(botName: string | null): string {
  if (!botName) return '🤖';
  const map: Record<string, string> = {
    'GPTBot': '🟢',
    'ChatGPT-User': '💬',
    'ClaudeBot': '🔮',
    'Claude-Web': '🔮',
    'Anthropic': '🔮',
    'PerplexityBot': '🔍',
    'Google-Extended': '🧠',
    'Googlebot': '🔵',
    'bingbot': '🟦',
    'Applebot': '🍎',
    'Applebot-Extended': '🍎',
    'CCBot': '📚',
    'Bytespider': '🕷️',
    'FacebookBot': '📘',
    'Diffbot': '⚙️',
    'YandexBot': '🔴',
    'DuckDuckBot': '🦆',
  };
  return map[botName] ?? '🤖';
}
