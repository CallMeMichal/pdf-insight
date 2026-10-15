import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AnalyzeRequest, Result } from '@pdf-insight/shared';
import { analyze } from './api/analyze';
import { AnalysisProgress } from './components/AnalysisProgress';
import { Dropzone } from './components/Dropzone';
import { HistoryList } from './components/HistoryList';
import { ResultView } from './components/ResultView';
import { createHistoryStore, type HistoryEntry } from './lib/history';
import { errorMessage, type ErrorMessage } from './lib/messages';
import { pickPdf, PdfReadError } from './lib/pdfCheck';

type ScreenState =
  | { status: 'empty' }
  | { status: 'reading'; fileName: string }
  | { status: 'analyzing'; request: AnalyzeRequest }
  | { status: 'result'; result: Result }
  /** `request` jest zachowany, gdy tekst został już odczytany — wtedy można ponowić Analizę. */
  | { status: 'error'; message: ErrorMessage; request: AnalyzeRequest | null };

const historyStore = createHistoryStore(() => window.localStorage);

export function App() {
  const [state, setState] = useState<ScreenState>({ status: 'empty' });
  const [historyEntries, setHistoryEntries] = useState(historyStore.list);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const historyHeadingRef = useRef<HTMLHeadingElement>(null);

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
      const result = await analyze(request);
      setHistoryEntries(historyStore.add(result));
      setState({ status: 'result', result });
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

  function openHistoryEntry(entry: HistoryEntry) {
    // Lista Historii jest pod Wynikiem, więc fokus (i przewinięcie) wraca na jego tytuł.
    flushSync(() => setState({ status: 'result', result: entry.result }));
    resultHeadingRef.current?.focus();
  }

  /** Po zniknięciu listy Historii fokus trafia na główny element bieżącego ekranu. */
  function updateHistory(entries: HistoryEntry[]) {
    flushSync(() => setHistoryEntries(entries));
    const target =
      entries.length > 0
        ? historyHeadingRef.current
        : state.status === 'result'
          ? resultHeadingRef.current
          : fileInputRef.current;
    target?.focus();
  }

  function clearHistory() {
    if (!window.confirm('Usunąć wszystkie wyniki z historii? Tego nie da się cofnąć.')) return;
    updateHistory(historyStore.clear());
  }

  const showDropzone = state.status === 'empty' || state.status === 'error';
  const retryRequest = state.status === 'error' && state.message.retryable ? state.request : null;
  // W trakcie Analizy Historia jest ukryta — otwarcie wpisu przerwałoby bieżącą Analizę.
  const showHistory = historyEntries.length > 0 && (showDropzone || state.status === 'result');

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
          <ResultView result={state.result} headingRef={resultHeadingRef} />
        </>
      )}

      {showHistory && (
        <HistoryList
          entries={historyEntries}
          headingRef={historyHeadingRef}
          onOpen={openHistoryEntry}
          onRemove={(id) => updateHistory(historyStore.remove(id))}
          onClear={clearHistory}
        />
      )}
    </main>
  );
}
