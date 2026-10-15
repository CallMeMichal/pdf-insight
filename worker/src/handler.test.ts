import { describe, expect, it } from 'vitest';
import { resultSchema, type Result } from '@pdf-insight/shared';
import { handleRequest, type HandlerConfig } from './handler';

const DEMO_ORIGIN = 'https://callmemichal.github.io';

const config: HandlerConfig = {
  allowedOrigins: [DEMO_ORIGIN, 'http://localhost:*'],
};

function analyzeRequest(body: unknown, origin = DEMO_ORIGIN): Request {
  return new Request('https://worker.example/analyze', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = { text: 'Treść umowy', fileName: 'umowa.pdf', pages: 3 };

describe('POST /analyze', () => {
  it('zwraca 200 i Wynik z fileName i pages z żądania', async () => {
    const response = await handleRequest(analyzeRequest(validBody), config);

    expect(response.status).toBe(200);
    const result = (await response.json()) as Result;
    expect(result.document.fileName).toBe('umowa.pdf');
    expect(result.document.pages).toBe(3);
    expect(typeof result.summary).toBe('string');
    expect(result.meta.schemaVersion).toBe(1);
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
