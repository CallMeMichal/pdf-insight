import { useState } from 'react';
import type { Result } from '@pdf-insight/shared';
import { analyze } from './api/analyze';
import { FileInput } from './components/FileInput';

type ScreenState =
  | { status: 'empty' }
  | { status: 'reading' }
  | { status: 'analyzing' }
  | { status: 'result'; result: Result }
  | { status: 'error'; message: string };

export function App() {
  const [state, setState] = useState<ScreenState>({ status: 'empty' });
  const busy = state.status === 'reading' || state.status === 'analyzing';

  async function handleFile(file: File) {
    setState({ status: 'reading' });
    let pdf;
    try {
      // pdf.js jest duży, więc ładujemy go dopiero przy pierwszym pliku.
      const { readPdf } = await import('./lib/pdf');
      pdf = await readPdf(file);
    } catch {
      setState({ status: 'error', message: 'Nie udało się odczytać tekstu z tego PDF-a.' });
      return;
    }

    setState({ status: 'analyzing' });
    try {
      setState({ status: 'result', result: await analyze(pdf) });
    } catch {
      setState({ status: 'error', message: 'Analiza nie powiodła się. Spróbuj ponownie.' });
    }
  }

  return (
    <main>
      <h1>PDF Insight</h1>
      <FileInput disabled={busy} onFile={(file) => void handleFile(file)} />
      <div aria-live="polite">
        {state.status === 'reading' && <p>Odczytuję tekst z PDF-a…</p>}
        {state.status === 'analyzing' && <p>Analizuję dokument…</p>}
        {state.status === 'error' && <p className="error">{state.message}</p>}
      </div>
      {state.status === 'result' && <pre>{JSON.stringify(state.result, null, 2)}</pre>}
    </main>
  );
}
