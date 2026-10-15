import { describe, expect, it } from 'vitest';
import { AnalyzeError, type ClientErrorCode } from '../api/errors';
import { errorMessage } from './messages';
import { PdfReadError, type PdfProblem } from './pdfCheck';

const fallback = errorMessage(new Error('nieznany błąd'));

describe('errorMessage — błędy Analizy', () => {
  it('przy limicie dobowym podaje czas z nagłówka Retry-After w godzinach i minutach', () => {
    const message = errorMessage(new AnalyzeError('DAILY_RATE_LIMITED', 3700));
    expect(message.tone).toBe('warning');
    expect(message.text).toContain('za 1 godz. 2 min');
  });

  it('przy limicie dobowym krótko przed północą UTC podaje czas w minutach', () => {
    expect(errorMessage(new AnalyzeError('DAILY_RATE_LIMITED', 120)).text).toContain('za 2 min');
  });

  it('przy wyczerpanym limicie Gemini mówi, że to nie wina pliku, i każe spróbować za minutę', () => {
    const message = errorMessage(new AnalyzeError('AI_QUOTA_EXCEEDED'));
    expect(message.tone).toBe('warning');
    expect(message.text).toContain('za minutę');
    expect(message.retryable).toBe(true);
  });

  // Status HTTP z kontraktu API → kod błędu; każdy ma mieć własny, konkretny komunikat.
  const workerErrors: [status: string, code: ClientErrorCode][] = [
    ['400', 'INVALID_INPUT'],
    ['400', 'EMPTY_TEXT'],
    ['403', 'ORIGIN_NOT_ALLOWED'],
    ['413', 'TEXT_TOO_LONG'],
    ['429', 'DAILY_RATE_LIMITED'],
    ['502', 'INVALID_RESULT'],
    ['502', 'AI_PROVIDER_ERROR'],
    ['503', 'AI_QUOTA_EXCEEDED'],
    ['sieć', 'NETWORK_ERROR'],
  ];

  it.each(workerErrors)('%s %s ma konkretny komunikat zamiast ogólnego', (_status, code) => {
    expect(errorMessage(new AnalyzeError(code)).text).not.toBe(fallback.text);
  });

  it('każdy kod błędu ma inny komunikat', () => {
    const texts = workerErrors.map(([, code]) => errorMessage(new AnalyzeError(code)).text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each<ClientErrorCode>([
    'NETWORK_ERROR',
    'INVALID_RESULT',
    'AI_PROVIDER_ERROR',
    'AI_QUOTA_EXCEEDED',
    'INVALID_RESPONSE',
    'HTTP_500',
  ])('po %s można ponowić tę samą Analizę', (code) => {
    expect(errorMessage(new AnalyzeError(code)).retryable).toBe(true);
  });

  it.each<ClientErrorCode>([
    'INVALID_INPUT',
    'EMPTY_TEXT',
    'TEXT_TOO_LONG',
    'PAYLOAD_TOO_LARGE',
    // Dobowy limit odnawia się po godzinach — natychmiastowe ponowienie znów skończy się 429.
    'DAILY_RATE_LIMITED',
  ])('po %s ponowienie z tym samym tekstem nie ma sensu', (code) => {
    expect(errorMessage(new AnalyzeError(code)).retryable).toBe(false);
  });
});

describe('errorMessage — błędy odczytu PDF-a', () => {
  it.each<[PdfProblem, string | RegExp]>([
    ['NOT_PDF', 'PDF'],
    ['FILE_TOO_LARGE', '10 MB'],
    ['MULTIPLE_FILES', 'jeden'],
    ['ENCRYPTED', 'hasłem'],
    ['CORRUPTED', 'uszkodzony'],
    ['NO_TEXT', 'Nie udało się odczytać tekstu z tego PDF-a'],
    // Separator tysięcy w `pl-PL` to twarda spacja.
    ['TEXT_TOO_LONG', /500\s000/],
  ])('%s → komunikat zawierający „%s”', (problem, fragment) => {
    const message = errorMessage(new PdfReadError(problem));
    expect(message.text).toMatch(fragment);
    expect(message.retryable).toBe(false);
  });
});
