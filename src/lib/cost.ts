// Costo real de las llamadas a Claude, en USD.
//
// El admin estimaba `input_tokens + output_tokens` a una tarifa plana. Eso
// subcuenta: `usage.input_tokens` NO incluye lo cacheado (va aparte en
// cache_creation / cache_read), y los tokens de thinking se facturan a tarifa de
// salida. Acá se suman los cuatro contadores con su precio.
//
// Precios claude-sonnet-4-6, USD por millón de tokens. Cache write = 1.25x input
// (TTL 5 min), cache read = 0.1x input (estándar Anthropic).
const PER_MTOK = {
  input: 3,
  output: 15,
  cacheWrite: 3.75,
  cacheRead: 0.3,
} as const;

// Tarifa mixta histórica, para estimar filas viejas que solo tienen tokens_used.
export const LEGACY_BLENDED_PER_MTOK = 4.8;

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface CostBreakdown {
  costUsd: number;
  /** Total de tokens facturables (input + output + cache write + cache read). */
  billableTokens: number;
}

export function computeCost(...usages: Array<TokenUsage | null | undefined>): CostBreakdown {
  let costUsd = 0;
  let billableTokens = 0;

  for (const u of usages) {
    if (!u) continue;
    const input = u.input_tokens ?? 0;
    const output = u.output_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    const cacheRead = u.cache_read_input_tokens ?? 0;

    costUsd +=
      (input * PER_MTOK.input +
        output * PER_MTOK.output +
        cacheWrite * PER_MTOK.cacheWrite +
        cacheRead * PER_MTOK.cacheRead) /
      1_000_000;
    billableTokens += input + output + cacheWrite + cacheRead;
  }

  return { costUsd, billableTokens };
}
