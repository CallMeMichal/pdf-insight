import type { Result } from '@pdf-insight/shared';
import { exportFileName, resultToJson } from '../lib/format';

interface ResultExportProps {
  result: Result;
}

function downloadJson(json: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Zwolnienie adresu dopiero po rozpoczęciu pobierania (Safari czyta go asynchronicznie).
  setTimeout(() => URL.revokeObjectURL(url));
}

/** Zwijany podgląd pełnego JSON-a Wyniku i pobranie go jako pliku o tej samej treści. */
export function ResultExport({ result }: ResultExportProps) {
  const json = resultToJson(result);
  const fileName = exportFileName(result.document.fileName);

  return (
    <section className="result-section result-export">
      <h3>JSON</h3>
      <button type="button" className="button" onClick={() => downloadJson(json, fileName)}>
        Pobierz {fileName}
      </button>
      <details>
        <summary>Pokaż pełny JSON</summary>
        {/* Przewijany obszar musi przyjmować fokus, żeby dało się go przewinąć klawiaturą. */}
        <pre tabIndex={0} aria-label="Pełny JSON Wyniku">
          {json}
        </pre>
      </details>
    </section>
  );
}
