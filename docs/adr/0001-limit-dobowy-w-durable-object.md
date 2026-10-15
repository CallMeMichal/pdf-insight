# Limit dobowy Analiz w Durable Object zamiast bindingu Rate Limiting

Specyfikacja zakładała dwa limity Analiz na adres IP (5 na minutę i 30 na dobę) w bindingu Cloudflare Rate Limiting. Binding obsługuje jednak tylko okna 10 s i 60 s, więc limitu dobowego nie da się nim wyrazić. Limit dobowy liczy Durable Object (`DailyAnalysisCounter`, SQLite, dostępny na darmowym planie), jedna instancja na adres IP, licząca Analizy w bieżącej dobie UTC. KV odrzuciliśmy, bo jest eventually consistent i jego licznik przepuszczałby nadmiarowe Analizy.

Limit minutowy początkowo liczył binding, ale binding liczy osobno w każdej lokalizacji Cloudflare i synchronizuje liczniki asynchronicznie („permissive, eventually consistent” według dokumentacji). Na produkcji 15.10.2026 z jednego adresu IP przeszło 13 Analiz w ciągu 60 s bez 429. Skoro limit minutowy i tak był tylko przybliżony, a przed wyczerpaniem darmowego limitu Gemini chroni spójny limit dobowy, usunęliśmy limit minutowy. Jest jeden limit i jeden mechanizm.

## Konsekwencje

- `Retry-After` przy przekroczeniu limitu to czas do północy UTC.
- Licznik rośnie przed wywołaniem Gemini, więc Analiza zakończona błędem dostawcy (502, 503) też zużywa jedną z 30 Analiz na dobę.
- Nic nie ogranicza tempa w obrębie doby: 30 Analiz można zużyć w minutę. Jeśli to będzie problemem, limit minutowy da się dodać w tym samym Durable Object (okno przesuwne 60 s).
- Po końcu doby alarm usuwa licznik, żeby Worker nie przechowywał danych o adresach IP dłużej, niż to potrzebne.
