import { describe, expect, it } from 'vitest';
import {
  exportFileName,
  formatAmount,
  formatLanguage,
  formatPages,
  formatPartialDate,
} from './format';

/** Twarda spacja — separator tysięcy i odstęp przed walutą w formacie `pl-PL`. */
const NBSP = String.fromCharCode(0xa0);

describe('formatAmount', () => {
  it('formatuje Kwotę w złotych z separatorem tysięcy i przecinkiem dziesiętnym', () => {
    expect(formatAmount({ value: 1234.5, currency: 'PLN', context: 'netto' })).toBe(
      `1${NBSP}234,50${NBSP}zł`,
    );
  });

  it('pokazuje kod waluty, gdy polski format nie ma dla niej symbolu', () => {
    expect(formatAmount({ value: 1234567.891, currency: 'USD', context: 'cena' })).toBe(
      `1${NBSP}234${NBSP}567,89${NBSP}USD`,
    );
  });

  it('nie zaokrągla do groszy waluty bez części dziesiętnej', () => {
    expect(formatAmount({ value: 15000, currency: 'JPY', context: 'opłata' })).toBe(
      `15${NBSP}000${NBSP}JPY`,
    );
  });
});

describe('formatPartialDate', () => {
  it.each([
    ['2026-03-12', '12 marca 2026'],
    ['2026-03', 'marzec 2026'],
    ['2026', '2026'],
  ])('pokazuje datę %s z precyzją podaną w Dokumencie: %s', (date, expected) => {
    expect(formatPartialDate(date)).toBe(expected);
  });
});

describe('formatPages', () => {
  it.each([
    [1, '1 strona'],
    [2, '2 strony'],
    [4, '4 strony'],
    [5, '5 stron'],
    [12, '12 stron'],
    [22, '22 strony'],
    [111, '111 stron'],
  ])('odmienia liczbę stron: %i → %s', (pages, expected) => {
    expect(formatPages(pages)).toBe(expected);
  });
});

describe('exportFileName', () => {
  it.each([
    ['umowa.pdf', 'umowa.json'],
    ['Umowa 14.2026.PDF', 'Umowa 14.2026.json'],
    ['skan', 'skan.json'],
    ['.pdf', 'wynik.json'],
  ])('tworzy nazwę pliku JSON od nazwy PDF-a: %s → %s', (fileName, expected) => {
    expect(exportFileName(fileName)).toBe(expected);
  });
});

describe('formatLanguage', () => {
  it.each([
    ['pl', 'polski'],
    ['en', 'angielski'],
    ['qq', 'qq'],
  ])('nazywa Język dokumentu po polsku: %s → %s', (code, expected) => {
    expect(formatLanguage(code)).toBe(expected);
  });
});
