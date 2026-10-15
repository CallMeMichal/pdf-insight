import type { Ref } from 'react';
import { DOCUMENT_TYPE_LABELS, formatDateTime } from '../lib/format';
import { MAX_HISTORY_ENTRIES, type HistoryEntry } from '../lib/history';

interface HistoryListProps {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Nagłówek Historii — rodzic przenosi na niego fokus po usunięciu wpisu. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Lista Wyników z Historii: otwarcie w widoku Wyniku, usunięcie wpisu i wyczyszczenie całości. */
export function HistoryList({ entries, onOpen, onRemove, onClear, headingRef }: HistoryListProps) {
  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history-header">
        <h2 id="history-title" ref={headingRef} tabIndex={-1}>
          Historia
        </h2>
        <button type="button" className="button-secondary" onClick={onClear}>
          Wyczyść historię
        </button>
      </div>
      <p className="history-note">
        Ostatnie wyniki (do {MAX_HISTORY_ENTRIES}) zapisane tylko w tej przeglądarce, bez tekstu
        dokumentów.
      </p>
      <ul className="history-list">
        {entries.map((entry) => {
          const { document, meta } = entry.result;
          return (
            <li key={entry.id} className="history-entry">
              <button type="button" className="history-open" onClick={() => onOpen(entry)}>
                <span className="history-file">{document.fileName}</span>
                <span className="history-meta">
                  {DOCUMENT_TYPE_LABELS[document.type]} ·{' '}
                  <time dateTime={meta.analyzedAt}>{formatDateTime(meta.analyzedAt)}</time>
                </span>
              </button>
              <button
                type="button"
                className="button-secondary"
                aria-label={`Usuń z historii: ${document.fileName}`}
                onClick={() => onRemove(entry.id)}
              >
                Usuń
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
