import { describe, expect, it } from 'vitest';
import { MAX_AMOUNTS, MAX_DATE_MENTIONS, resultSchema, type Result } from '@pdf-insight/shared';
import { handleRequest, type HandlerConfig } from './handler';
import type { ModelAdapter, ModelResponse } from './model';
import type { RateLimitDecision, RateLimiter } from './rateLimit';

const DEMO_ORIGIN = 'https://callmemichal.github.io';
const MODEL_NAME = 'gemini-test-flash';

/** Odpowiedź modelu: Wynik bez `meta`, `fileName` i `pages`. */
function generatedResult() {
  return {
    document: {
      language: 'pl',
      type: 'umowa',
      title: 'Umowa o świadczenie usług nr 14/2026',
      date: '2026-03-12',
    },
    summary: 'Umowa dotyczy wdrożenia systemu. Strony ustalają abonament. Umowa obowiązuje rok.',
    keyPoints: ['Abonament miesięczny', 'Okres 12 miesięcy', 'Kary umowne'],
    entities: { organizations: ['Przykładowa Spółka z o.o.'], people: ['Jan Kowalski'] },
    amounts: [{ value: 12500, currency: 'PLN', context: 'abonament miesięczny netto' }],
    dates: [{ date: '2026-03-12', context: 'zawarcie umowy' }],
    keywords: ['umowa', 'abonament', 'wdrożenie'],
  };
}

const ok = (body: unknown): ModelResponse => ({ ok: true, text: JSON.stringify(body) });

/** Fake adaptera: zwraca kolejne odpowiedzi z listy i zapamiętuje, z jakim tekstem go wołano. */
function fakeModel(...responses: ModelResponse[]): ModelAdapter & { calls: string[] } {
  const calls: string[] = [];
  return {
    modelName: MODEL_NAME,
    calls,
    generate(documentText) {
      calls.push(documentText);
      const response = responses[calls.length - 1];
      if (!response) throw new Error(`Nieoczekiwane wywołanie modelu nr ${calls.length}`);
      return Promise.resolve(response);
    },
  };
}

/** Fake limitera: zwraca zadaną decyzję i zapamiętuje, dla jakich adresów IP go wołano. */
function fakeRateLimiter(decision: RateLimitDecision = { ok: true }): RateLimiter & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    check(clientIp) {
      calls.push(clientIp);
      return Promise.resolve(decision);
    },
  };
}

function configWith(model: ModelAdapter, rateLimiter = fakeRateLimiter()): HandlerConfig {
  return { allowedOrigins: [DEMO_ORIGIN, 'http://localhost:*'], model, rateLimiter };
}

/** Konfiguracja dla testów, w których model zawsze odpowiada poprawnie. */
const config = configWith({
  modelName: MODEL_NAME,
  generate: () => Promise.resolve(ok(generatedResult())),
});

const CLIENT_IP = '203.0.113.7';

function analyzeRequest(body: unknown, origin = DEMO_ORIGIN): Request {
  return new Request('https://worker.example/analyze', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': CLIENT_IP },
    body: JSON.stringify(body),
  });
}

const validBody = { text: 'Treść umowy', fileName: 'umowa.pdf', pages: 3 };

