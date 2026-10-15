/** Ciało żądania `POST /analyze`. */
export interface AnalyzeRequest {
  text: string;
  fileName: string;
  pages: number;
}

export type DocumentType = 'faktura' | 'umowa' | 'oferta' | 'raport' | 'inne';

export interface Amount {
  value: number;
  currency: string;
  context: string;
}

export interface DateMention {
  date: string;
  context: string;
}

/** Result Analysis. Tymczasowo zwykły typ — schemat Zod dojdzie w kolejnym tickecie. */
export interface Result {
  document: {
    fileName: string;
    pages: number;
    language: string;
    type: DocumentType;
    title: string | null;
    date: string | null;
  };
  summary: string;
  keyPoints: string[];
  entities: {
    organizations: string[];
    people: string[];
  };
  amounts: Amount[];
  dates: DateMention[];
  keywords: string[];
  meta: {
    analyzedAt: string;
    model: string;
    schemaVersion: number;
  };
}

export const MAX_TEXT_LENGTH = 500_000;
