import { ANALYSES_PER_DAY, MAX_FILE_SIZE_MB, MAX_TEXT_LENGTH } from '@pdf-insight/shared';
import { AnalyzeError, type ClientErrorCode } from '../api/errors';
import { PdfReadError, type PdfProblem } from './pdfCheck';

export interface ErrorMessage {
  /** `warning`, gdy błąd nie wynika z pliku i wystarczy odczekać (limity). */
  tone: 'error' | 'warning';
  text: string;
  /** Czy ma sens ponowienie tej samej Analizy z zachowanym tekstem. */
  retryable: boolean;
}

const MAX_TEXT_LENGTH_LABEL = new Intl.NumberFormat('pl-PL', { useGrouping: 'always' }).format(
  MAX_TEXT_LENGTH,
);

const NO_TEXT =
  'Nie udało się odczytać tekstu z tego PDF-a. To najpewniej skan bez warstwy tekstowej, a takich dokumentów aplikacja nie obsługuje.';
const TEXT_TOO_LONG = `Dokument jest zbyt długi: ma ponad ${MAX_TEXT_LENGTH_LABEL} znaków tekstu. Wybierz krótszy PDF.`;

/** Ponowienie tej samej Analizy nic nie da — trzeba wybrać inny plik albo odczekać dłużej. */
function finalMessage(text: string, tone: ErrorMessage['tone'] = 'error'): ErrorMessage {
  return { tone, text, retryable: false };
}

function retryableMessage(text: string, tone: ErrorMessage['tone'] = 'error'): ErrorMessage {
  return { tone, text, retryable: true };
}

const PDF_MESSAGES: Record<PdfProblem, ErrorMessage> = {
  NO_FILE: finalMessage('Przeciągnięty element nie jest plikiem. Przeciągnij plik PDF.'),
  MULTIPLE_FILES: finalMessage(
    'Wybrano kilka plików. Analizowany jest jeden PDF naraz — wybierz jeden plik.',
  ),
  NOT_PDF: finalMessage('Ten plik nie jest PDF-em. Wybierz plik w formacie PDF.'),
  FILE_TOO_LARGE: finalMessage(
    `Plik jest większy niż ${MAX_FILE_SIZE_MB} MB. Wybierz mniejszy PDF.`,
  ),
  UNREADABLE_FILE: finalMessage(
    'Nie udało się odczytać pliku z dysku. Sprawdź, czy nadal istnieje, i wybierz go ponownie.',
  ),
  ENCRYPTED: finalMessage(
    'Ten PDF jest zabezpieczony hasłem. Zapisz go bez zabezpieczenia i wgraj ponownie.',
  ),
  CORRUPTED: finalMessage(
    'Nie udało się otworzyć tego PDF-a: plik jest uszkodzony albo nie jest prawdziwym PDF-em.',
  ),
  NO_TEXT: finalMessage(NO_TEXT),
  TEXT_TOO_LONG: finalMessage(TEXT_TOO_LONG),
  READER_UNAVAILABLE: finalMessage(
    'Nie udało się wczytać modułu odczytu PDF-ów. Sprawdź połączenie z internetem i odśwież stronę.',
  ),
};

/** Czas oczekiwania po polsku: sekundy do minuty, dalej godziny i minuty (zaokrąglone w górę). */
function formatWait(seconds: number): string {
  if (seconds <= 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} godz.` : `${hours} godz. ${rest} min`;
}

function retryHint(error: AnalyzeError, fallback: string): string {
  return error.retryAfterSeconds === null
    ? fallback
    : `Spróbuj ponownie za ${formatWait(error.retryAfterSeconds)}.`;
}

type KnownCode = Exclude<ClientErrorCode, `HTTP_${number}`>;

function analyzeMessage(error: AnalyzeError): ErrorMessage {
  // Statusy bez kodu w ciele (`HTTP_<status>`) i nieznane kody trafiają do `default`.
  const code = error.code as KnownCode;
  switch (code) {
    case 'DAILY_RATE_LIMITED':
      return finalMessage(
        `Wykorzystano dzienny limit ${ANALYSES_PER_DAY} analiz z Twojego adresu IP. ${retryHint(error, 'Spróbuj ponownie jutro.')}`,
        'warning',
      );
    case 'AI_QUOTA_EXCEEDED':
      return retryableMessage(
        `Darmowy limit Google Gemini, wspólny dla wszystkich użytkowników demo, jest chwilowo wyczerpany — to nie wina Twojego pliku. ${retryHint(error, 'Spróbuj ponownie za minutę.')}`,
        'warning',
      );
    case 'INVALID_RESULT':
      return retryableMessage(
        'AI dwa razy z rzędu zwróciło niepoprawny wynik. Spróbuj ponownie — kolejna próba zwykle się udaje.',
      );
    case 'AI_PROVIDER_ERROR':
      return retryableMessage(
        'Google Gemini zwróciło błąd albo nie odpowiedziało na czas. Spróbuj ponownie za chwilę.',
      );
    case 'NETWORK_ERROR':
      return retryableMessage(
        'Nie udało się połączyć z usługą analizy. Sprawdź połączenie z internetem i spróbuj ponownie.',
      );
    case 'INVALID_RESPONSE':
      return retryableMessage('Usługa analizy zwróciła nieoczekiwaną odpowiedź. Spróbuj ponownie.');
    case 'EMPTY_TEXT':
      return finalMessage(NO_TEXT);
    case 'TEXT_TOO_LONG':
      return finalMessage(TEXT_TOO_LONG);
    case 'INVALID_INPUT':
      return finalMessage(
        'Usługa analizy odrzuciła żądanie jako niepoprawne. Wybierz plik ponownie.',
      );
    case 'ORIGIN_NOT_ALLOWED':
      return finalMessage('Usługa analizy nie przyjmuje żądań z tej strony.');
    case 'NOT_FOUND':
      return finalMessage('Usługa analizy jest nieprawidłowo skonfigurowana.');
    default:
      code satisfies never;
      return retryableMessage(
        `Usługa analizy zwróciła nieoczekiwany błąd (${error.code}). Spróbuj ponownie.`,
      );
  }
}

/** Komunikat po polsku dla dowolnego błędu odczytu PDF-a albo Analizy. */
export function errorMessage(error: unknown): ErrorMessage {
  if (error instanceof PdfReadError) return PDF_MESSAGES[error.problem];
  if (error instanceof AnalyzeError) return analyzeMessage(error);
  return retryableMessage('Coś poszło nie tak. Spróbuj ponownie.');
}