describe('POST /analyze', () => {
  it('zwraca 200 i Wynik od modelu z fileName i pages z żądania oraz meta', async () => {
    // Model „zgaduje” metadane — Worker musi je nadpisać wartościami z żądania.
    const output = generatedResult();
    const model = fakeModel(
      ok({ ...output, document: { ...output.document, fileName: 'inny.pdf', pages: 99 } }),
    );

    const response = await handleRequest(analyzeRequest(validBody), configWith(model));

    expect(response.status).toBe(200);
    const result = (await response.json()) as Result;
    expect(model.calls).toEqual(['Treść umowy']);
    expect(result.summary).toBe(output.summary);
    expect(result.document).toMatchObject({ fileName: 'umowa.pdf', pages: 3, date: '2026-03-12' });
    expect(result.meta.model).toBe(MODEL_NAME);
    expect(result.meta.schemaVersion).toBe(1);
    expect(Date.parse(result.meta.analyzedAt)).not.toBeNaN();
  });

  it.each([
    ['niepoprawny JSON', { ok: true, text: '{"document": {' }],
    ['JSON niezgodny ze schematem', ok({ ...generatedResult(), keyPoints: ['tylko jeden punkt'] })],
  ] satisfies [string, ModelResponse][])(
    'po jednej złej odpowiedzi (%s) ponawia próbę i zwraca 200',
    async (_, badResponse) => {
      const model = fakeModel(badResponse, ok(generatedResult()));

      const response = await handleRequest(analyzeRequest(validBody), configWith(model));

      expect(response.status).toBe(200);
      expect(model.calls).toHaveLength(2);
      expect(resultSchema.safeParse(await response.json()).success).toBe(true);
    },
  );

  it('przycina nadmiarowe Kwoty i Wzmianki o dacie do limitu zamiast ponawiać Próbę', async () => {
    // Schemat dla Gemini nie ma maxItems tych list (Gemini odrzuca duże maxItems), więc
    // model może zwrócić ich więcej — Worker zostawia pierwsze, bez kosztownej ponownej Próby.
    const output = generatedResult();
    const model = fakeModel(
      ok({
        ...output,
        amounts: Array.from({ length: 70 }, (_, i) => ({
          value: i,
          currency: 'PLN',
          context: `k${i}`,
        })),
        dates: Array.from({ length: 50 }, (_, i) => ({ date: '2026', context: `d${i}` })),
      }),
    );

    const response = await handleRequest(analyzeRequest(validBody), configWith(model));

    expect(response.status).toBe(200);
    expect(model.calls).toHaveLength(1);
    const result = (await response.json()) as Result;
    expect(result.amounts).toHaveLength(MAX_AMOUNTS);
    expect(result.amounts[0]?.context).toBe('k0');
    expect(result.dates).toHaveLength(MAX_DATE_MENTIONS);
  });

  it('po dwóch złych odpowiedziach zwraca 502 INVALID_RESULT bez trzeciej próby', async () => {
    const bad: ModelResponse = { ok: true, text: 'to nie jest JSON' };
    const model = fakeModel(bad, bad);

    const response = await handleRequest(analyzeRequest(validBody), configWith(model));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'INVALID_RESULT' });
    expect(model.calls).toHaveLength(2);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEMO_ORIGIN);
  });

  it('przy błędzie dostawcy zwraca 502 AI_PROVIDER_ERROR bez ponawiania', async () => {
    const model = fakeModel({ ok: false, error: 'NETWORK_ERROR' });

    const response = await handleRequest(analyzeRequest(validBody), configWith(model));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'AI_PROVIDER_ERROR' });
    expect(model.calls).toHaveLength(1);
  });

  it('przy wyczerpanym limicie dostawcy AI zwraca 503 AI_QUOTA_EXCEEDED bez ponawiania', async () => {
    const model = fakeModel({ ok: false, error: 'RATE_LIMITED' });

    const response = await handleRequest(analyzeRequest(validBody), configWith(model));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'AI_QUOTA_EXCEEDED' });
    expect(model.calls).toHaveLength(1);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEMO_ORIGIN);
  });

  it('zwraca Wynik zgodny ze schematem', async () => {
    const response = await handleRequest(analyzeRequest(validBody), config);

    const parsed = resultSchema.safeParse(await response.json());
    expect(parsed.error).toBeUndefined();
  });

  it('ustawia nagłówek CORS dla dozwolonego originu', async () => {
    const response = await handleRequest(analyzeRequest(validBody), config);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEMO_ORIGIN);
  });

  it('dopuszcza localhost na dowolnym porcie, gdy konfiguracja ma wildcard portu', async () => {
    const response = await handleRequest(
      analyzeRequest(validBody, 'http://localhost:5173'),
      config,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('odrzuca localhost 403, gdy konfiguracja (produkcyjna) go nie dopuszcza', async () => {
    const productionConfig = { ...config, allowedOrigins: [DEMO_ORIGIN] };

    const response = await handleRequest(
      analyzeRequest(validBody, 'http://localhost:5173'),
      productionConfig,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'ORIGIN_NOT_ALLOWED' });
  });

  it('zwraca 403 dla niedozwolonego originu', async () => {
    const response = await handleRequest(analyzeRequest(validBody, 'https://evil.example'), config);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'ORIGIN_NOT_ALLOWED' });
  });

  it('zwraca 403 bez nagłówka Origin', async () => {
    const request = new Request('https://worker.example/analyze', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await handleRequest(request, config);

    expect(response.status).toBe(403);
  });

  it('zwraca 400 dla ciała, które nie jest poprawnym JSON-em', async () => {
    const request = new Request('https://worker.example/analyze', {
      method: 'POST',
      headers: { Origin: DEMO_ORIGIN },
      body: '{nie json',
    });

    const response = await handleRequest(request, config);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_INPUT' });
  });

  it('zwraca 400 dla brakujących pól', async () => {
    const response = await handleRequest(analyzeRequest({ text: 'x' }), config);

    expect(response.status).toBe(400);
  });

  it('zwraca 400 EMPTY_TEXT dla tekstu pustego po przycięciu, bez wywołania modelu', async () => {
    const model = fakeModel();

    const response = await handleRequest(
      analyzeRequest({ ...validBody, text: ' \n\t ' }),
      configWith(model),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'EMPTY_TEXT' });
    expect(model.calls).toHaveLength(0);
  });

  it('przyjmuje tekst o długości dokładnie 500 000 znaków', async () => {
    const response = await handleRequest(
      analyzeRequest({ ...validBody, text: 'a'.repeat(500_000) }),
      config,
    );

    expect(response.status).toBe(200);
  });

  it('zwraca 413 TEXT_TOO_LONG dla tekstu dłuższego niż 500 000 znaków, bez wywołania modelu', async () => {
    const model = fakeModel();

    const response = await handleRequest(
      analyzeRequest({ ...validBody, text: 'a'.repeat(500_001) }),
      configWith(model),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'TEXT_TOO_LONG' });
    expect(model.calls).toHaveLength(0);
  });

  it('przyjmuje maksymalny tekst złożony z samych znaków ucieczki JSON', async () => {
    // Każdy znak sterujący to w JSON-ie 6 bajtów (\u0001) — najgorszy przypadek rozmiaru ciała.
    const text = 'a' + '\u0001'.repeat(499_999);

    const response = await handleRequest(analyzeRequest({ ...validBody, text }), config);

    expect(response.status).toBe(200);
  });

  it('zwraca 413 PAYLOAD_TOO_LARGE dla ciała większego niż dopuszczalne, bez wywołania modelu', async () => {
    const model = fakeModel();
    const body = { ...validBody, fileName: 'a'.repeat(4 * 1024 * 1024) };

    const response = await handleRequest(analyzeRequest(body), configWith(model));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'PAYLOAD_TOO_LARGE' });
    expect(model.calls).toHaveLength(0);
  });
});

