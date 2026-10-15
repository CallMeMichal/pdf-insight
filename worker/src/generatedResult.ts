import { z } from 'zod';
import {
  amountSchema,
  dateMentionSchema,
  MAX_AMOUNTS,
  MAX_DATE_MENTIONS,
  resultSchema,
} from '@pdf-insight/shared';

/**
 * Część Wyniku, którą generuje model: bez `meta`, `document.fileName` i `document.pages` —
 * te dokłada Worker z żądania, bo muszą pochodzić z pliku, nie z AI.
 */
export const generatedResultSchema = resultSchema.omit({ meta: true }).extend({
  document: resultSchema.shape.document.omit({ fileName: true, pages: true }),
});

export type GeneratedResult = z.infer<typeof generatedResultSchema>;

/**
 * Schemat odpowiedzi wysyłany do Gemini: jak `generatedResultSchema`, ale bez limitu długości
 * list Kwot i Wzmianek o dacie. Gemini odrzuca schemat z `maxItems` rzędu kilkudziesięciu
 * (400 INVALID_ARGUMENT), więc limit egzekwuje prompt i `truncateLists`.
 */
export const modelResponseSchema = generatedResultSchema.extend({
  amounts: z.array(amountSchema),
  dates: z.array(dateMentionSchema),
});

/**
 * Przycina listy Kwot i Wzmianek o dacie do limitu Wyniku. Nadmiar to nie błąd modelu wart
 * ponownej Próby (ta podwoiłaby czas Analizy) — prompt każe wymieniać najważniejsze najpierw.
 */
export function truncateLists(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const { amounts, dates } = raw as Record<string, unknown>;
  return {
    ...raw,
    ...(Array.isArray(amounts) && { amounts: amounts.slice(0, MAX_AMOUNTS) }),
    ...(Array.isArray(dates) && { dates: dates.slice(0, MAX_DATE_MENTIONS) }),
  };
}
