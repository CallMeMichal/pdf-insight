import { describe, expect, it } from 'vitest';
import { resultSchema, type Result } from './result';

/** Pełny, poprawny Wynik — punkt wyjścia dla przypadków niepoprawnych. */
function validResult(): Result {
  return {
    document: {
      fileName: 'umowa.pdf',
      pages: 12,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa o świadczenie usług nr 14/2026',
      date: '2026-03-02',
    },
    summary:
      'Umowa dotyczy świadczenia usług. Strony ustalają wynagrodzenie. Umowa obowiązuje rok.',
    keyPoints: ['Wynagrodzenie miesięczne', 'Okres obowiązywania 12 miesięcy', 'Kary umowne'],
    entities: {
      organizations: ['Przykładowa Spółka z o.o.'],
      people: ['Jan Kowalski'],
    },
    amounts: [{ value: 12500.5, currency: 'PLN', context: 'abonament miesięczny netto' }],
    dates: [{ date: '2026-04-01', context: 'początek świadczenia usług' }],
    keywords: ['umowa', 'usługi IT'],
    meta: {
      analyzedAt: '2026-10-15T12:34:56.789Z',
      model: 'gemini-flash',
      schemaVersion: 1,
    },
  };
}

describe('resultSchema — poprawne Wyniki', () => {
  it('akceptuje pełny Wynik', () => {
    expect(resultSchema.safeParse(validResult()).success).toBe(true);
  });

  it('akceptuje Wynik bez danych: puste listy i null', () => {
    const result = validResult();
    result.document.title = null;
    result.document.date = null;
    result.entities = { organizations: [], people: [] };
    result.amounts = [];
    result.dates = [];
    result.keywords = [];

    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it.each(['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'XAU'])('akceptuje kod waluty %s', (currency) => {
    const result = validResult();
    result.amounts = [{ value: 100, currency, context: 'kwota' }];

    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it.each(['2026-03-02', '2026-03', '2026'])('akceptuje datę w precyzji %s', (date) => {
    const result = validResult();
    result.document.date = date;
    result.dates = [{ date, context: 'data' }];

    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it.each([3, 7])('akceptuje %i punktów kluczowych', (count) => {
    const result = validResult();
    result.keyPoints = Array.from({ length: count }, (_, i) => `Punkt ${i + 1}`);

    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it('akceptuje 10 słów kluczowych', () => {
    const result = validResult();
    result.keywords = Array.from({ length: 10 }, (_, i) => `słowo ${i + 1}`);

    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it('akceptuje 60 Kwot i 40 Wzmianek o dacie', () => {
    const result = validResult();
    result.amounts = Array.from({ length: 60 }, (_, i) => ({
      value: i,
      currency: 'PLN',
      context: `kwota ${i + 1}`,
    }));
    result.dates = Array.from({ length: 40 }, (_, i) => ({
      date: '2026',
      context: `data ${i + 1}`,
    }));

    expect(resultSchema.safeParse(result).success).toBe(true);
  });

  it('akceptuje 29 lutego w roku przestępnym', () => {
    const result = validResult();
    result.document.date = '2028-02-29';

    expect(resultSchema.safeParse(result).success).toBe(true);
  });
});

describe('resultSchema — niepoprawne Wyniki', () => {
  function expectInvalid(mutate: (result: Result) => void) {
    const result = validResult();
    mutate(result);
    expect(resultSchema.safeParse(result).success).toBe(false);
  }

  it('odrzuca Wynik bez wymaganego pola', () => {
    expectInvalid((result) => {
      delete (result as Partial<Result>).summary;
    });
  });

  it('odrzuca Wynik bez meta', () => {
    expectInvalid((result) => {
      delete (result as Partial<Result>).meta;
    });
  });

  it('odrzuca typ dokumentu spoza wyliczenia', () => {
    expectInvalid((result) => {
      (result.document as { type: string }).type = 'list';
    });
  });

  it.each(['pln', 'PL', 'PLNN', 'zł', ''])('odrzuca kod waluty %j', (currency) => {
    expectInvalid((result) => {
      result.amounts = [{ value: 100, currency, context: 'kwota' }];
    });
  });

  it.each(['PL', 'pol', 'p', 'pl-PL', ''])('odrzuca kod języka %j', (language) => {
    expectInvalid((result) => {
      result.document.language = language;
    });
  });

  it.each([
    '02.03.2026',
    '2026/03/02',
    '26-03-02',
    '2026-3-2',
    '2026-13',
    '2026-02-30',
    '2026-02-29',
    '2026-03-02T10:00:00Z',
    'I kwartał 2027',
    '',
  ])('odrzuca datę %j', (date) => {
    expectInvalid((result) => {
      result.document.date = date;
    });
    expectInvalid((result) => {
      result.dates = [{ date, context: 'data' }];
    });
  });

  it.each([2, 8])('odrzuca %i punktów kluczowych', (count) => {
    expectInvalid((result) => {
      result.keyPoints = Array.from({ length: count }, (_, i) => `Punkt ${i + 1}`);
    });
  });

  it('odrzuca więcej niż 10 słów kluczowych', () => {
    expectInvalid((result) => {
      result.keywords = Array.from({ length: 11 }, (_, i) => `słowo ${i + 1}`);
    });
  });

  it.each([0, -1, 1.5])('odrzuca liczbę stron %d', (pages) => {
    expectInvalid((result) => {
      result.document.pages = pages;
    });
  });

  it.each(['', '   '])('odrzuca puste podsumowanie %j', (summary) => {
    expectInvalid((result) => {
      result.summary = summary;
    });
  });

  it.each(['2026-10-15', '15.10.2026 12:00', 'wczoraj'])(
    'odrzuca meta.analyzedAt %j, które nie jest datą i czasem ISO 8601',
    (analyzedAt) => {
      expectInvalid((result) => {
        result.meta.analyzedAt = analyzedAt;
      });
    },
  );

  it.each([0, 1.5])('odrzuca wersję schematu %d', (schemaVersion) => {
    expectInvalid((result) => {
      result.meta.schemaVersion = schemaVersion;
    });
  });
});
