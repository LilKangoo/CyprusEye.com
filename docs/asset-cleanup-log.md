# Asset cleanup log

## Usunięte i scalone zasoby
- Zastąpiono pojedynczy arkusz `styles.css` oraz pomocniczy `css/tutorial.css` modułowym zestawem `assets/css/tokens.css`, `base.css`, `components.css`, `mobile.css`.
- Usunięto wielokrotne pobieranie fontów Google (Montserrat, Nunito) – cała witryna korzysta z jednej rodziny `Jost` z fallbackiem systemowym.
- Uporządkowano odniesienia do arkuszy na wszystkich podstronach tak, aby ładowały tylko cztery podstawowe pliki CSS.

## Linki uznane za duplikaty / nieużywane
- `<link rel="stylesheet" href="styles.css">` – zastąpione przez `assets/css/components.css` (importujące pozostałe style komponentów).
- `<link rel="stylesheet" href="css/tutorial.css">` – scalone do `assets/css/components.css`.
- `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` powielone na wszystkich stronach – pozostawiono po jednym zestawie wraz z nową definicją fontu `Jost`.

Szczegółowa lista obecnych tagów `<link>` znajduje się w pliku [`docs/link-inventory.md`](link-inventory.md).
