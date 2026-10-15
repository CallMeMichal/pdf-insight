export * from './limits';
export * from './result';

/** Ciało żądania `POST /analyze`. */
export interface AnalyzeRequest {
  text: string;
  fileName: string;
  pages: number;
}

/** Maszynowy kod błędu w ciele odpowiedzi Workera (`{ error: AnalyzeErrorCode }`). */
export type AnalyzeErrorCode =
  'ORIGIN_NOT_ALLOWED' | 'INVALID_INPUT' | 'INVALID_RESULT' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED';
