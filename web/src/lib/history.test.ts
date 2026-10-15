import { describe, expect, it } from 'vitest';
import type { Result } from '@pdf-insight/shared';
import { createHistoryStore, type HistoryStorage } from './history';

/** Pamięć w stylu `localStorage` — każdy magazyn Historii nad nią widzi to samo co po odświeżeniu. */
function memoryStorage(): HistoryStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function result(fileName: string): Result {
  return {
    document: {
      fileName,
      pages: 3,
      language: 'pl',
      type: 'faktura',
      title: null,
      date: '2026-10',
    },
    summary: 'Faktura za usługi.',
    keyPoints: ['Termin płatności 14 dni', 'Płatność przelewem', 'Jedna pozycja'],
    entities: { organizations: [], people: [] },
    amounts: [],
    dates: [],
    keywords: [],
    meta: { analyzedAt: '2026-10-15T12:34:56.789Z', model: 'gemini-flash', schemaVersion: 1 },
  };
}

function fileNames(entries: { result: Result }[]): string[] {
  return entries.map((entry) => entry.result.document.fileName);
}

describe('createHistoryStore', () => {
  it('na początku Historia jest pusta', () => {
    const storage = memoryStorage();
    expect(createHistoryStore(() => storage).list()).toEqual([]);
  });

  it('zapisany Wynik jest w Historii po odświeżeniu strony', () => {
    const storage = memoryStorage();
    createHistoryStore(() => storage).add(result('faktura.pdf'));

    const afterReload = createHistoryStore(() => storage).list();
    expect(afterReload).toHaveLength(1);
    expect(afterReload[0]?.result).toEqual(result('faktura.pdf'));
  });

  it('najnowszy Wynik jest na górze', () => {
    const storage = memoryStorage();
    const history = createHistoryStore(() => storage);
    history.add(result('pierwszy.pdf'));
    history.add(result('drugi.pdf'));

    expect(fileNames(history.list())).toEqual(['drugi.pdf', 'pierwszy.pdf']);
  });

  it('jedenasty Wynik wypiera najstarszy', () => {
    const storage = memoryStorage();
    const history = createHistoryStore(() => storage);
    for (let i = 1; i <= 11; i += 1) history.add(result(`${i}.pdf`));

    expect(fileNames(history.list())).toEqual([
      '11.pdf',
      '10.pdf',
      '9.pdf',
      '8.pdf',
      '7.pdf',
      '6.pdf',
      '5.pdf',
      '4.pdf',
      '3.pdf',
      '2.pdf',
    ]);
  });

  it('usuwa pojedynczy wpis, także ten sam Wynik przeanalizowany drugi raz', () => {
    const storage = memoryStorage();
    const history = createHistoryStore(() => storage);
    history.add(result('umowa.pdf'));
    history.add(result('faktura.pdf'));
    const [newest] = history.add(result('umowa.pdf'));

    expect(fileNames(history.remove(newest?.id ?? ''))).toEqual(['faktura.pdf', 'umowa.pdf']);
    expect(fileNames(createHistoryStore(() => storage).list())).toEqual([
      'faktura.pdf',
      'umowa.pdf',
    ]);
  });

  it('czyści całą Historię', () => {
    const storage = memoryStorage();
    const history = createHistoryStore(() => storage);
    history.add(result('umowa.pdf'));
    history.add(result('faktura.pdf'));

    expect(history.clear()).toEqual([]);
    expect(createHistoryStore(() => storage).list()).toEqual([]);
  });

  it('pomija wpisy niezgodne ze schematem Wyniku', () => {
    const storage = memoryStorage();
    const history = createHistoryStore(() => storage);
    history.add(result('dobry.pdf'));
    const [key] = storage.items.keys();
    const stored = JSON.parse(storage.items.get(key ?? '') ?? '[]') as unknown[];
    const withoutMeta: Partial<Result> = result('bez-meta.pdf');
    delete withoutMeta.meta;
    storage.items.set(
      key ?? '',
      JSON.stringify([
        { id: 'a', result: withoutMeta },
        { id: 'b', result: { ...result('zly-typ.pdf'), document: { type: 'list' } } },
        { result: result('bez-id.pdf') },
        'tekst',
        null,
        ...stored,
      ]),
    );

    expect(fileNames(history.list())).toEqual(['dobry.pdf']);
  });

  it.each(['{nie json', '{"wpisy":[]}', '"tekst"', 'null'])(
    'uszkodzona Historia (%s) jest traktowana jak pusta',
    (raw) => {
      const storage = memoryStorage();
      const history = createHistoryStore(() => storage);
      history.add(result('faktura.pdf'));
      const [key] = storage.items.keys();
      storage.items.set(key ?? '', raw);

      expect(history.list()).toEqual([]);
      expect(fileNames(history.add(result('nowa.pdf')))).toEqual(['nowa.pdf']);
    },
  );
});

describe('createHistoryStore — zablokowany storage', () => {
  it('bez dostępu do storage Historia jest pusta, a operacje nie rzucają wyjątków', () => {
    const history = createHistoryStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(history.list()).toEqual([]);
    expect(history.add(result('faktura.pdf'))).toEqual([]);
    expect(history.remove('a')).toEqual([]);
    expect(history.clear()).toEqual([]);
  });

  it('gdy zapis się nie udaje, Historia pokazuje to, co faktycznie jest zapisane', () => {
    const storage = memoryStorage();
    const history = createHistoryStore(() => storage);
    history.add(result('stary.pdf'));
    const failingWrite = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    storage.setItem = failingWrite;
    storage.removeItem = failingWrite;

    expect(fileNames(history.add(result('nowy.pdf')))).toEqual(['stary.pdf']);
    expect(fileNames(history.clear())).toEqual(['stary.pdf']);
  });

  it('gdy odczyt się nie udaje, Historia jest pusta', () => {
    const storage = memoryStorage();
    storage.getItem = () => {
      throw new DOMException('Access denied', 'SecurityError');
    };

    expect(createHistoryStore(() => storage).list()).toEqual([]);
  });
});
