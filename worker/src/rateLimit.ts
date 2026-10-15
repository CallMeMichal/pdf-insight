/** Decyzja limitu: Analiza dozwolona albo czas do ponownej próby (`Retry-After`). */
export type RateLimitDecision = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Wąski interfejs dobowego limitu Analiz na adres IP. Każde wywołanie `check` liczy jedną
 * Analizę; po przekroczeniu limitu zwraca, po ilu sekundach można spróbować ponownie.
 */
export interface RateLimiter {
  check(clientIp: string): Promise<RateLimitDecision>;
}
