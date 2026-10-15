import type { AnalyzeRequest } from '@pdf-insight/shared';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// `?url` sprawia, że Vite emituje plik workera i zwraca adres z prefiksem `base`
// (/pdf-insight/), więc worker ładuje się poprawnie także na GitHub Pages.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Wyciąga tekst ze wszystkich stron PDF-a — gotowe ciało żądania Analizy. */
export async function readPdf(file: File): Promise<AnalyzeRequest> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('');
      pageTexts.push(pageText);
    }
    return { text: pageTexts.join('\n\n'), pages: pdf.numPages, fileName: file.name };
  } finally {
    await loadingTask.destroy();
  }
}
