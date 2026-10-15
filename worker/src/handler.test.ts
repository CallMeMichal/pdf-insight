import { describe, expect, it } from 'vitest';
import { resultSchema, type Result } from '@pdf-insight/shared';
import { handleRequest, type HandlerConfig } from './handler';
import type { ModelAdapter, ModelResponse } from './model';

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

function configWith(model: ModelAdapter): HandlerConfig {
  return { allowedOrigins: [DEMO_ORIGIN, 'http://localhost:*'], model };
}

/** Konfiguracja dla testów, w których model zawsze odpowiada poprawnie. */
const config = configWith({
  modelName: MODEL_NAME,
  generate: () => Promise.resolve(ok(generatedResult())),
});

function analyzeRequest(body: unknown, origin = DEMO_ORIGIN): Request {
  return new Request('https://worker.example/analyze', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
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
