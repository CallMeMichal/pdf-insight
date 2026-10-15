/** Okno limitu, które zostało przekroczone. */
export type RateLimitWindow = 'minute' | 'day';

/** Decyzja limitu: Analiza dozwolona albo przekroczone okno i czas do ponownej próby (`Retry-After`). */
export type RateLimitDecision =
  { ok: true } | { ok: false; window: RateLimitWindow; retryAfterSeconds: number };

/**
 * Wąski interfejs limitu Analiz na adres IP. Każde wywołanie `check` liczy jedną Analizę;
 * po przekroczeniu limitu zwraca, po ilu sekundach można spróbować ponownie.
 */
export interface RateLimiter {
  check(clientIp: string): Promise<RateLimitDecision>;
}
