# Tracker zgłoszeń: GitHub

Zgłoszenia i specyfikacje tego repo są w GitHub Issues. Do wszystkich operacji używaj CLI `gh`.

## Konwencje

- **Utworzenie zgłoszenia**: `gh issue create --title "..." --body "..."`. Dla treści wielowierszowych użyj heredoca.
- **Odczyt zgłoszenia**: `gh issue view <numer> --comments`, filtrując komentarze przez `jq` i pobierając też etykiety.
- **Lista zgłoszeń**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` z odpowiednimi filtrami `--label` i `--state`.
- **Komentarz do zgłoszenia**: `gh issue comment <numer> --body "..."`
- **Nadanie / zdjęcie etykiety**: `gh issue edit <numer> --add-label "..."` / `--remove-label "..."`
- **Zamknięcie**: `gh issue close <numer> --comment "..."`

Repo ustalaj na podstawie `git remote -v`; `gh` robi to automatycznie, gdy działa w klonie repo.

## Pull requesty jako źródło zgłoszeń

**PR-y jako źródło zgłoszeń: nie.** _(Ustaw na `tak`, jeśli to repo traktuje zewnętrzne PR-y jak prośby o funkcje; `/triage` czyta tę flagę.)_

Gdy flaga ma wartość `tak`, PR-y przechodzą przez te same etykiety i stany co zgłoszenia, z użyciem odpowiedników `gh pr`:

- **Odczyt PR-a**: `gh pr view <numer> --comments` oraz `gh pr diff <numer>` dla diffu.
- **Lista zewnętrznych PR-ów do triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, a następnie zostaw tylko `authorAssociation` równe `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` lub `NONE` (odrzuć `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Komentarz / etykieta / zamknięcie**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub ma wspólną numerację zgłoszeń i PR-ów, więc samo `#42` może oznaczać jedno lub drugie: sprawdź przez `gh pr view 42`, a w razie niepowodzenia `gh issue view 42`.

## Gdy skill mówi „opublikuj w trackerze zgłoszeń”

Utwórz zgłoszenie w GitHub Issues.

## Gdy skill mówi „pobierz odpowiedni ticket”

Uruchom `gh issue view <numer> --comments`.

## Operacje wayfindingu

Używane przez `/wayfinder`. **Mapa** to pojedyncze zgłoszenie, a tickety to zgłoszenia **podrzędne**.

- **Mapa**: pojedyncze zgłoszenie z etykietą `wayfinder:map`, zawierające sekcje Notatki / Dotychczasowe decyzje / Mgła. `gh issue create --label wayfinder:map`.
- **Ticket podrzędny**: zgłoszenie podpięte do mapy jako sub-issue GitHuba (`gh api` na endpoincie sub-issues). Gdzie sub-issues nie są włączone, dodaj ticket do listy zadań w treści mapy, a na początku treści ticketu wpisz `Part of #<mapa>`. Etykiety: `wayfinder:<typ>` (`research`/`prototype`/`grilling`/`task`). Po przejęciu ticket jest przypisywany do prowadzącego dewelopera.
- **Blokowanie**: **natywne zależności zgłoszeń** GitHuba, kanoniczna reprezentacja widoczna w UI. Krawędź dodaje się przez `gh api --method POST repos/<owner>/<repo>/issues/<podrzędne>/dependencies/blocked_by -F issue_id=<id-bazodanowe-blokującego>`, gdzie `<id-bazodanowe-blokującego>` to numeryczne **id bazodanowe** blokującego zgłoszenia (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _nie_ `#numer` ani `node_id`). GitHub raportuje `issue_dependencies_summary.blocked_by` (tylko otwarte blokady, czyli aktualna bramka). Gdzie zależności nie są dostępne, użyj linii `Blocked by: #<n>, #<n>` na początku treści ticketu. Ticket jest odblokowany, gdy wszystkie blokujące zgłoszenia są zamknięte.
- **Zapytanie o frontier**: wylistuj otwarte zgłoszenia podrzędne mapy (`gh issue list --state open`, zawężone do sub-issues lub listy zadań mapy), odrzuć te z otwartą blokadą (`issue_dependencies_summary.blocked_by > 0` albo otwarte zgłoszenie w linii `Blocked by`) lub z przypisaną osobą; wygrywa pierwsze w kolejności mapy.
- **Przejęcie**: `gh issue edit <n> --add-assignee @me`, pierwszy zapis w sesji.
- **Rozwiązanie**: `gh issue comment <n> --body "<odpowiedź>"`, potem `gh issue close <n>`, a następnie dopisz odnośnik kontekstowy (sedno + link) do sekcji Dotychczasowe decyzje w mapie.
