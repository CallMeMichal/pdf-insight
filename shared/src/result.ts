import { z } from 'zod';
import { ISO_4217_CODES } from './currencies';
import { MAX_KEY_POINTS, MAX_KEYWORDS, MIN_KEY_POINTS } from './limits';

export const documentTypeSchema = z.enum(['faktura', 'umowa', 'oferta', 'raport', 'inne']);

const PARTIAL_DATE = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(\d{2}))?)?$/;

function isPartialDate(value: string): boolean {
  const match = PARTIAL_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  if (day === undefined) return true;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Date.UTC przenosi nadmiarowe dni na kolejny miesiąc (30 lutego → 2 marca).
  return date.getUTCDate() === Number(day);
}

/**
 * Data ISO 8601 z precyzją podaną w Dokumencie: `YYYY-MM-DD`, `YYYY-MM` albo `YYYY`.
 * Pełna data musi istnieć w kalendarzu.
 */
export const partialDateSchema = z.string().refine(isPartialDate, {
  message: 'Oczekiwano daty w formacie YYYY-MM-DD, YYYY-MM lub YYYY',
});

export const amountSchema = z.object({
  value: z.number(),
  /** Kod waluty ISO 4217, np. `PLN` — istniejący, nie tylko trzy wielkie litery. */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .refine((code) => ISO_4217_CODES.has(code), { message: 'Nieznany kod waluty ISO 4217' }),
  context: z.string(),
});

export const dateMentionSchema = z.object({
  date: partialDateSchema,
  context: z.string(),
});

/** Wynik Analizy — jedyne źródło prawdy o jego kształcie, wspólne dla Workera i web. */
export const resultSchema = z.object({
  document: z.object({
    fileName: z.string(),
    pages: z.number().int().min(1),
    /** Język dokumentu jako kod ISO 639-1, np. `pl`. */
    language: z.string().regex(/^[a-z]{2}$/),
    type: documentTypeSchema,
    title: z.string().nullable(),
    date: partialDateSchema.nullable(),
  }),
  summary: z.string().refine((summary) => summary.trim() !== '', { message: 'Puste podsumowanie' }),
  keyPoints: z.array(z.string()).min(MIN_KEY_POINTS).max(MAX_KEY_POINTS),
  entities: z.object({
    organizations: z.array(z.string()),
    people: z.array(z.string()),
  }),
  /** Bez `.max()`: Gemini odrzuca duże `maxItems`, więc nadmiar przycina Worker. */
  amounts: z.array(amountSchema),
  dates: z.array(dateMentionSchema),
  keywords: z.array(z.string()).max(MAX_KEYWORDS),
  meta: z.object({
    analyzedAt: z.iso.datetime({ offset: true }),
    model: z.string(),
    schemaVersion: z.number().int().min(1),
  }),
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type DateMention = z.infer<typeof dateMentionSchema>;
export type Result = z.infer<typeof resultSchema>;
