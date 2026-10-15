import { MAX_FILE_SIZE_BYTES, MAX_TEXT_LENGTH } from '@pdf-insight/shared';

/** Powód, dla którego Dokumentu nie da się przeanalizować — wykryty w przeglądarce. */
export type PdfProblem =
  /** Upuszczono coś, co nie jest plikiem (np. zaznaczony tekst). */
  | 'NO_FILE'
  | 'MULTIPLE_FILES'
  | 'NOT_PDF'
  /** Plik większy niż `MAX_FILE_SIZE_BYTES`. */
  | 'FILE_TOO_LARGE'
  /** Przeglądarka nie mogła odczytać pliku z dysku (np. usunięty po wybraniu). */
  | 'UNREADABLE_FILE'
  /** PDF zabezpieczony hasłem. */
  | 'ENCRYPTED'
  /** pdf.js nie zdołał otworzyć pliku (uszkodzony albo tylko udaje PDF). */
  | 'CORRUPTED'
  /** PDF nie ma warstwy tekstowej (np. skan). */
  | 'NO_TEXT'
  /** Tekst dłuższy niż `MAX_TEXT_LENGTH` znaków. */
  | 'TEXT_TOO_LONG'
  /** Nie udało się pobrać modułu odczytu PDF-ów (np. brak sieci). */
  | 'READER_UNAVAILABLE';

export class PdfReadError extends Error {
  readonly problem: PdfProblem;

  constructor(problem: PdfProblem) {
    super(`Nie można odczytać PDF-a: ${problem}`);
    this.name = 'PdfReadError';
    this.problem = problem;
  }
}

type FileLike = Pick<File, 'name' | 'type' | 'size'>;

function isPdf(file: FileLike): boolean {
  // Część systemów nie podaje typu MIME, więc rozszerzenie też wystarcza; plik, który
  // tylko udaje PDF, odrzuci dopiero pdf.js jako uszkodzony.
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Wybiera jedyny PDF spośród wgranych plików albo rzuca `PdfReadError`. */
export function pickPdf<T extends FileLike>(files: readonly T[]): T {
  const [file] = files;
  if (!file) throw new PdfReadError('NO_FILE');
  if (files.length > 1) throw new PdfReadError('MULTIPLE_FILES');
  if (!isPdf(file)) throw new PdfReadError('NOT_PDF');
  if (file.size > MAX_FILE_SIZE_BYTES) throw new PdfReadError('FILE_TOO_LARGE');
  return file;
}

/** Sprawdza tekst wyciągnięty z PDF-a, zanim trafi do Analizy; rzuca `PdfReadError`. */
export function checkText(text: string): void {
  if (!text.trim()) throw new PdfReadError('NO_TEXT');
  if (text.length > MAX_TEXT_LENGTH) throw new PdfReadError('TEXT_TOO_LONG');
}

/** Zamienia wyjątek pdf.js (rozpoznawany po nazwie klasy) na `PdfReadError`. */
export function toPdfReadError(error: unknown): PdfReadError {
  if (error instanceof PdfReadError) return error;
  if (error instanceof Error && error.name === 'PasswordException') {
    return new PdfReadError('ENCRYPTED');
  }
  return new PdfReadError('CORRUPTED');
}
