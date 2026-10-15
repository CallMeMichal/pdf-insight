/** Typowany błąd dostawcy AI zwracany przez adapter modelu. */
export type ModelErrorCode =
  /** Dostawca odrzucił żądanie z powodu wyczerpanego limitu (HTTP 429). */
  | 'RATE_LIMITED'
  /** Każdy inny błąd: sieć, przekroczony czas, odmowa odpowiedzi, HTTP 5xx. */
  | 'PROVIDER_ERROR';

export type ModelResponse = { ok: true; text: string } | { ok: false; error: ModelErrorCode };

/**
 * Wąski interfejs modelu AI: przyjmuje tekst Dokumentu i zwraca surową odpowiedź modelu
 * (tekst, który powinien być JSON-em Wyniku) albo typowany błąd. Nie rzuca wyjątków.
 */
export interface ModelAdapter {
  /** Nazwa modelu zapisywana w `meta.model`. */
  readonly modelName: string;
  generate(documentText: string, signal: AbortSignal): Promise<ModelResponse>;
}
