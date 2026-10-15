import type { AnalyzeErrorCode, AnalyzeRequest, Result } from '@pdf-insight/shared';

/** Kod błędu z Workera albo błąd po stronie przeglądarki (sieć, nieoczekiwany status). */
export type ClientErrorCode = AnalyzeErrorCode | 'NETWORK_ERROR' | `HTTP_${number}`;

const API_URL = import.meta.env.VITE_API_URL.replace(/\/+$/, '');

export class AnalyzeError extends Error {
  readonly code: ClientErrorCode;

  constructor(code: ClientErrorCode) {
    super(`Analiza nie powiodła się: ${code}`);
    this.name = 'AnalyzeError';
    this.code = code;
  }
}

/** Wysyła tekst Dokumentu do Workera i zwraca Wynik. */
export async function analyze(request: AnalyzeRequest): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new AnalyzeError('NETWORK_ERROR');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? (body.error as AnalyzeErrorCode)
        : (`HTTP_${response.status}` as const);
    throw new AnalyzeError(code);
  }

  return (await response.json()) as Result;
}
