import {
  resultSchema,
  type AnalyzeErrorCode,
  type AnalyzeRequest,
  type Result,
} from '@pdf-insight/shared';
import { AnalyzeError } from './errors';

const API_URL = import.meta.env.VITE_API_URL.replace(/\/+$/, '');

function parseRetryAfter(response: Response): number | null {
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

/** Wysyła tekst Dokumentu do Workera i zwraca Wynik zwalidowany schematem. */
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
    throw new AnalyzeError(code, parseRetryAfter(response));
  }

  // Wynik niezgodny ze schematem nigdy nie trafia do widoku.
  const body: unknown = await response.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) throw new AnalyzeError('INVALID_RESPONSE');
  return parsed.data;
}
