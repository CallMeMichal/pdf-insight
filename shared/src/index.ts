import { z } from 'zod';

export * from './limits';
export * from './result';

/** Ciało żądania `POST /analyze`. */
export const analyzeRequestSchema = z.object({
  text: z.string(),
  fileName: z.string(),
  pages: z.number().int().min(1),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/** Maszynowy kod błędu w ciele odpowiedzi Workera (`{ error: AnalyzeErrorCode }`). */
export type AnalyzeErrorCode =
  | 'ORIGIN_NOT_ALLOWED'
  | 'INVALID_INPUT'
  /** Tekst Dokumentu jest pusty po przycięciu białych znaków. */
  | 'EMPTY_TEXT'
  /** Tekst Dokumentu (albo całe ciało żądania) przekracza limit `MAX_TEXT_LENGTH`. */
  | 'TEXT_TOO_LONG'
  /** Model dwukrotnie zwrócił odpowiedź, która nie jest poprawnym Wynikiem. */
  | 'INVALID_RESULT'
  /** Błąd dostawcy AI (sieć, przekroczony czas, odmowa, błąd po stronie dostawcy). */
  | 'AI_PROVIDER_ERROR'
  /** Wyczerpany limit dostawcy AI, wspólny dla wszystkich użytkowników; stan przejściowy. */
  | 'AI_QUOTA_EXCEEDED'
  /** Przekroczony dobowy limit Analiz z adresu IP; czas oczekiwania w nagłówku `Retry-After`. */
  | 'DAILY_RATE_LIMITED'
  /** Inna ścieżka niż `/analyze` albo inna metoda niż `POST` i `OPTIONS`. */
  | 'NOT_FOUND';
