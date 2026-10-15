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
  /** Model dwukrotnie zwrócił odpowiedź, która nie jest poprawnym Wynikiem. */
  | 'INVALID_RESULT'
  /** Błąd dostawcy AI (sieć, przekroczony czas, odmowa, błąd po stronie dostawcy). */
  | 'AI_PROVIDER_ERROR'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED';
