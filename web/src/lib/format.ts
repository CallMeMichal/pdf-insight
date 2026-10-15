import type { Amount, DocumentType, Result } from '@pdf-insight/shared';

const LOCALE = 'pl-PL';

/**
 * Kwota po polsku: separator tysięcy, przecinek dziesiętny i symbol waluty (`zł`, `€`) albo
 * jej kod. Domyślny format `pl-PL` nie grupuje liczb czterocyfrowych, stąd `useGrouping`.
 */
export function formatAmount({ value, currency }: Amount): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    useGrouping: 'always',
  }).format(value);
}

const DAY_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Data zapisana z precyzją podaną w Dokumencie (`YYYY-MM-DD`, `YYYY-MM`, `YYYY`) w czytelnej
 * formie bez dopowiadania brakujących części: „12 marca 2026”, „marzec 2026”, „2026”.
 */
export function formatPartialDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (month === undefined) return date;
  // Strefa UTC po obu stronach, żeby strefa przeglądarki nie przesunęła dnia.
  const utc = Date.UTC(year ?? 0, month - 1, day ?? 1);
  return (day === undefined ? MONTH_FORMAT : DAY_FORMAT).format(utc);
}

const PAGE_PLURALS = new Intl.PluralRules(LOCALE);
const PAGE_WORDS: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: 'strona',
  few: 'strony',
};

/** Liczba stron z polską odmianą: „1 strona”, „2 strony”, „5 stron”. */
export function formatPages(pages: number): string {
  return `${pages} ${PAGE_WORDS[PAGE_PLURALS.select(pages)] ?? 'stron'}`;
}

/** Nazwa pobieranego pliku Wyniku: nazwa PDF-a z rozszerzeniem `.json` zamiast `.pdf`. */
export function exportFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '').trim();
  return `${base || 'wynik'}.json`;
}

const LANGUAGE_NAMES = new Intl.DisplayNames(LOCALE, { type: 'language' });

/** Nazwa Języka dokumentu po polsku („polski”, „angielski”); nieznany kod zostaje bez zmian. */
export function formatLanguage(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short' });

/** Moment Analizy (`meta.analyzedAt`) w strefie czasowej przeglądarki. */
export function formatDateTime(isoDateTime: string): string {
  return DATE_TIME_FORMAT.format(new Date(isoDateTime));
}

/** Typ dokumentu w formie do wyświetlenia. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
};

/** Wynik jako sformatowany JSON — ta sama treść w podglądzie i w pobranym pliku. */
export function resultToJson(result: Result): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
