import { z } from 'zod';
import type { ModelAdapter, ModelErrorCode, ModelResponse } from './model';
import { generatedResultSchema } from './generatedResult';
import { buildPrompt } from './prompt';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Słowa kluczowe JSON Schema obsługiwane przez structured output Gemini; reszta jest usuwana. */
const SUPPORTED_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'enum',
  'format',
  'items',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'anyOf',
  'title',
  'description',
]);

/** Zostawia w schemacie tylko obsługiwane słowa kluczowe (np. bez `pattern` i `$schema`). */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (typeof schema !== 'object' || schema === null) return schema;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) continue;
    if (key === 'properties') {
      // Klucze `properties` to nazwy pól, nie słowa kluczowe — filtrujemy dopiero ich schematy.
      result[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([name, sub]) => [
          name,
          toGeminiSchema(sub),
        ]),
      );
    } else if (key === 'enum' || key === 'required') {
      result[key] = value;
    } else {
      result[key] = toGeminiSchema(value);
    }
  }
  return result;
}

/**
 * Schemat odpowiedzi wymuszany na modelu, wyprowadzony ze schematu Zod Wyniku (bez `meta`,
 * `fileName` i `pages`). Reguł niewyrażalnych tu (format daty, kody ISO) pilnuje walidacja Zod.
 */
const RESPONSE_SCHEMA = toGeminiSchema(z.toJSONSchema(generatedResultSchema));

/** Powody zakończenia, przy których model odmówił odpowiedzi. */
const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
]);

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

export interface GeminiConfig {
  apiKey: string;
  /** Nazwa modelu, np. `gemini-3.8-flash` (z konfiguracji `GEMINI_MODEL`). */
  model: string;
}

/**
 * Do logów trafiają tylko kody błędu Google (np. `INVALID_ARGUMENT`, `API_KEY_INVALID`), bez
 * komunikatu tekstowego — ten mógłby cytować fragmenty żądania, czyli tekstu Dokumentu.
 */
async function describeError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { status?: string; details?: { reason?: string }[] };
  } | null;
  const reasons = (body?.error?.details ?? []).flatMap((detail) => detail.reason ?? []);
  return [body?.error?.status ?? 'brak kodu', ...reasons].join(' ');
}

const failure = (error: ModelErrorCode): ModelResponse => ({ ok: false, error });

/** Adapter Gemini (`generateContent` z trybem JSON i schematem odpowiedzi). */
export function createGeminiAdapter({ apiKey, model }: GeminiConfig): ModelAdapter {
  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;

  return {
    modelName: model,
    async generate(documentText, signal) {
      const { systemInstruction, userMessage } = buildPrompt(documentText);

      let response: Response;
      let body: GenerateContentResponse;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: RESPONSE_SCHEMA,
            },
          }),
          signal,
        });
        if (response.status === 429) return failure('RATE_LIMITED');
        if (!response.ok) {
          console.error(`Gemini HTTP ${response.status}: ${await describeError(response)}`);
          return failure('PROVIDER_ERROR');
        }
        body = await response.json();
      } catch (cause) {
        if (signal.aborted) return failure('TIMEOUT');
        console.error(`Gemini: błąd połączenia lub odpowiedzi (${(cause as Error).name})`);
        return failure(cause instanceof SyntaxError ? 'PROVIDER_ERROR' : 'NETWORK_ERROR');
      }

      if (body.promptFeedback?.blockReason) return failure('BLOCKED');
      const candidate = body.candidates?.[0];
      if (candidate?.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
        return failure('BLOCKED');
      }

      // Pusta lub ucięta odpowiedź to niepoprawny Wynik — handler ją odrzuci i ponowi Próbę.
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? '')
        .join('');
      return { ok: true, text };
    },
  };
}
