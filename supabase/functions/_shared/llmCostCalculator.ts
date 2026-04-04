/**
 * LLM Cost Calculator — Converts token usage to EUR cost.
 * Prices from OpenRouter (USD), converted to EUR at fixed rate.
 * 
 * Usage:
 *   const cost = calculateLLMCost('anthropic/claude-3.5-sonnet', 1500, 800)
 *   // → { usd: 0.0165, eur: 0.0152, label: "0.0€" }
 */

const USD_TO_EUR = 0.92

// Prices per 1M tokens (USD) — source: OpenRouter pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'google/gemini-2.5-flash-lite': { input: 0.075, output: 0.3 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'mistral/mistral-large-latest': { input: 2.0, output: 6.0 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
}

export interface LLMCost {
  /** Cost in USD */
  usd: number
  /** Cost in EUR */
  eur: number
  /** Formatted label e.g. "0.2€" */
  label: string
  /** Model used */
  model: string
  /** Tokens consumed */
  tokens: { input: number; output: number; total: number }
}

/**
 * Calculate cost for a single LLM call.
 */
export function calculateLLMCost(model: string, inputTokens: number, outputTokens: number): LLMCost {
  const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 } // fallback to Claude pricing
  
  const usdCost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  const eurCost = usdCost * USD_TO_EUR
  
  return {
    usd: Math.round(usdCost * 10000) / 10000,
    eur: Math.round(eurCost * 10000) / 10000,
    label: `${(Math.round(eurCost * 10) / 10).toFixed(1)}€`,
    model,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
  }
}

/**
 * Accumulate costs from multiple LLM calls.
 */
export class CostAccumulator {
  private calls: LLMCost[] = []

  add(model: string, inputTokens: number, outputTokens: number): LLMCost {
    const cost = calculateLLMCost(model, inputTokens, outputTokens)
    this.calls.push(cost)
    return cost
  }

  get totalEur(): number {
    return Math.round(this.calls.reduce((sum, c) => sum + c.eur, 0) * 10) / 10
  }

  get totalUsd(): number {
    return Math.round(this.calls.reduce((sum, c) => sum + c.usd, 0) * 10000) / 10000
  }

  get label(): string {
    return `${this.totalEur.toFixed(1)}€`
  }

  get summary() {
    return {
      total_eur: this.totalEur,
      total_usd: this.totalUsd,
      label: this.label,
      calls_count: this.calls.length,
      breakdown: this.calls.map(c => ({
        model: c.model,
        tokens: c.tokens.total,
        eur: c.eur,
      })),
    }
  }
}
