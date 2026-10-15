interface AnalysisProgressProps {
  stage: 'reading' | 'analyzing';
  fileName: string;
}

const STEPS = [
  { stage: 'reading', current: 'Odczytuję tekst…', done: 'Tekst odczytany' },
  { stage: 'analyzing', current: 'Analizuję dokument…', done: 'Dokument przeanalizowany' },
] as const;

/** Etapy Analizy: odczyt tekstu w przeglądarce, potem Analiza przez AI. */
export function AnalysisProgress({ stage, fileName }: AnalysisProgressProps) {
  const currentIndex = STEPS.findIndex((step) => step.stage === stage);

  return (
    <section className="progress" aria-labelledby="progress-file">
      <p id="progress-file" className="progress-file">
        {fileName}
      </p>
      <ol className="steps">
        {STEPS.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
          return (
            <li
              key={step.stage}
              className={`step ${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {state === 'done' ? step.done : step.current}
            </li>
          );
        })}
      </ol>
      <p className="progress-hint">Analiza trwa zwykle od kilku do kilkunastu sekund.</p>
    </section>
  );
}
