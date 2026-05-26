# Fermenta - idea

## Cel aplikacji

Fermenta to aplikacja do planowania i prowadzenia domowych nastawów wina. Ma zastąpić papierowy formularz i luźne notatki jednym uporządkowanym miejscem, w którym użytkownik może:

- zaplanować nowy nastaw,
- policzyć podstawowe parametry receptury,
- sprawdzić spójność planu,
- wygenerować wstępny plan procesu,
- prowadzić dziennik kolejnych kroków,
- zapisać efekt końcowy jednej partii.

Aplikacja nie ma udawać eksperckiego systemu enologicznego. Jej rolą jest pomaganie użytkownikowi w uporządkowaniu procesu, przeliczeniu podstawowych parametrów i dokumentowaniu przebiegu nastawu.

## Użytkownik i jego problem

### Kim jest użytkownik

Docelowym użytkownikiem jest osoba przygotowująca domowe wino w małej skali, hobbystycznie lub pół-hobbystycznie. Taki użytkownik:

- korzysta z własnych przepisów, notatek albo gotowych formularzy papierowych,
- nie zawsze pracuje według jednego sztywnego schematu,
- chce mieć kontrolę nad procesem,
- chce pamiętać, co zostało już zrobione i co planował dalej,
- chce uniknąć chaosu w notatkach i prostych błędów na etapie planowania.

### Jaki ma problem

Najważniejsze problemy użytkownika:

- plan receptury i procesu jest rozproszony między kartką, pamięcią i przypadkowymi notatkami,
- łatwo zgubić informacje o składnikach, ilościach i podjętych decyzjach,
- trudno szybko policzyć, ile cukru trzeba dodać do docelowej objętości i mocy,
- trudno ocenić, czy plan jest spójny, np. względem tolerancji drożdży albo wybranej strategii uzyskania słodyczy,
- kolejne kroki procesu nie zawsze są zapisane lub są zapisane nieczytelnie.

### Jak aplikacja usuwa ten problem

Fermenta daje użytkownikowi jedno miejsce do:

- zapisania parametrów partii,
- wykonania podstawowych obliczeń,
- sprawdzenia spójności planu,
- wygenerowania draftu procesu,
- ręcznego dostosowania kolejnych kroków,
- zapisania przebiegu i końcowego efektu.

Aplikacja nie odbiera użytkownikowi kontroli. Zamiast tego przygotowuje punkt wyjścia i porządkuje proces.

## Co aplikacja ma robić

W pierwszej wersji aplikacja ma wspierać jeden główny scenariusz: utworzenie i prowadzenie pojedynczego nastawu.

Aplikacja ma umożliwiać:

- utworzenie nowego nastawu,
- wpisanie planowanej objętości,
- wpisanie docelowej mocy,
- określenie planowanej słodyczy,
- wybór typu procesu,
- wpisanie użytych drożdży wraz z nazwą i tolerancją alkoholu,
- wpisanie listy składników z ilością i zawartością cukru podawaną przez użytkownika,
- obliczenie brakującej ilości cukru potrzebnej do osiągnięcia docelowej mocy,
- pokazanie ostrzeżeń lub błędów, jeśli plan jest niespójny,
- wygenerowanie wstępnej listy sugerowanych kroków procesu,
- ręczne edytowanie, usuwanie i dodawanie kroków,
- prowadzenie dziennika procesu jako listy wpisów z datą i notatką,
- zapisanie efektu końcowego partii.

## Co aplikacja ma robić dobrze

Najważniejszą wartością aplikacji nie jest samo przechowywanie danych. Rdzeniem produktu ma być połączenie trzech rzeczy:

1. **planowania** — użytkownik definiuje parametry partii,
2. **walidacji** — aplikacja sprawdza, czy plan ma sens,
3. **inicjowania procesu** — aplikacja proponuje początkowy draft kolejnych kroków, który użytkownik może dopasować do praktyki.

To oznacza, że aplikacja ma działać jak planer i dziennik procesu, a nie tylko jak notatnik.

## Jasny zakres produktu

### Co ma robić

Aplikacja ma:

- prowadzić użytkownika przez utworzenie planu nastawu,
- wykonać podstawowe obliczenia receptury,
- wykryć wybrane niespójności planu,
- zasugerować początkowe kroki procesu,
- pozwolić użytkownikowi dowolnie modyfikować plan,
- przechowywać historię przebiegu konkretnej partii.

### Czego na pewno nie ma robić

Aplikacja na pewno nie ma być:

- pełnym systemem eksperckim do enologii,
- automatycznym sterownikiem procesu fermentacji,
- narzędziem do analizy laboratoryjnej,
- encyklopedią przepisów i odmian win,
- sklepem z akcesoriami lub surowcami,
- społecznościową platformą wymiany receptur,
- aplikacją do automatycznego podejmowania decyzji za użytkownika,
- aplikacją narzucającą jeden słuszny proces produkcji.

## MVP

### Co musi znaleźć się w MVP

MVP powinno zawierać tylko to, co potrzebne do zamknięcia jednego pełnego przepływu użytkownika:

- utworzenie konta użytkownika i dostęp do własnych nastawów,
- stworzenie nowej partii,
- wpisanie podstawowych parametrów partii,
- wpisanie drożdży: nazwa + tolerancja alkoholu,
- wpisanie składników: nazwa + ilość + zawartość cukru,
- obliczenie brakującej ilości cukru,
- podstawową walidację spójności planu,
- dwa typy procesu, np. fermentacja na miazdze i fermentacja na soku / moszczu,
- wygenerowanie draftu procesu na podstawie wybranego typu i parametrów,
- możliwość ręcznej edycji kroków,
- możliwość dodawania własnych wpisów do dziennika,
- możliwość zapisania końcowego efektu partii.

