import type { ReactNode, Ref } from 'react';
import type { Result } from '@pdf-insight/shared';
import {
  DOCUMENT_TYPE_LABELS,
  formatAmount,
  formatDateTime,
  formatLanguage,
  formatPages,
  formatPartialDate,
} from '../lib/format';
import { ResultExport } from './ResultExport';

interface ResultViewProps {
  result: Result;
  /** Tytuł Wyniku — rodzic przenosi na niego fokus po otwarciu wpisu z Historii. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Czytelny widok Wyniku. Wartości z modelu są renderowane wyłącznie jako tekst. */
export function ResultView({ result, headingRef }: ResultViewProps) {
  const { document, entities, meta } = result;

  return (
    <article className="result" aria-labelledby="result-title">
      <header className="result-header">
        <p className="result-type">{DOCUMENT_TYPE_LABELS[document.type]}</p>
        <h2 id="result-title" ref={headingRef} tabIndex={-1}>
          {document.title ?? document.fileName}
        </h2>
        <ul className="result-facts" aria-label="Dane dokumentu">
          {document.title === null && <li>Bez tytułu</li>}
          <li>{document.date === null ? 'Bez daty' : formatPartialDate(document.date)}</li>
          <li>Język: {formatLanguage(document.language)}</li>
          <li>{formatPages(document.pages)}</li>
        </ul>
      </header>

      <Section title="Podsumowanie">
        <p>{result.summary}</p>
      </Section>

      <Section title="Najważniejsze punkty">
        <ItemList items={result.keyPoints} emptyText="Brak najważniejszych punktów." />
      </Section>

      <Section title="Organizacje i osoby">
        <h4>Organizacje</h4>
        <ItemList items={entities.organizations} emptyText="Nie wymieniono żadnej organizacji." />
        <h4>Osoby</h4>
        <ItemList items={entities.people} emptyText="Nie wymieniono żadnej osoby." />
      </Section>

      <Section title="Kwoty">
        <ItemList
          items={result.amounts}
          emptyText="W dokumencie nie ma kwot."
          className="mentions"
          renderItem={(amount) => (
            <>
              <span className="mention-value">{formatAmount(amount)}</span>
              <span className="mention-context">{amount.context}</span>
            </>
          )}
        />
      </Section>

      <Section title="Daty">
        <ItemList
          items={result.dates}
          emptyText="W dokumencie nie ma dat."
          className="mentions"
          renderItem={(mention) => (
            <>
              <time className="mention-value" dateTime={mention.date}>
                {formatPartialDate(mention.date)}
              </time>
              <span className="mention-context">{mention.context}</span>
            </>
          )}
        />
      </Section>

      <Section title="Słowa kluczowe">
        <ItemList items={result.keywords} emptyText="Brak słów kluczowych." className="keywords" />
      </Section>

      <Section title="Metadane">
        <dl className="metadata">
          <dt>Plik</dt>
          <dd>{document.fileName}</dd>
          <dt>Przeanalizowano</dt>
          <dd>
            <time dateTime={meta.analyzedAt}>{formatDateTime(meta.analyzedAt)}</time>
          </dd>
          <dt>Model</dt>
          <dd>{meta.model}</dd>
          <dt>Wersja schematu</dt>
          <dd>{meta.schemaVersion}</dd>
        </dl>
      </Section>

      <ResultExport result={result} />
    </article>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="result-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

interface ItemListProps<T> {
  items: T[];
  emptyText: string;
  className?: string;
  /** Domyślnie element jest tekstem z modelu i trafia do listy bez zmian. */
  renderItem?: (item: T) => ReactNode;
}

/** Lista wartości z Wyniku albo łagodny komunikat, gdy lista jest pusta. */
function ItemList<T>({ items, emptyText, className, renderItem }: ItemListProps<T>) {
  if (items.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <ul className={className}>
      {items.map((item, index) => (
        <li key={index}>{renderItem ? renderItem(item) : String(item)}</li>
      ))}
    </ul>
  );
}
