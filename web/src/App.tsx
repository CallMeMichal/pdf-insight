import { useState } from 'react';
import type { Result } from '@pdf-insight/shared';
import { analyze } from './api/analyze';
import { analyzeErrorMessage, type AnalyzeErrorMessage } from './api/messages';
import { FileInput } from './components/FileInput';
import { ResultView } from './components/ResultView';

type ScreenState =
  | { status: 'empty' }
  | { status: 'reading' }
  | { status: 'analyzing' }
  | { status: 'result'; result: Result }
  | { status: 'error'; message: AnalyzeErrorMessage };

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
      setState({
        status: 'error',
        message: { tone: 'error', text: 'Nie udało się odczytać tekstu z tego PDF-a.' },
      });
      return;
    }

    setState({ status: 'analyzing' });
    try {
      setState({ status: 'result', result: await analyze(pdf) });
    } catch (error) {
      setState({ status: 'error', message: analyzeErrorMessage(error) });
    }
  }

  return (
    <main>
      <h1>PDF Insight</h1>
      <FileInput disabled={busy} onFile={(file) => void handleFile(file)} />
      <div aria-live="polite">
        {state.status === 'reading' && <p>Odczytuję tekst z PDF-a…</p>}
        {state.status === 'analyzing' && <p>Analizuję dokument…</p>}
        {state.status === 'error' && (
          <p className={state.message.tone} role="alert">
            {state.message.text}
          </p>
        )}
      </div>
      {state.status === 'result' && <ResultView result={state.result} />}
    </main>
  );
}
