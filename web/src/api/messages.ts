import { ANALYSES_PER_DAY, ANALYSES_PER_MINUTE } from '@pdf-insight/shared';
import { AnalyzeError } from './analyze';

export interface AnalyzeErrorMessage {
  /** `warning`, gdy błąd nie wynika z pliku i wystarczy odczekać (limit Analiz). */
  tone: 'error' | 'warning';
  text: string;
}

/** Czas oczekiwania po polsku: sekundy do minuty, dalej godziny i minuty (zaokrąglone w górę). */
function formatWait(seconds: number): string {
  if (seconds <= 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} godz.` : `${hours} godz. ${rest} min`;
}

function retryHint(error: AnalyzeError, fallback: string): string {
  return error.retryAfterSeconds === null
    ? fallback
    : `Spróbuj ponownie za ${formatWait(error.retryAfterSeconds)}.`;
}

/** Komunikat po polsku dla błędu Analizy. */
export function analyzeErrorMessage(error: unknown): AnalyzeErrorMessage {
  if (error instanceof AnalyzeError) {
    if (error.code === 'MINUTE_RATE_LIMITED') {
      return {
        tone: 'warning',
        text: `Przekroczono limit ${ANALYSES_PER_MINUTE} analiz na minutę z Twojego adresu IP. ${retryHint(error, 'Spróbuj ponownie za minutę.')}`,
      };
    }
    if (error.code === 'DAILY_RATE_LIMITED') {
      return {
        tone: 'warning',
        text: `Wykorzystano dzienny limit ${ANALYSES_PER_DAY} analiz z Twojego adresu IP. ${retryHint(error, 'Spróbuj ponownie jutro.')}`,
      };
    }
  }
  return { tone: 'error', text: 'Analiza nie powiodła się. Spróbuj ponownie.' };
}