### Co może zostać dodane później

Po MVP można rozważyć:

- eksport planu i kroków do pliku ICS,
- bazę referencyjną popularnych składników i drożdży,
- bazę gotowych stylów i przepisów,
- historię wersji planu partii,
- porównywanie wielu partii,
- lepsze ostrzeżenia oparte o większą liczbę reguł,
- tagowanie wpisów typu pomiar / obciąg / dosładzanie / butelkowanie,
- szablony własnych procesów użytkownika,
- udostępnianie receptur innym użytkownikom,
- statystyki i podsumowania z wielu partii.

## Logika biznesowa

Logika biznesowa aplikacji powinna być jasna i możliwa do opisania w jednym zdaniu:

> Aplikacja oblicza parametry nastawu, sprawdza spójność planu fermentacji i generuje draft procesu, który użytkownik może dalej dostosować do własnego przepisu.

### Na czym polega ta logika

W MVP aplikacja:

- sumuje cukier wniesiony przez składniki,
- oblicza brakującą ilość cukru potrzebną do osiągnięcia docelowej mocy,
- sprawdza, czy docelowa moc nie przekracza tolerancji drożdży,
- pokazuje ostrzeżenia, jeśli planowana słodycz wymaga dodatkowej decyzji technologicznej,
- generuje wstępne kroki procesu zależne od typu nastawu,
- pozwala użytkownikowi przerobić draft na własny rzeczywisty plan.

## Model użytkowania

Podstawowy scenariusz wygląda tak:

1. Użytkownik tworzy nowy nastaw.
2. Uzupełnia parametry planu.
3. Dodaje drożdże i składniki.
4. Aplikacja wykonuje obliczenia.
5. Aplikacja pokazuje ostrzeżenia lub błędy planu.
6. Aplikacja generuje sugerowane kroki procesu.
7. Użytkownik modyfikuje plan według własnych preferencji.
8. Użytkownik zapisuje kolejne działania i obserwacje jako wpisy dziennika.
9. Na końcu zapisuje efekt końcowy partii.

## Założenia produktowe

- Użytkownik zachowuje kontrolę nad procesem.
- Sugestie aplikacji mają charakter pomocniczy, nie obowiązkowy.
- Wpisy procesu mogą być generowane automatycznie lub dodane ręcznie.
- Pomiary i obserwacje nie muszą być modelowane osobnymi polami w MVP — mogą być zwykłymi wpisami z opisem w notatce.
- Reguły procesu są uproszczone i mają dawać sensowny punkt startowy, a nie pełny model rzeczywistości.

## Pytania do doprecyzowania w PRD

Na kolejnym etapie warto odpowiedzieć między innymi na pytania:

- jakie dokładnie typy procesu mają wejść do MVP,
- jakie reguły walidacji są obowiązkowe, a jakie opcjonalne,
- kiedy aplikacja ma pokazywać błąd, a kiedy tylko ostrzeżenie,
- jak szczegółowy ma być draft procesu,
- czy wpis procesu ma mieć tylko datę i notatkę, czy także prosty status,
- czy eksport ICS ma wejść do MVP, czy dopiero później,
- jak opisać efekt końcowy partii,
- jak wygląda lista partii i ich podstawowe statusy.

## Draft formularza inspirowany załączonym wzorem

Poniżej roboczy szkic formularza, inspirowany załączonym papierowym arkuszem.

### Sekcja 1: Dane partii

- Nazwa partii
- Rodzaj / typ procesu
- Data nastawu
- Planowana objętość
- Docelowa moc
- Planowana słodycz
- Strategia słodyczy (np. natural stop / stabilizacja i dosładzanie później)

### Sekcja 2: Drożdże

- Nazwa drożdży
- Tolerancja alkoholu
- Uwagi

### Sekcja 3: Składniki

Tabela składników:

| Składnik | Ilość | Jednostka | Zawartość cukru na jednostkę | Uwagi |
|----------|-------|-----------|------------------------------|-------|
| Owoc / sok / cukier / inne |  |  |  |  |

### Sekcja 4: Obliczenia i walidacja

- Cukier wniesiony przez składniki
- Cukier wymagany do osiągnięcia docelowej mocy
- Brakująca ilość cukru do dodania
- Ostrzeżenia / błędy planu

### Sekcja 5: Dziennik procesu

Tabela kroków procesu:

| Data lub offset | Tytuł kroku | Notatki | Status |
|-----------------|------------|---------|--------|
| Dzień 0 / konkretna data | Przygotowanie nastawu |  | planned / done / skipped |

Przykładowe wpisy:

- pomiar i obserwacja,
- obciąg,
- dosłodzenie,
- zmiana planu,
- ocena klarowności,
- butelkowanie.

### Sekcja 6: Efekt końcowy

- Data zakończenia
- Opis efektu końcowego
- Wnioski na przyszłość
- Ocena partii

## Kryteria sukcesu

- Minimum 70% nowych partii jest tworzonych z użyciem wygenerowanego draftu procesu
- Minimum 70% partii zawiera conajmniej jedną ręczną modyfikację lub własny wpis w dzienniku po wygenerowaniu draftu
- Minimum 80% rozpoczętych partii otrzymuje później kolejne wpisy dziennika lub zapis efektu kończowego

## Podsumowanie robocze

Fermenta ma być małą aplikacją do planowania i prowadzenia domowych nastawów wina. Jej rdzeniem nie jest sam formularz ani sam dziennik, lecz połączenie obliczeń, walidacji planu i generowania draftu procesu, który użytkownik może dalej dostosować do własnej praktyki.

Inspiracja jest wzięta ze zdjęcia fizycznego formularza do śledzenia procesu (mywinery-form.jpg)