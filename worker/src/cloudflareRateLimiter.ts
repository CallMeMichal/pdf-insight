import { DurableObject } from 'cloudflare:workers';
import { ANALYSES_PER_DAY } from '@pdf-insight/shared';
import type { RateLimitDecision, RateLimiter } from './rateLimit';

/**
 * Okno bindingu Rate Limiting (`period` w wrangler.toml, tam też limit). Binding nie
 * zdradza, kiedy okno się kończy, więc `Retry-After` to pełna długość okna.
 */
const MINUTE_WINDOW_SECONDS = 60;

interface DailyUsage {
  /** Doba UTC w formacie `YYYY-MM-DD`. */
  day: string;
  count: number;
}

/**
 * Licznik Analiz jednego adresu IP w bieżącej dobie UTC (jedna instancja na adres IP).
 * Binding Rate Limiting obsługuje tylko okna 10 s i 60 s, dlatego limit dobowy liczy Durable
 * Object — jego licznik jest spójny, w odróżnieniu od KV.
 */
export class DailyAnalysisCounter extends DurableObject {
  async consume(): Promise<RateLimitDecision> {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const dayEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

    const usage = await this.ctx.storage.get<DailyUsage>('usage');
    const count = usage?.day === day ? usage.count : 0;
    if (count >= ANALYSES_PER_DAY) {
      return {
        ok: false,
        window: 'day',
        retryAfterSeconds: Math.ceil((dayEnd - now.getTime()) / 1000),
      };
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

/** Limit Analiz na adres IP: binding Rate Limiting (na minutę) i Durable Object (na dobę). */
export function createCloudflareRateLimiter(
  perMinute: RateLimit,
  daily: DurableObjectNamespace<DailyAnalysisCounter>,
): RateLimiter {
  return {
    async check(clientIp) {
      const minute = await perMinute.limit({ key: clientIp });
      if (!minute.success) {
        return { ok: false, window: 'minute', retryAfterSeconds: MINUTE_WINDOW_SECONDS };
      }
      // Licznik dobowy rośnie tylko dla Analiz, które zmieściły się w limicie minutowym.
      return daily.get(daily.idFromName(clientIp)).consume();
    },
  };
}