describe('limit Analiz na adres IP', () => {
  it.each([
    ['minutowy', 'minute', 42, 'MINUTE_RATE_LIMITED'],
    ['dobowy', 'day', 34_452, 'DAILY_RATE_LIMITED'],
  ] as const)(
    'po przekroczeniu limitu (%s) zwraca 429 z odrębnym kodem i Retry-After, bez wywołania modelu',
    async (_, window, retryAfterSeconds, code) => {
      const model = fakeModel();
      const rateLimiter = fakeRateLimiter({ ok: false, window, retryAfterSeconds });

      const response = await handleRequest(
        analyzeRequest(validBody),
        configWith(model, rateLimiter),
      );

      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({ error: code });
      expect(response.headers.get('Retry-After')).toBe(String(retryAfterSeconds));
      expect(model.calls).toHaveLength(0);
      expect(rateLimiter.calls).toEqual([CLIENT_IP]);
    },
  );

  it('udostępnia przeglądarce nagłówek Retry-After przez CORS', async () => {
    const rateLimiter = fakeRateLimiter({ ok: false, window: 'minute', retryAfterSeconds: 42 });

    const response = await handleRequest(
      analyzeRequest(validBody),
      configWith(fakeModel(), rateLimiter),
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEMO_ORIGIN);
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
  });

  it('liczy Analizę z adresu IP klienta, gdy limit nie jest przekroczony', async () => {
    const rateLimiter = fakeRateLimiter();

    const response = await handleRequest(
      analyzeRequest(validBody),
      configWith(fakeModel(ok(generatedResult())), rateLimiter),
    );

    expect(response.status).toBe(200);
    expect(rateLimiter.calls).toEqual([CLIENT_IP]);
  });

  it('nie zużywa limitu na żądanie odrzucone walidacją', async () => {
    const rateLimiter = fakeRateLimiter();

    await handleRequest(
      analyzeRequest({ ...validBody, text: '  ' }),
      configWith(fakeModel(), rateLimiter),
    );

    expect(rateLimiter.calls).toHaveLength(0);
  });
});

describe('preflight OPTIONS', () => {
  it('zwraca 204 z nagłówkami CORS dla dozwolonego originu', async () => {
    const request = new Request('https://worker.example/analyze', {
      method: 'OPTIONS',
      headers: {
        Origin: DEMO_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    const response = await handleRequest(request, config);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEMO_ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain(
      'content-type',
    );
  });

  it('zwraca 403 dla niedozwolonego originu', async () => {
    const request = new Request('https://worker.example/analyze', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });

    const response = await handleRequest(request, config);

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('inne ścieżki i metody', () => {
  it('zwraca 404 dla nieznanej ścieżki', async () => {
    const request = new Request('https://worker.example/other', {
      method: 'POST',
      headers: { Origin: DEMO_ORIGIN },
    });

    const response = await handleRequest(request, config);

    expect(response.status).toBe(404);
  });

  it('zwraca 405 dla GET /analyze', async () => {
    const request = new Request('https://worker.example/analyze', {
      headers: { Origin: DEMO_ORIGIN },
    });

    const response = await handleRequest(request, config);

    expect(response.status).toBe(405);
  });
});
