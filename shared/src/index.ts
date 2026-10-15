export * from './limits';
export * from './result';

/** Ciało żądania `POST /analyze`. */
export interface AnalyzeRequest {
  text: string;
  fileName: string;
  pages: number;
}

/** Maszynowy kod błędu w ciele odpowiedzi Workera (`{ error: AnalyzeErrorCode }`). */
export type AnalyzeErrorCode =
  | 'ORIGIN_NOT_ALLOWED'
  | 'INVALID_INPUT'
  /** Tekst Dokumentu jest pusty po przycięciu białych znaków. */
  | 'EMPTY_TEXT'
  /** Tekst Dokumentu jest dłuższy niż `MAX_TEXT_LENGTH` znaków. */
  | 'TEXT_TOO_LONG'
  /** Ciało żądania jest większe, niż pozwala limit długości tekstu. */
  | 'PAYLOAD_TOO_LARGE'
  /** Model dwukrotnie zwrócił odpowiedź, która nie jest poprawnym Wynikiem. */
  | 'INVALID_RESULT'
  /** Błąd dostawcy AI (sieć, przekroczony czas, odmowa, błąd po stronie dostawcy). */
  | 'AI_PROVIDER_ERROR'
  /** Wyczerpany limit dostawcy AI, wspólny dla wszystkich użytkowników; stan przejściowy. */
  | 'AI_QUOTA_EXCEEDED'
  /** Przekroczony minutowy limit Analiz z adresu IP; czas oczekiwania w nagłówku `Retry-After`. */
  | 'MINUTE_RATE_LIMITED'
  /** Przekroczony dobowy limit Analiz z adresu IP; czas oczekiwania w nagłówku `Retry-After`. */
  | 'DAILY_RATE_LIMITED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED';
