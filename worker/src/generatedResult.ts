import { z } from 'zod';
import { resultSchema } from '@pdf-insight/shared';

/**
 * Część Wyniku, którą generuje model: bez `meta`, `document.fileName` i `document.pages` —
 * te dokłada Worker z żądania, bo muszą pochodzić z pliku, nie z AI.
 */
export const generatedResultSchema = resultSchema.omit({ meta: true }).extend({
  document: resultSchema.shape.document.omit({ fileName: true, pages: true }),
});

export type GeneratedResult = z.infer<typeof generatedResultSchema>;
