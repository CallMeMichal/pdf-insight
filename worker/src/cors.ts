/**
 * Sprawdza, czy origin jest na liście dozwolonych. Wpis może mieć `*` w miejscu portu
 * (np. `http://localhost:*`), co dopuszcza dowolny port na tym hoście.
 */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed.endsWith(':*')) {
      const prefix = allowed.slice(0, -1);
      return origin.startsWith(prefix) && /^\d+$/.test(origin.slice(prefix.length));
    }
    return origin === allowed;
  });
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Bez tego przeglądarka ukryje Retry-After przed kodem strony (odpowiedź 429).
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
