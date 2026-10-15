import type { AnalyzeErrorCode } from '@pdf-insight/shared';

/**
 * Kod błędu z Workera albo błąd wykryty w przeglądarce: sieć, nieoczekiwany status
 * lub odpowiedź, która nie jest Wynikiem zgodnym ze schematem.
 */
export type ClientErrorCode =
  AnalyzeErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | `HTTP_${number}`;

export class AnalyzeError extends Error {
  readonly code: ClientErrorCode;
  /** Po ilu sekundach można spróbować ponownie (nagłówek `Retry-After` przy limicie Analiz). */
  readonly retryAfterSeconds: number | null;

  constructor(code: ClientErrorCode, retryAfterSeconds: number | null = null) {
    super(`Analiza nie powiodła się: ${code}`);
    this.name = 'AnalyzeError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
