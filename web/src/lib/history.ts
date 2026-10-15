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
  function list(): HistoryEntry[] {
    try {
      return parseEntries(getStorage().getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  }

  /** Nowa lista powstaje wewnątrz `try`, bo `crypto.randomUUID` nie istnieje poza HTTPS. */
  function save(nextEntries: () => HistoryEntry[]): HistoryEntry[] {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(nextEntries()));
    } catch {
      // Zapis się nie udał — zostaje to, co było zapisane wcześniej.
    }
    return list();
  }

  function add(result: Result): HistoryEntry[] {
    return save(() =>
      [{ id: crypto.randomUUID(), result }, ...list()].slice(0, MAX_HISTORY_ENTRIES),
    );
  }

  function remove(id: string): HistoryEntry[] {
    return save(() => list().filter((entry) => entry.id !== id));
  }

  function clear(): HistoryEntry[] {
    return save(() => []);
  }

  return { list, add, remove, clear };
}
