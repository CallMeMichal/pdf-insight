# PDF Insight

Aplikacja webowa, która przyjmuje PDF, tworzy jego krótkie podsumowanie i zamienia treść w uporządkowane dane do eksportu jako JSON. Każdy termin ma polską nazwę (używaną w dokumentacji i UI) oraz nazwę angielską w nawiasie, używaną w kodzie i kluczach JSON.

## Język

**Dokument** (`Document`):
Pojedynczy plik PDF wgrany przez użytkownika do analizy.
_Unikaj_: plik, upload, wejście

**Dokument główny** (`Primary Document`):
Główny dokument prawny lub biznesowy w Dokumencie; załączniki, aneksy i osadzone faktury są jego częścią, a nie osobnymi Dokumentami. Tylko Dokument główny określa typ, tytuł i datę Dokumentu.
_Unikaj_: główny plik

**Typ dokumentu** (`Document Type`):
Jedna z wartości `faktura | umowa | oferta | raport | inne`, ustalana na podstawie Dokumentu głównego.
_Unikaj_: kategoria, rodzaj

**Analiza** (`Analysis`):
Jedno przetworzenie jednego Dokumentu, od wgrania do Wyniku albo niepowodzenia. Ponowienie po błędzie kontynuuje tę samą Analizę, a nie zaczyna nowej.
_Unikaj_: insight, raport, zadanie, przebieg

**Próba** (`Attempt`):
Jedna próba uzyskania od AI poprawnego Wyniku w ramach Analizy; Analiza ma jedną automatyczną ponowną próbę, po której użytkownik może ponowić ręcznie.
_Unikaj_: żądanie, wywołanie

**Wynik** (`Result`):
JSON zgodny ze schematem, powstały w wyniku udanej Analizy — to on jest wyświetlany, eksportowany i przechowywany w Historii.
_Unikaj_: output, odpowiedź, insight, raport

**Język dokumentu** (`Document Language`):
Dominujący język Dokumentu głównego; wszystkie wartości w Wyniku są w tym języku, a fragmenty obcojęzyczne są na niego tłumaczone.
_Unikaj_: locale

### Dane wyodrębnione

**Kwota** (`Amount`):
Wartość pieniężna z walutą i znaczeniem, jakie ma w Dokumencie. Jedna Kwota na każde odrębne znaczenie, a nie na każde wystąpienie; netto i brutto to osobne Kwoty, stawki (np. za godzinę) są Kwotami, procenty nie.
_Unikaj_: cena, suma, liczba

**Wzmianka o dacie** (`Date Mention`):
Data dzienna, miesiąc lub rok ze znaczeniem, jakie ma w Dokumencie, zapisana tylko z precyzją podaną w Dokumencie. Okres, który nie jest dniem, miesiącem ani rokiem (np. kwartał), zapisuje się jako rok, w którym się mieści, a dokładny okres podaje się w znaczeniu. Zakres dat to dwie Wzmianki o dacie (początek i koniec).
_Unikaj_: termin, wydarzenie

**Osoba** (`Person`):
Wymieniona z nazwiska osoba fizyczna, zapisana jako imię i nazwisko w mianowniku, bez funkcji i tytułów, raz na osobę.
_Unikaj_: sygnatariusz, kontakt

**Organizacja** (`Organization`):
Wymieniona z nazwy firma lub instytucja, zapisana pełną nazwą z formą prawną, raz na organizację.
_Unikaj_: firma, strona, podmiot

**Historia** (`History`):
Najnowsze Wyniki (do 10) przechowywane we własnej przeglądarce użytkownika; zawiera wyłącznie Wyniki, nigdy tekstu Dokumentu.
_Unikaj_: archiwum, cache
