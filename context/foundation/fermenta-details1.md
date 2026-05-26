# Fermenta — korekty logiki procesu, cukru i ostrzeżeń

## Cel dokumentu

Ten dokument zawiera korekty i doprecyzowania do wcześniejszego opisu projektu **Fermenta**. Skupia się wyłącznie na logice procesu, modelowaniu cukru, draftach kroków i ostrzeżeniach związanych z planowaną mocą, tolerancją drożdży i docelową słodyczą.

## Weryfikacja rozumowania domenowego

Przyjęte rozumowanie jest w dużej mierze poprawne i nadaje się do MVP, ale wymaga jednego ważnego doprecyzowania.

### Co jest poprawne

Jeśli użytkownik planuje wino inne niż wytrawne, sensowne jest rozdzielenie cukru na dwie logiczne kategorie:

- cukier przeznaczony do fermentacji,
- cukier przeznaczony do osiągnięcia docelowej słodyczy.

To rozróżnienie jest zgodne z praktyką domowego winiarstwa, gdzie backsweetening oznacza dosładzanie po stabilizacji lub po zatrzymaniu fermentacji, a nie traktowanie całego cukru jako jednej puli o jednym przeznaczeniu [cite:240][cite:246][cite:257].

Poprawne jest również założenie, że przy winie niewytrawnym draft procesu powinien zawierać osobne kroki związane z cukrem fermentacyjnym i końcową korektą słodyczy, ponieważ te dwa działania pełnią inną funkcję technologiczną [cite:240][cite:257].

### Co wymaga doprecyzowania

Jeśli tolerancja drożdży jest wyższa niż planowana moc, a użytkownik chce zachować cukier resztkowy, fermentacja nie zatrzyma się samoczynnie we właściwym momencie tylko dlatego, że użytkownik zadeklarował niższy `target_abv`. W takim przypadku plan wymaga działania pośredniego: zatrzymania lub przerwania fermentacji albo innej formy kontroli procesu przed pełnym odfermentowaniem [cite:240][cite:246].

To oznacza, że Fermenta nie powinna traktować `target_abv` jako gwarancji wyniku końcowego. Powinna traktować je jako parametr planowany i na jego podstawie generować odpowiednie kroki oraz ostrzeżenia [cite:240][cite:257].

## Zmiana modelu słodyczy

W MVP nie należy eksponować osobnego pola `sweetness_strategy` jako decyzji podejmowanej ręcznie przez użytkownika.

Zamiast tego aplikacja powinna:

- przyjąć od użytkownika planowaną słodycz,
- obliczyć planowaną ilość cukru do fermentacji,
- obliczyć planowaną ilość cukru do osiągnięcia końcowej słodyczy,
- automatycznie zbudować draft procesu odpowiadający tym założeniom,
- dodać odpowiednie ostrzeżenia zależnie od relacji między `target_abv` a `yeast_tolerance`.

Takie podejście lepiej odpowiada założeniu, że Fermenta ma być prosta i zrozumiała dla mniej technicznego użytkownika.

## Zmiana modelu składników

Dodany cukier powinien być modelowany jako zwykła pozycja na liście składników, ale z technicznym rozróżnieniem jego przeznaczenia.

### Rekomendowany model

Każdy składnik może mieć co najmniej:

- nazwę,
- ilość,
- jednostkę,
- opcjonalną zawartość cukru,
- typ techniczny.

Dla cukru aplikacja powinna automatycznie tworzyć oddzielne pozycje:

- `sugar_for_fermentation`
- `sugar_for_sweetness`

Użytkownik powinien widzieć te pozycje na liście składników i mieć możliwość ich ręcznej korekty. Dzięki temu aplikacja pozostaje uczciwa wobec użytkownika: pokazuje, co zostało wyliczone, ale nie blokuje ręcznej zmiany planu.

## Zmiana logiki draftu procesu

Dla win niewytrawnych draft procesu powinien uwzględniać trzy niezależne elementy:

1. dodanie cukru do fermentacji,
2. ewentualne zatrzymanie lub przerwanie fermentacji,
3. dodanie cukru do końcowej słodyczy.

### 1. Cukier do fermentacji

Aplikacja powinna wyliczyć ilość cukru potrzebną do osiągnięcia planowanej mocy i dodać ją jako automatyczną pozycję składnika. W draftcie procesu powinien pojawić się krok dodania tego cukru [cite:257].

Dopuszczalne jest także zasugerowanie dwóch kroków dodawania cukru fermentacyjnego, ale bez wymuszania proporcji i bez udawania, że istnieje jeden uniwersalny poprawny podział. To uproszczenie jest zgodne z praktyką, w której dodatki cukru bywają etapowane, ale nie muszą być modelowane sztywno w MVP [cite:257].

