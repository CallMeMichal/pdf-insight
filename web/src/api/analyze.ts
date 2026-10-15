import type { AnalyzeRequest, Result } from '@pdf-insight/shared';

export class AnalyzeError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Analysis nie powiodła się: ${code}`);
    this.name = 'AnalyzeError';
    this.code = code;
  }
}

/** Wysyła tekst Documentu do Workera i zwraca Result. */
export async function analyze(request: AnalyzeRequest): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/analyze`, {
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
        ? body.error
        : `HTTP_${response.status}`;
    throw new AnalyzeError(code);
  }

  return (await response.json()) as Result;
}
