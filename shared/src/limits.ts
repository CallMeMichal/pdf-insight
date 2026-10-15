/** Maksymalny rozmiar wgrywanego PDF-a (limit obowiązuje w web). */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Maksymalna długość tekstu Dokumentu (limit obowiązuje w web i w Workerze). */
export const MAX_TEXT_LENGTH = 500_000;

/**
 * Limity Analiz na adres IP (Worker; web pokazuje je w komunikatach). Limit minutowy egzekwuje
 * binding Rate Limiting, więc musi zgadzać się z `simple.limit` w `worker/wrangler.toml`.
 */
export const ANALYSES_PER_MINUTE = 5;
export const ANALYSES_PER_DAY = 30;

/** Dozwolona liczba punktów kluczowych w Wyniku. */
export const MIN_KEY_POINTS = 3;
export const MAX_KEY_POINTS = 7;

/** Schemat dopuszcza pustą listę; prompt prosi model o co najmniej 3 słowa kluczowe. */
export const MAX_KEYWORDS = 10;

/**
 * Maksymalna liczba Kwot i Wzmianek o dacie w Wyniku. Czas Analizy zależy głównie od długości
 * odpowiedzi modelu (~500 tokenów/s), więc bez limitu dokument z setkami kwot nie mieści się
 * w 30 s. Przy nadmiarze model wybiera najważniejsze.
 */
export const MAX_AMOUNTS = 60;
export const MAX_DATE_MENTIONS = 40;

/** Wersja schematu Wyniku zapisywana w `meta.schemaVersion`. */
export const SCHEMA_VERSION = 1;
