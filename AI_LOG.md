# AI_LOG

Dziennik pracy z narzędziami AI przy budowie PDF Insight. Uzupełniany w kolejnych etapach.

## Narzędzia

- Claude Code (model Claude Opus) — planowanie (spec i tickety w GitHub Issues), implementacja, code review.

## Kluczowe prompty

<!-- 3–5 najważniejszych promptów: treść (skrócona), cel, co z nich wyszło. -->

1. _Do uzupełnienia._

## Gdzie AI się pomyliło

<!-- Konkretne przypadki: co AI zaproponowało, dlaczego było źle, jak to wykryto i poprawiono. -->

- _Do uzupełnienia._

## Przebieg według ticketów

### #2 Walking skeleton

- Struktura workspace npm (`shared`, `worker`, `web`), CI/CD, Worker zwracający Result-zaślepkę.
- TDD na seamie handlera Workera (`worker/src/handler.test.ts`): CORS, preflight, 400/403/404/405.

### #3 Schemat Wyniku

- Schemat Zod Wyniku (`Result`) w `shared` (`shared/src/result.ts`) jako jedyne źródło prawdy; typ TypeScript wyprowadzany ze schematu, stałe limitów w `shared/src/limits.ts`.
- TDD na seamie schematu (`shared/src/result.test.ts`): poprawne Wyniki (pełny, puste listy i `null`, każda precyzja daty) i niepoprawne Wyniki (brak pola, `type`, waluta, język, data, liczność `keyPoints`/`keywords`, `pages`, `meta`).
- Worker waliduje Wynik przed odesłaniem (502 `INVALID_RESULT`), web waliduje odpowiedź przed wyświetleniem (`INVALID_RESPONSE`).
