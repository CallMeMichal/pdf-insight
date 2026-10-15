/** Maksymalny rozmiar wgrywanego PDF-a (limit obowiązuje w web). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maksymalna długość tekstu Dokumentu (limit obowiązuje w web i w Workerze). */
export const MAX_TEXT_LENGTH = 500_000;

/** Dozwolona liczba punktów kluczowych w Wyniku. */
export const MIN_KEY_POINTS = 3;
export const MAX_KEY_POINTS = 7;

/** Schemat dopuszcza pustą listę; prompt prosi model o co najmniej 3 słowa kluczowe. */
export const MAX_KEYWORDS = 10;

/** Wersja schematu Wyniku zapisywana w `meta.schemaVersion`. */
export const SCHEMA_VERSION = 1;
