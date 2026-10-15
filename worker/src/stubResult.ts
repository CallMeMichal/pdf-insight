import type { AnalyzeRequest, Result } from '@pdf-insight/shared';

/** Stały przykładowy Wynik zwracany, dopóki Worker nie odpytuje Gemini. */
export function stubResult({ fileName, pages }: AnalyzeRequest): Result {
  return {
    document: {
      fileName,
      pages,
      language: 'pl',
      type: 'umowa',
      title: 'Przykładowa umowa (zaślepka)',
      date: '2026-10-15',
    },
    summary:
      'To jest zaślepka Wyniku zwracana przez Worker. Prawdziwa Analiza przez Gemini pojawi się w kolejnym etapie. Nazwa pliku i liczba stron pochodzą z wgranego Dokumentu.',
    keyPoints: [
      'Przykładowy punkt pierwszy',
      'Przykładowy punkt drugi',
      'Przykładowy punkt trzeci',
    ],
    entities: {
      organizations: ['Przykładowa Spółka z o.o.'],
      people: ['Jan Kowalski'],
    },
    amounts: [{ value: 1000, currency: 'PLN', context: 'przykładowa kwota netto' }],
    dates: [{ date: '2026-10-15', context: 'przykładowa data zawarcia' }],
    keywords: ['zaślepka', 'przykład'],
    meta: {
      analyzedAt: new Date().toISOString(),
      model: 'stub',
      schemaVersion: 1,
    },
  };
}
