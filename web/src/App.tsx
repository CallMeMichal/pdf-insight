import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AnalyzeRequest, Result } from '@pdf-insight/shared';
import { analyze } from './api/analyze';
import { AnalysisProgress } from './components/AnalysisProgress';
import { Dropzone } from './components/Dropzone';
import { ResultView } from './components/ResultView';
import { errorMessage, type ErrorMessage } from './lib/messages';
import { pickPdf, PdfReadError } from './lib/pdfCheck';

type ScreenState =
  | { status: 'empty' }
  | { status: 'reading'; fileName: string }
  | { status: 'analyzing'; request: AnalyzeRequest }
  | { status: 'result'; result: Result }
  /** `request` jest zachowany, gdy tekst został już odczytany — wtedy można ponowić Analizę. */
  | { status: 'error'; message: ErrorMessage; request: AnalyzeRequest | null };

export function App() {
  const [state, setState] = useState<ScreenState>({ status: 'empty' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Plik upuszczony poza polem wyboru Dokumentu (albo w trakcie Analizy) otworzyłby się w karcie
  // przeglądarki, a bieżąca Analiza by przepadła.
  useEffect(() => {
    const preventOpen = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', preventOpen);
    window.addEventListener('drop', preventOpen);
    return () => {
      window.removeEventListener('dragover', preventOpen);
      window.removeEventListener('drop', preventOpen);
    };
  }, []);

  async function runAnalysis(request: AnalyzeRequest) {
    setState({ status: 'analyzing', request });
    try {
      setState({ status: 'result', result: await analyze(request) });
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error), request });
    }
  }

  async function handleFiles(files: File[]) {
    const fail = (error: unknown) =>
      setState({ status: 'error', message: errorMessage(error), request: null });

    let file: File;
    try {
      file = pickPdf(files);
    } catch (error) {
      fail(error);
      return;
    }

    setState({ status: 'reading', fileName: file.name });
    let request: AnalyzeRequest;
    try {
      // pdf.js jest duży, więc ładujemy go dopiero przy pierwszym pliku.
      const pdf = await import('./lib/pdf').catch(() => {
        throw new PdfReadError('READER_UNAVAILABLE');
      });
      request = await pdf.readPdf(file);
    } catch (error) {
      fail(error);
      return;
    }

    await runAnalysis(request);
  }

  function startOver() {
    // Pole uploadu musi być w DOM-ie, zanim przeniesiemy na nie fokus.
    flushSync(() => setState({ status: 'empty' }));
    fileInputRef.current?.focus();
  }

  const showDropzone = state.status === 'empty' || state.status === 'error';
  const retryRequest = state.status === 'error' && state.message.retryable ? state.request : null;

  return (
    <main>
      <header className="app-header">
        <h1>PDF Insight</h1>
        <p>
          Wgraj umowę, fakturę, ofertę albo raport w PDF-ie, a dostaniesz podsumowanie, strony,
          kwoty i daty — do przejrzenia i pobrania jako JSON.
        </p>
      </header>

      <div aria-live="polite">
        {(state.status === 'reading' || state.status === 'analyzing') && (
          <AnalysisProgress
            stage={state.status}
            fileName={state.status === 'reading' ? state.fileName : state.request.fileName}
          />
        )}
      </div>

      {state.status === 'error' && (
        <div className={`notice ${state.message.tone}`} role="alert">
          <p>{state.message.text}</p>
          {retryRequest && (
            <button type="button" className="button" onClick={() => void runAnalysis(retryRequest)}>
              Spróbuj ponownie
            </button>
          )}
        </div>
      )}

      {showDropzone && <Dropzone ref={fileInputRef} onFiles={(files) => void handleFiles(files)} />}

      {state.status === 'result' && (
        <>
          <div className="result-actions">
            <button type="button" className="button" onClick={startOver}>
              Analizuj kolejny plik
            </button>
          </div>
          <ResultView result={state.result} />
        </>
      )}
    </main>
  );
}
