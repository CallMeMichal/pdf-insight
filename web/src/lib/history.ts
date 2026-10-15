import { resultSchema, type Result } from '@pdf-insight/shared';

/** Ta część `localStorage`, której używa Historia — w testach zastępowana pamięcią. */
export type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface HistoryEntry {
  id: string;
  result: Result;
}

const STORAGE_KEY = 'pdf-insight.history';
/** Jedenasty Wynik wypiera najstarszy. */
export const MAX_HISTORY_ENTRIES = 10;

/** Wpis zapisany przez starszą wersję aplikacji albo zmieniony ręcznie nie przechodzi walidacji. */
function parseEntry(data: unknown): HistoryEntry | null {
  if (typeof data !== 'object' || data === null) return null;
  const { id, result } = data as Record<string, unknown>;
  if (typeof id !== 'string') return null;
  const parsed = resultSchema.safeParse(result);
  return parsed.success ? { id, result: parsed.data } : null;
}

function parseEntries(raw: string | null): HistoryEntry[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map(parseEntry).filter((entry) => entry !== null);
}

/**
 * Historia (`History`) w pamięci przeglądarki: tylko Wyniki, nigdy tekst Dokumentu.
 *
 * Storage bywa zablokowany (tryb prywatny, ustawienia przeglądarki) albo pełny, więc żadna operacja
 * nie rzuca wyjątku — aplikacja działa wtedy normalnie, tylko bez Historii. `getStorage` jest
 * wywoływane przy każdym dostępie, bo już samo odwołanie do `localStorage` potrafi rzucić wyjątek.
 * Każda operacja zwraca listę wpisów, która faktycznie jest zapisana, od najnowszego.
 */
export function createHistoryStore(getStorage: () => HistoryStorage) {
  function read(storage: HistoryStorage): HistoryEntry[] {
    return parseEntries(storage.getItem(STORAGE_KEY));
  }

  function list(): HistoryEntry[] {
    try {
      return read(getStorage());
    } catch {
      return [];
    }
  }

  /**
   * Zmienia zapisaną listę. Nieudany odczyt przerywa zmianę, żeby nie nadpisać Historii, której
   * nie widać. `crypto.randomUUID` też jest w `try`, bo poza bezpiecznym kontekstem go nie ma.
   */
  function save(change: (entries: HistoryEntry[]) => HistoryEntry[]): HistoryEntry[] {
    try {
      const storage = getStorage();
      storage.setItem(STORAGE_KEY, JSON.stringify(change(read(storage))));
    } catch {
      // Zmiana się nie udała — zostaje to, co było zapisane wcześniej.
    }
    return list();
  }

  function add(result: Result): HistoryEntry[] {
    return save((entries) =>
      [{ id: crypto.randomUUID(), result }, ...entries].slice(0, MAX_HISTORY_ENTRIES),
    );
  }

  function remove(id: string): HistoryEntry[] {
    return save((entries) => entries.filter((entry) => entry.id !== id));
  }

  function clear(): HistoryEntry[] {
    return save(() => []);
  }

  return { list, add, remove, clear };
}
