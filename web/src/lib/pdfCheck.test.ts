import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES, MAX_TEXT_LENGTH } from '@pdf-insight/shared';
import { checkText, pickPdf, PdfReadError, toPdfReadError, type PdfProblem } from './pdfCheck';

function file(name: string, type = 'application/pdf', size = 1024) {
  return { name, type, size };
}

function problemOf(action: () => unknown): PdfProblem | null {
  try {
    action();
    return null;
  } catch (error) {
    if (error instanceof PdfReadError) return error.problem;
    throw error;
  }
}

describe('pickPdf', () => {
  it('przyjmuje pojedynczy PDF', () => {
    const pdf = file('umowa.pdf');
    expect(pickPdf([pdf])).toBe(pdf);
  });

  it('rozpoznaje PDF po rozszerzeniu, gdy przeglądarka nie podała typu', () => {
    const pdf = file('SKAN.PDF', '');
    expect(pickPdf([pdf])).toBe(pdf);
  });

  it('odrzuca plik, który nie jest PDF-em', () => {
    expect(problemOf(() => pickPdf([file('notatki.docx', 'application/msword')]))).toBe('NOT_PDF');
  });

  it('odrzuca kilka plików naraz', () => {
    expect(problemOf(() => pickPdf([file('a.pdf'), file('b.pdf')]))).toBe('MULTIPLE_FILES');
  });

  it('odrzuca upuszczenie bez pliku', () => {
    expect(problemOf(() => pickPdf([]))).toBe('NO_FILE');
  });

  it('przyjmuje plik o rozmiarze równym limitowi 10 MB', () => {
    const pdf = file('duzy.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES);
    expect(pickPdf([pdf])).toBe(pdf);
  });

  it('odrzuca plik większy niż 10 MB', () => {
    expect(
      problemOf(() => pickPdf([file('za-duzy.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES + 1)])),
    ).toBe('FILE_TOO_LARGE');
  });
});

describe('checkText', () => {
  it('przyjmuje tekst o długości równej limitowi', () => {
    expect(problemOf(() => checkText('a'.repeat(MAX_TEXT_LENGTH)))).toBeNull();
  });

  it('odrzuca PDF bez tekstu, np. skan bez warstwy tekstowej', () => {
    expect(problemOf(() => checkText(' \n\n \t'))).toBe('NO_TEXT');
  });

  it('odrzuca tekst dłuższy niż 500 000 znaków', () => {
    expect(problemOf(() => checkText('a'.repeat(MAX_TEXT_LENGTH + 1)))).toBe('TEXT_TOO_LONG');
  });
});

describe('toPdfReadError', () => {
  it('rozpoznaje PDF zabezpieczony hasłem', () => {
    const passwordException = Object.assign(new Error('No password given'), {
      name: 'PasswordException',
    });
    expect(toPdfReadError(passwordException).problem).toBe('ENCRYPTED');
  });

  it('każdy inny błąd pdf.js traktuje jak uszkodzony plik', () => {
    const invalidPdf = Object.assign(new Error('Invalid PDF structure.'), {
      name: 'InvalidPDFException',
    });
    expect(toPdfReadError(invalidPdf).problem).toBe('CORRUPTED');
    expect(toPdfReadError('coś zupełnie innego').problem).toBe('CORRUPTED');
  });

  it('przepuszcza błąd, który już jest PdfReadError', () => {
    expect(toPdfReadError(new PdfReadError('NO_TEXT')).problem).toBe('NO_TEXT');
  });
});
