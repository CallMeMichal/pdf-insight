import { DurableObject } from 'cloudflare:workers';
import { ANALYSES_PER_DAY } from '@pdf-insight/shared';
import type { RateLimitDecision, RateLimiter } from './rateLimit';

interface DailyUsage {
  /** Doba UTC w formacie `YYYY-MM-DD`. */
  day: string;
  count: number;
}

/**
 * Licznik Analiz jednego adresu IP w bieżącej dobie UTC (jedna instancja na adres IP).
 * Durable Object, bo jego licznik jest spójny — w odróżnieniu od KV.
 */
export class DailyAnalysisCounter extends DurableObject {
  async consume(): Promise<RateLimitDecision> {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const dayEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

    const usage = await this.ctx.storage.get<DailyUsage>('usage');
    const count = usage?.day === day ? usage.count : 0;
    if (count >= ANALYSES_PER_DAY) {
      return { ok: false, retryAfterSeconds: Math.ceil((dayEnd - now.getTime()) / 1000) };
    }

    await this.ctx.storage.put<DailyUsage>('usage', { day, count: count + 1 });
    // Po końcu doby licznik jest zbędny — alarm usuwa go, by nie trzymać danych o adresie IP.
    await this.ctx.storage.setAlarm(dayEnd);
    return { ok: true };
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

/** Dobowy limit Analiz na adres IP: jeden `DailyAnalysisCounter` na adres. */
export function createCloudflareRateLimiter(
  counters: DurableObjectNamespace<DailyAnalysisCounter>,
): RateLimiter {
  return {
    check: (clientIp) => counters.get(counters.idFromName(clientIp)).consume(),
  };
}
