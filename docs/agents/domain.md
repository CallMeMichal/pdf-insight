# Dokumentacja domenowa

Jak skille inżynierskie mają korzystać z dokumentacji domenowej tego repo podczas eksplorowania kodu.

## Przed eksploracją przeczytaj

- **`CONTEXT.md`** w katalogu głównym repo, albo
- **`CONTEXT-MAP.md`** w katalogu głównym, jeśli istnieje: wskazuje po jednym `CONTEXT.md` na każdy kontekst. Przeczytaj te, które dotyczą tematu.
- **`docs/adr/`**: przeczytaj ADR-y dotyczące obszaru, w którym zamierzasz pracować. W repo z wieloma kontekstami sprawdź też `src/<kontekst>/docs/adr/` pod kątem decyzji dotyczących danego kontekstu.

Jeśli któregoś z tych plików nie ma, **kontynuuj bez komentarza**. Nie zgłaszaj ich braku i nie proponuj tworzenia ich z góry. Skill `/domain-modeling` (wywoływany przez `/grill-with-docs` i `/improve-codebase-architecture`) tworzy je leniwie, gdy terminy lub decyzje faktycznie zostaną ustalone.

## Struktura plików

Repo z jednym kontekstem (większość repo):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Repo z wieloma kontekstami (obecność `CONTEXT-MAP.md` w katalogu głównym):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← decyzje ogólnosystemowe
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← decyzje dotyczące kontekstu
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Używaj słownictwa z glosariusza

Gdy Twój wynik nazywa pojęcie domenowe (w tytule zgłoszenia, propozycji refaktoryzacji, hipotezie, nazwie testu), użyj terminu zdefiniowanego w `CONTEXT.md`. Nie zastępuj go synonimami, których glosariusz każe unikać.

Jeśli potrzebnego pojęcia nie ma jeszcze w glosariuszu, to sygnał: albo wymyślasz język, którego projekt nie używa (przemyśl to), albo jest realna luka (zanotuj ją dla `/domain-modeling`).

## Sygnalizuj konflikty z ADR-ami

Jeśli Twój wynik jest sprzeczny z istniejącym ADR-em, powiedz to wprost, zamiast po cichu go pomijać:

> _Sprzeczne z ADR-0007 (event-sourced orders), ale warto do tego wrócić, ponieważ…_
