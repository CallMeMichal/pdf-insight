# Limit dobowy Analiz w Durable Object zamiast bindingu Rate Limiting

Specyfikacja zakładała, że oba limity Analiz na adres IP (5 na minutę i 30 na dobę) zrealizuje binding Cloudflare Rate Limiting. Binding obsługuje jednak tylko okna 10 s i 60 s, więc limitu dobowego nie da się nim wyrazić. Limit minutowy liczy binding, a dobowy Durable Object (`DailyAnalysisCounter`, SQLite, dostępny na darmowym planie), jedna instancja na adres IP, licząca Analizy w bieżącej dobie UTC. KV odrzuciliśmy, bo jest eventually consistent i jego licznik przepuszczałby nadmiarowe Analizy.

## Konsekwencje

- `Retry-After` przy limicie dobowym to czas do północy UTC, a przy minutowym zawsze 60 s, bo binding nie zdradza końca okna.
- Licznik dobowy rośnie przed wywołaniem Gemini, więc Analiza zakończona błędem dostawcy (502, 503) też zużywa jedną z 30 Analiz na dobę.
- Binding liczy osobno w każdej lokalizacji Cloudflare i synchronizuje liczniki asynchronicznie („permissive, eventually consistent” według dokumentacji), więc limit minutowy jest tylko przybliżony. Na produkcji 15.10.2026 z jednego adresu IP przeszło 13 Analiz w ciągu 60 s bez 429, a lokalnie (`wrangler dev`) limit działał dokładnie. Świadomie zostajemy przy bindingu: przed wyczerpaniem darmowego limitu Gemini chroni spójny limit dobowy, a ostrzeżenie o limicie minutowym w praktyce pojawi się rzadko. Jeśli limit minutowy ma być dokładny, można go przenieść do tego samego Durable Object (okno przesuwne 60 s).
- Po końcu doby alarm usuwa licznik, żeby Worker nie przechowywał danych o adresach IP dłużej, niż to potrzebne.