### 2. Zatrzymanie lub przerwanie fermentacji

Jeśli planowana słodycz nie jest wytrawna i tolerancja drożdży jest wyższa niż planowana moc, draft procesu powinien zawierać krok związany z zatrzymaniem, przerwaniem lub kontrolą fermentacji przed pełnym odfermentowaniem [cite:240][cite:246].

Ten krok nie powinien być obowiązkowy. Użytkownik może go usunąć, ale w takim przypadku aplikacja powinna nadal zachować ostrzeżenie, że planowany efekt końcowy może nie zostać osiągnięty.

### 3. Cukier do słodyczy

Jeśli planowana słodycz nie jest wytrawna, aplikacja powinna wyliczyć i dodać osobną pozycję cukru przeznaczoną do osiągnięcia końcowej słodyczy oraz dodać odpowiedni krok procesu. Użytkownik może później zmienić ilość tej pozycji zgodnie ze swoim przepisem lub doświadczeniem [cite:240][cite:246][cite:257].

## Zmiana logiki ostrzeżeń

Ostrzeżenia powinny być oparte na prostych regułach.

### Błąd planu

Aplikacja pokazuje błąd, jeśli:

- `target_abv > yeast_tolerance`

Taki plan jest wewnętrznie niespójny, ponieważ zakłada moc wyższą niż zadeklarowana tolerancja drożdży.

### Ostrzeżenie o ryzyku wytrawności lub wyższej mocy

Aplikacja pokazuje ostrzeżenie, jeśli:

- `target_sweetness != dry`
- oraz `yeast_tolerance > target_abv`

Przykładowa treść ostrzeżenia:

> Planowana słodycz przy tej tolerancji drożdży wymaga zatrzymania lub przerwania fermentacji. Pominięcie tego kroku może spowodować bardziej wytrawny efekt lub inną moc końcową niż planowana.

To ostrzeżenie jest zgodne z praktycznym problemem backsweeteningu i kontroli fermentacji: samo zadeklarowanie słodkości nie wystarcza, jeśli drożdże mogą dalej pracować [cite:240][cite:246].

### Ostrzeżenie o niepewności wyniku

Aplikacja może dodatkowo pokazać łagodne ostrzeżenie, że planowana moc i słodycz są wartościami oczekiwanymi, a nie gwarantowanym wynikiem końcowym. To ważne szczególnie wtedy, gdy użytkownik usuwa kroki dodane automatycznie przez aplikację.

## Zmiana semantyki parametrów

Aby uniknąć wrażenia, że aplikacja "kłamie", należy doprecyzować znaczenie parametrów.

### `target_abv`

`target_abv` oznacza **planowaną moc końcową**, a nie automatycznie osiągnięty wynik.

### `target_sweetness`

`target_sweetness` oznacza **planowany profil końcowy**, który może wymagać dodatkowych działań w procesie.

### Rola Fermenty

Fermenta nie ma gwarantować wyniku. Ma:

- przeliczyć plan,
- pokazać zależności,
- wygenerować sensowny draft procesu,
- ostrzec użytkownika o miejscach ryzyka.

## Rekomendacja do MVP

Na potrzeby MVP należy przyjąć następujące zasady:

- użytkownik nie wybiera ręcznie `sweetness_strategy`,
- aplikacja automatycznie buduje draft procesu na podstawie planowanej mocy, słodyczy i tolerancji drożdży,
- cukier jest modelowany jako zwykły składnik z typem technicznym,
- dla win niewytrawnych aplikacja może automatycznie dodać dwie pozycje cukru: do fermentacji i do słodyczy,
- draft procesu może zawierać jeden lub dwa kroki dodania cukru fermentacyjnego,
- dla win niewytrawnych aplikacja może dodać krok zatrzymania lub przerwania fermentacji, jeśli tolerancja drożdży jest wyższa niż planowana moc,
- użytkownik może usuwać i edytować te kroki, ale aplikacja zachowuje ostrzeżenia o możliwym odejściu od planu.

## Krótka formuła do aktualizacji głównego dokumentu

Można to skrócić do poniższej zasady:

> Dla win niewytrawnych Fermenta rozdziela cukier na część fermentacyjną i część przeznaczoną do końcowej słodyczy, a draft procesu automatycznie uwzględnia dodanie cukru, ewentualne zatrzymanie fermentacji oraz końcową korektę słodyczy. Planowana moc i słodycz są traktowane jako wartości oczekiwane, nie gwarantowane.
