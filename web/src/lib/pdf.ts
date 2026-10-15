import type { AnalyzeRequest } from '@pdf-insight/shared';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// `?url` sprawia, że Vite emituje plik workera i zwraca adres z prefiksem `base`
// (/pdf-insight/), więc worker ładuje się poprawnie także na GitHub Pages.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { checkText, PdfReadError, toPdfReadError } from './pdfCheck';

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Wyciąga tekst ze wszystkich stron PDF-a — gotowe ciało żądania Analizy. Gdy PDF jest
 * zaszyfrowany, uszkodzony, bez tekstu albo za długi, rzuca `PdfReadError`.
 */
export async function readPdf(file: File): Promise<AnalyzeRequest> {
  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch {
    // Plik zniknął z dysku albo zmienił się po wybraniu.
    throw new PdfReadError('UNREADABLE_FILE');
  }
  const loadingTask = getDocument({ data });
  try {
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('');
      pageTexts.push(pageText);
    }
    const text = pageTexts.join('\n\n');
    checkText(text);
    return { text, pages: pdf.numPages, fileName: file.name };
  } catch (error) {
    throw toPdfReadError(error);
  } finally {
    await loadingTask.destroy();
  }
}
