import React, { useState } from 'react';
import { Info, X, FileText, CheckCircle2, ShieldCheck, Zap, Layers, BarChart3, TrendingUp, Mail } from 'lucide-react';

interface ProgramInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProgramInfoModal: React.FC<ProgramInfoModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'changelog'>('info');

  if (!isOpen) return null;

  const changelogContent = `================================================================================
CHANGELOG - HISTORIA ZMIAN I WERSJI STOCKSIGNALPL
================================================================================

================================================================================
Wersja 2.0 (2026-11-05) - Przejście na 100% Dane Rzeczywiste (WSE GPW / NBP / COMEX) i Całkowite Usunięcie Symulacji Losowej
================================================================================
1. CAŁKOWITE WYELIMINOWANIE FAŁSZYWYCH DANYCH I GENERATORA LOSOWYCH TICKÓW:
   - Całkowicie usunięto z silnika aplikacji losowy szum i funkcję sztucznych mikro-ruchów cenowych (Math.random).
   - Wyceny spółek, bilanse portfeli, zyski/straty oraz poziomy Stop Loss i Take Profit bazują w 100% na autentycznych transakcjach rynkowych.
   - Wyeliminowano zafałszowane sygnały – strategie i backtesty odzwierciedlają prawdziwy stan rynku.

2. PODPIĘCIE REALNEGO FEEDU NOTOWAŃ GPW (WARSAW STOCK EXCHANGE):
   - Wdrożono serwerowy silnik proxy łączący się bezpośrednio z rynkiem akcji GPW (symbole .WA, m.in. PKN, KGH, PKO, PZU, CDR, DNP, LPP, ALE, PEO, KRU, XTB, TPE, PGE, CPS, BDX, CAR, 11B, ACP, MIL, ENA, OPL, JSW, KTY, SAN).
   - Prawdziwe kursy transakcyjne, realne dzienne wolumeny obrotu oraz oficjalne kursy odniesienia (Previous Close).
   - Realne świece historyczne OHLC (Open, High, Low, Close, Volume) dla wszystkich interwałów (1D intraday 5m/15m, 1W, 2W, 1M, 3M, 6M, 1Y).

3. OFICJALNA TABELA KURSÓW NBP I REALNE SUROWCE ŚWIATOWE:
   - Bezpośrednia integracja z publicznym API Narodowego Banku Polskiego (NBP) w celu pobierania oficjalnego kursu średniego USD/PLN.
   - Realne notowania kontraktów surowcowych z giełd COMEX / NYMEX (Złoto GC=F, Srebro SI=F, Ropa Brent BZ=F, Ropa WTI CL=F, Gaz Ziemny NG=F, Miedź HG=F, Platyna PL=F, Pszenica ZW=F) z automatycznym, precyzyjnym przeliczeniem na złote (PLN).

4. RZECZYWISTY WSKAŹNIK SENTYMENTU I BENCHMARK WIG20:
   - Wskaźnik „Optymizm Rynku GPW” kalkulowany na żywo z realnego bilansu spółek rosnących i spadających na parkiecie oraz pozycji WIG20 względem średnich kroczących.
   - Realna wycena indeksu WIG20 (WIG20.WA) i kontraktów terminowych FW20.
   - Nowy znacznik „100% Dane Rzeczywiste (GPW / NBP)” na górnej belce aplikacji potwierdzający brak symulacji.

================================================================================
Wersja 2.0 (2026-11-07) - Pełna Automatyzacja Auto-Pilota z Zabezpieczeniem Sesji Rynkowych 24/7, Sygnały Dźwiękowe & Dymki Toast ze Znacznikiem Czasu
================================================================================
1. BEZWZGLĘDNA WERYFIKACJA GODZIN SESJI RYNKOWYCH (GPW 09:00-17:00 & SUROWCE 24/5):
   - Wdrożono silnik weryfikacji dostępności rynków w MarketSessionService.isMarketOpenForStock.
   - Pętla Auto-Pilota oraz zlecenia kupna/sprzedaży są wstrzymywane na zamkniętych rynkach (po 17:00, przed 09:00, w weekendy oraz polskie święta giełdowe).
   - Handel surowcowy działa w systemie 24/5 (od niedzieli 23:00 do piątku 23:00) i jest wstrzymywany w soboty i niedziele przed otwarciem.
   - Wyeliminowano błędne generowanie wpisów transakcyjnych w dni wolne oraz oczyszczono Dziennik Tradera z nieprawidłowych wpisów weekendowych.

2. POWIADOMIENIA DŹWIĘKOWE WEB AUDIO API & WYSKAKUJĄCE KARTY TOAST:
   - Dedykowany syntezator dźwięków w AudioService (playBuyChime, playTpChime, playSlChime) generujący syntezowane akordy audio przy transakcjach KUPNO, TP oraz SL.
   - Wyskakujące floating karty Toast z pełną datą i godziną (DD.MM.YYYY, HH:MM:SS), nazwą portfela, kursem, wolumenem oraz PnL z opcją auto-dismiss (6 sek.).

3. INTERAKTYWNY TICKER NOTOWAŃ Z NAWIGACJĄ DO KONSENSUSU:
   - Efekt Hover: najechanie myszką na scrollowany pasek notowań GPW i Surowce natychmiast zatrzymuje przewijanie.
   - Po kliknięciu dowolnego kafelka waloru następuje natychmiastowe przełączenie widoku na Etap 2: Live Konsensus z załadowaniem pełnej analizy wybranego instrumentu.

4. DYNAMICZNIE SORTOWANE TOOLTIPY NA WSZYSTKICH WYKRESACH RECHARTS:
   - Wszystkie dymki informacyjne (AllPortfoliosTooltip, CustomTooltip, OptimismTooltip) sortują pozycje w legendzie według ich wartości w danym punkcie w czasie (najwyższa wartość na samej górze).

5. ZAPIS POWIADOMIEŃ W TLE I GOTOWOŚĆ DO EXPORTU NA GITHUB:
   - Zaktualizowano dokumentację instalacji w instalserver.txt, pakiet package.json (v2.0.0) oraz metadata.json.

================================================================================
Wersja 1.9 (2026-11-05) - Zbiorczy Wykres Portfeli (PLN i %), Ręczne Zamykanie Pozycji, Ticker GPW i Surowce ($/zł) oraz Interaktywne Tooltipy Sentymentu
================================================================================
1. ZBIORCZY WIDOK „WSZYSTKIE PORTFELE” I WIELOLINIOWY WYKRES PORÓWNAWCZY (W ZŁ I %):
   - Wdrożono nowy kafelek „Wszystkie Portfele (Zbiorczo)” na początku poziomego menu wyboru portfeli z łącznym saldem funduszu w PLN i sumaryczną stopą zwrotu.
   - Zaawansowany wieloliniowy wykres Recharts prezentujący symultanicznie krzywe kapitału wszystkich portfeli modelowych GPW oraz linię benchmarku WIG20.
   - Błyskawiczny przełącznik jednostek: Wartość w zł (PLN) vs Stopa zwrotu (%).
   - Pełna obsługa filtrów zakresu czasowego: 1D (sesja dzisiejsza), 3D (ostatnie 3 sesje), 1W, 2W, 1M, 3M, 6M oraz Wszystkie.
   - Bogaty Custom Tooltip na hover pokazujący wyceny i stopy zwrotu wszystkich strategii jednocześnie.
   - Kafelki podsumowania funduszu (Łączny Kapitał, Zysk, Rezerwa Gotówkowa, Portfel Lider, Aktywne Pozycje) oraz szczegółowa tabela porównawcza z bezpośrednią nawigacją.

2. RĘCZNE ZAMYKANIE POZYCJI („ZAMKNIJ”) W TABELACH OTWARTYCH POZYCJI:
   - Dodano kolumnę 'Akcja' z przyciskiem „Zamknij” przy każdej aktywnej pozycji (w widoku pojedynczego portfela oraz w widoku zbiorczym funduszu).
   - Dialog potwierdzenia ze szczegółowym podsumowaniem wolumenu, kursu rynkowego, wartości i szacowanego PnL.
   - Pełna integracja z silnikiem portfolioService: natychmiastowe zasilenie gotówki portfela (cashPln), aktualizacja salda, usunięcie pozycji, rejestracja zrealizowanego zlecenia w Dzienniku Tradera i konfetti sukcesu przy zysku.

3. PEŁNOSZEROKOŚCIOWY TICKER NOTOWAŃ „GPW I SUROWCE” Z CENAMI W $ I ZŁ:
   - Nowa architektura górnego paska: Wiersz 1 ze statusem sesji GPW i Optymizmem rynku + Wiersz 2 na pełną szerokość strony (w-full) z płynnym tickerem notowań.
   - Notowania surowców podają teraz w pierwszej kolejności cenę w dolarach ($) oraz przeliczenie w PLN (zł):
     * Złoto Spot (XAU): $2 745.20 (10 850 zł),
     * Srebro Spot (XAG): $32.80 (129.50 zł),
     * Ropa Naftowa Brent (OIL): $76.40 (312.50 zł),
     * Ropa Naftowa WTI (CL): $72.15 (294.80 zł),
     * Miedź, Platyna, Gaz Ziemny, Pszenica.
   - W tabelach otwartych pozycji portfeli przy walorach surowcowych wyświetla się również cena w dolarach ($).
   - Indeksy GPW (WIG20, FW20 Futures, mWIG40, sWIG80, WIG-VIX) oraz kursy spółek z portfeli z pauzą po najechaniu myszą (pause-on-hover).

4. INTERAKTYWNE TOOLTIPY I DYMKI OBJAŚNIAJĄCE W OKNIE „OPTYMIZM RYNKU GPW”:
   - Zastąpiono statyczny wykres SVG responsywnym wykresem Recharts AreaChart z dymkiem (Tooltip) pojawiającym się przy najechaniu na dowolny punkt w czasie.
   - Dodano przełącznik widoku: 14 sesji (dzienny trend EOD) vs Dziś (Live intraday z podziałem na godziny sesji 09:00 - 17:00).
   - Wdrożono szczegółowe dymki objaśniające (z ikonami pomocniczymi '?' i kartami hover) dla:
     * Plakietki sentymentu 68% (Hossa / Chciwość) – interpretacja fazy rynku i zalecenia dla tradera,
     * Kafelka Aktualny Poziom – algorytm 4 wag rynkowych GPW (SMA50/200, WIG-VIX, Advance/Decline, wolumen),
     * Kafelka Indeks Strachu (WIG-VIX) – implikowana 30-dniowa zmienność opcji na WIG20 i strefy ryzyka,
     * Kafelka WIG20 Benchmark – znaczenie 20 największych spółek blue-chip dla rynku.

5. DETERMINISTYCZNE WYKRESY ŚWIECOWE (OHLC) DLA POJEDYNCZYCH WALORÓW:
   - Rozwijany mini-wykres świecowy (OHLC) pod każdym walorem w tabeli pozycji z poziomami Wejścia, SL i Multi-TP (TP1, TP2, TP3).
   - Wdrożenie deterministycznego pseudo-generatora liczb losowych (seededRandom), gwarantującego brak drgania i przeskakiwania świec przy ruchach myszy i re-renderach.
   - Przełącznik stylów: Świecowy (OHLC) / Liniowy oraz pełne zakresy czasowe 1D, 3D, 1W, 2W, 1M, 3M, 6M, Wszystkie.

================================================================================
Wersja 1.8 (2026-11-04) - Moduł Analizy i Tradingu na Rynku Surowców & Portfele Safe Haven
================================================================================
1. PEŁNA INTEGRACJA RYNKU SUROWCOW & METALI SZLACHETNYCH:
   - Zaimplementowano kompleksową bazę surowcową (z notowaniami przeliczanymi na PLN):
     * Złoto Spot (XAU.PL - 1 oz troy) – kluczowy aktyw bezpiecznej przystani (Safe Haven),
     * Ropa Naftowa Brent (CB.F - 1 bbl) – benchmark ropy z Morza Północnego,
     * Ropa Naftowa WTI (CL.F - 1 bbl) – benchmark ropy amerykańskiej Texas Light,
     * Platyna Spot (XPT.PL - 1 oz) – metal szlachetny i kluczowy surowiec przemysłowy,
     * Srebro Spot (XAG.PL - 1 oz) – metal szlachetny oraz komponent fotowoltaiki,
     * Miedź COMEX (HG.F - 1 lb) – wskaźnik koniunktury ("Doktor Miedź") i transformacji EV,
     * Gaz Ziemny (NG.F - Henry Hub) – kluczowy surowiec grzewczy i elektroenergetyczny,
     * Pszenica CBOT (W.F - 1 bu) – bazowy surowiec rolny i bezpieczeństwa żywnościowego.

2. ANALIZA TECHNICZNA, FORMACJE ŚWIECOWE I KONSENSUS DLA SUROWCÓW:
   - Wszystkie 10 algorytmów konsensusu (Stooq TA Screener, RSI14, MACD, Złoty Krzyż SMA50/SMA200,
     formacje świecowe Młot, Objęcie Hossy, itp.) działają identycznie i w czasie rzeczywistym
     dla surowców i metali.
   - Wykres świecowy Recharts OHLC umożliwia badanie historii, średnich kroczących SMA20/SMA50
     i dynamiki cenowej surowców w locie (0 MB narzutu na bazę danych).

3. NOWY PORTFEL MODELOWY: "PORTFEL SUROWCE & SAFE HAVEN" (6-IN-1):
   - Wdrożono 6. modelowy portfel z aktywnymi pozycjami w Złocie, Ropie Brent, Platynie i Pszenicy.
   - Pełna obsługa mechanizmu Multi-TP (33/33/34), automatycznego podciągania Stop Loss na Break-Even
     oraz ochrony kapitału przed inflacją.
   - Możliwość tworzenia portfeli dedykowanych czysto surowcowych lub portfeli mieszanych (akcje GPW + surowce).

4. FILTROWANIE I INTUICYJNA NAWIGACJA W KONSENSUSIE I KALKULATORZE:
   - W zakładce Live Konsensus i w Rankingu dodano dedykowany filtr 'Surowce & Metale',
     umożliwiający natychmiastowe przełączanie między rynkami akcji GPW a rynkiem surowcowym.
   - W kalkulatorze pozycji zaktualizowano etykiety, umożliwiając precyzyjną symulację wolumenu
     i ryzyka w PLN dla kontraktów surowcowych.

================================================================================
Wersja 1.7 (2026-11-04) - Lokalna Baza Danych PostgreSQL, Docker & Docker Compose dla Serwera Ubuntu
================================================================================
1. PRZEJŚCIE NA LOKALNĄ BAZĘ DANYCH POSTGRESQL NA WŁASNYM SERWERZE UBUNTU:
   - Całość bazy danych (konta użytkowników, portfele, pozycje akcyjne, dziennik tradera
     oraz ustawienia) działa w lokalnym silniku PostgreSQL 16.
   - Użytkownik zachowuje pełną kontrolę i suwerenność nad swoimi danymi.

2. CAŁKOWICIE TRANSPARENTNE DZIAŁANIE BEZ PRZYCISKÓW SYNCHRONIZACJI:
   - Usunięto zbędne przyciski i etykiety synchronizacji w chmurze. Użytkownik nie musi
     pamiętać o żadnej synchronizacji – po zalogowaniu na dowolnym urządzeniu (telefon,
     tablet, komputer) dane są automatycznie odczytywane i zapisywane bezpośrednio
     w bazie PostgreSQL na serwerze Ubuntu.

3. KONTENERYZACJA DOCKER I DOCKER COMPOSE:
   - Przygotowano wieloetapowy plik 'Dockerfile' optymalizujący kompilację Node.js i Vite.
   - Przygotowano plik 'docker-compose.yml' definiujący usługi:
     * stocksignalpl-postgres (PostgreSQL 16 Alpine z trwałym wolumenem postgres_data),
     * stocksignalpl-app (Node.js/Express na porcie 3000 powiązany siecią wewnętrzną).
   - Wdrożenie na serwerze Ubuntu sprowadza się do jednego polecenia:
     'docker compose up -d --build'.
   - Utworzono plik skryptu inicjalizacji bazy danych 'init.sql'.

4. AKTUALIZACJA DOKUMENTACJI WDROŻENIOWEJ:
   - Zaktualizowano instrukcję instalacji w pliku 'instalserver.txt' z pełnymi krokami
     dla Ubuntu, Docker Compose, Nginx Reverse Proxy oraz bezpłatnego certyfikatu SSL.

================================================================================
Wersja 1.6 (2026-11-04) - Baza Danych w Chmurze (Firebase Firestore) & Logowanie z Różnych Urządzeń
================================================================================
1. LOGOWANIE Z DOWOLNYCH URZĄDZEŃ (MULTI-DEVICE ACCESS):
   - Wdrożono bezpieczne logowanie za pomocą konta Google (Firebase Authentication),
     umożliwiając inwestorowi logowanie się z wielu urządzeń jednocześnie (smartfon,
     tablet, laptop, komputer stacjonarny).
   - Zachowano opcję szybkiego logowania lokalnego dla testów oraz użytkowników offline.

2. PEŁNA SYNCHRONIZACJA PORTFELI I TRANSAKCJI W CHMURZE (FIRESTORE):
   - Zintegrowano bezserwerową bazę danych w chmurze Google Cloud / Firebase Firestore
     o zerowym narzucie na dysk serwera (lekkie, darmowe instancje bezobsługowe).
   - Dane inwestora są bezpiecznie odizolowane na poziomie reguł bezpieczeństwa Firestore:
     * Portfele modelowe i własne strategie (/users/{userId}/portfolios/{portfolioId}),
     * Dziennik transakcji Tradera (/users/{userId}/trades/{tradeId}),
     * Ustawienia interfejsu i preferencje motywu (/users/{userId}/settings/app).
   - Dwukierunkowa synchronizacja w czasie rzeczywistym (Real-time listener onSnapshot):
     zmiany wprowadzone na telefonie pojawiają się natychmiast na ekranie komputera.

3. WSKAŹNIK STANU SYNCHRONIZACJI W CHMURZE W PASKU GÓRNYM:
   - W belce nawigacyjnej dodano dedykowaną etykietę "Sync Chmura (Multi-Device)"
     z pulsującą zieloną diodą statusu, informującą o aktywnym połączeniu z bazą.

4. BEZPIECZEŃSTWO ZGODNE ZE STANDARDEM ABAC & ZERO-TRUST:
   - Zaimplementowano rygorystyczne reguły bezpieczeństwa (firestore.rules)
     z walidacją typów pól, limitów długości stringów i blokadą nieautoryzowanego dostępu.
   - Uprawnienia administratora powiązane z dedykowanym adresem e-mail.

================================================================================
Wersja 1.5 (2026-11-04) - Oficjalne Logo Tarczy, Barwy Zielono-Żółte, Wykres Świecowy Recharts OHLC & Optymalizacja Bazy
================================================================================
1. NOWE OFICJALNE LOGO GIEŁDOWE (LOGO.PNG):
   - Wdrożono nową grafikę tarczy z zielonym bykiem i złotymi akcentami (logo.png).
   - Tytuł aplikacji sformatowano w kontrastowych barwach zieleni i żółci:
     'Stock' (neon emerald) + 'Signal' (neon gold/yellow) + 'PL' (neon emerald).
   - Zaktualizowano identyfikator wersji na v1.5.

2. PEŁNA RESTRUKTURYZACJA KOLORYSTYKI (NEON ZAMIAST CZERWIENI):
   - Czerwone elementy interfejsu (pochodzące z pierwotnego motywu kryptowalut)
     zostały zastąpione nowoczesnymi akcentami neonowej zieleni (emerald) i błękitu.
   - Kolor czerwony/różowy został ściśle zachowany wyłącznie w sytuacjach ostrzegawczych
     oraz rynkowych:
     * Spadki kursów akcji i ujemna zmiana dzienna (change < 0),
     * Strata kapitałowa PnL pozycji i portfela,
     * Zlecenia obronne Stop Loss (SL),
     * Formacje i sygnały podażowe (bessa / SPRZEDAJ),
     * Przyciski nieodwracalnego usuwania konta lub portfela.

3. MINIMALNY ROZMIAR APLIKACJI I BAZY DANYCH (0 MB NA DYSKU SERWERA):
   - Przeprowadzono audyt architektury pod kątem minimalnego zużycia zasobów serwera:
     * Żadne duże bazy danych, zrzuty notowań ani archiwalne pliki CSV nie są
       zapisywane na stałe na serwerze.
     * Wszystkie kursy i świece pobierane są dynamicznie w locie (on-demand)
       przez proxy Stooq i przetwarzane w strumieniu.
     * Profile inwestorów, ustawienia i dziennik transakcji zapisywane są lokalnie
       w lekkiej pamięci przeglądarki, gwarantując zerowy narzut na bazę serwera.

4. W PEŁNI INTERAKTYWNY WYKRES ŚWIECOWY RECHARTS OHLC W ETAPIE 2 (KONSENSUS):
   - W module TabConsensus zintegrowano profesjonalny wykres świecowy oparty na
     bibliotece Recharts (ComposedChart ze spersonalizowanymi kształtami świec i wolumenu).
   - Wykres prezentuje:
     * Świece OHLC (Otwarcie, Najwyższy, Najniższy, Zamknięcie) w barwach hossy i bessy,
     * Podwykres wolumenu sesyjnego,
     * Średnie kroczące SMA 20 (neon yellow) oraz SMA 50 (cyan) z możliwością włączania,
     * Przełącznik horyzontu czasowego: 14D, 30D, 60D, 90D,
     * Bogaty tooltip ze szczegółami każdej sesji giełdowej GPW.

5. DANE KONTAKTOWE W OKNIE INFORMACYJNYM:
   - Dodano oficjalne dane kontaktowe: Kontakt: slavosmm@gmail.com

================================================================================
Wersja 1.4 (2026-11-04) - Harmonogram Sesji GPW (Dni Wolne & Godziny) & Spójna Stylistyka Ikony Ustawień
================================================================================
1. ZMIANA KOLORYSTYKI IKONY ZĘBATKI (USTAWIENIA):
   - Zmieniono kolor ikony zębatki (Settings) z czerwonego na elegancki,
     spójny błękitny odcień (sky-400) identyczny jak ikona informacji 'i'.
   - Oba przyciski posiadają teraz identyczną stylistykę (ciemne tło slate-800,
     jasnoszarą ramkę slate-700 i dopasowane ikony funkcyjne).

2. INTELIGENTNY MECHANIZM DETEKCJI SESJI GIEŁDOWEJ GPW WARSZAWA:
   - Wdrożono dedykowany moduł 'MarketSessionService' precyzyjnie analizujący czas
     rynku warszawskiego ('Europe/Warsaw'):
     a) Godziny notowań ciągłych: 09:00 - 17:00 (poniedziałek - piątek).
     b) Faza przed otwarciem (fixing): 08:30 - 09:00.
     c) Faza zamknięcia i dogrywki: 17:00 - 17:10.
     d) Stan po sesji: 17:10 - 23:59 oraz przed sesją 00:00 - 08:30.
   - Pełna obsługa dni wolnych i świąt w Polsce:
     * Dni weekendowe (sobota / niedziela).
     * Święta stałe (Nowy Rok, Trzech Króli, Święto Pracy, Konstytucji 3 Maja,
       Wniebowzięcie NMP, Wszystkich Świętych, Święto Niepodległości, Wigilia,
       Boże Narodzenie, Sylwester).
     * Święta ruchome wyliczane algorytmem Computus (Wielki Piątek - brak sesji,
       Poniedziałek Wielkanocny, Boże Ciało).

3. KONTROLA AUTOMATYCZNEGO ODŚWIEŻANIA NOTOWAŃ:
   - Automatyczne odświeżanie notowań Stooq i kursów spółek działa WYŁĄCZNIE
     w trakcie trwania aktywnej sesji GPW (09:00 - 17:00 w dni robocze).
   - Gdy giełda jest zamknięta (po godzinach, w weekend lub święto), automatyczne
     odświeżanie zostaje natychmiast WSTRZYMANE (licznik nie odlicza, notowania
     są stabilnie zamrożone).
   - W górnej belce wyświetlany jest czytelny status sesji z kolorową diodą:
     * Zielona pulsująca dioda: "Sesja GPW: Otwarta" + licznik auto-odświeżania.
     * Bursztynowa dioda: "GPW: Zamknięta / Weekend / Święto" + informacja o dacie
       i godzinie kolejnej sesji oraz etykieta "Auto: Wstrzymane".
   - Ręczne odświeżanie przyciskiem "Stooq (Ręczne)" pozostaje aktywne przez cały czas,
     umożliwiając pobranie ostatnich kursów na żądanie.

4. OPCJONALNY TRYB TESTOWY W USTAWIENIACH:
   - W oknie Ustawień w sekcji odświeżania dodano przełącznik "Wymuś aktywną sesję GPW (tryb testowy)",
     pozwalający na przetestowanie automatycznego przeliczania również poza godzinami sesji.

================================================================================
Wersja 1.3 (2026-11-04) - Suwaki Tła (Jasność & Blur), Ocena Trendu, Rekomendacje, Formacje Świecowe & Duże Logo
================================================================================
1. OBNIŻENIE OKNA MODALNEGO OPTYMIZMU RYNKU:
   - Skorygowano pozycję okna modalnego wykresu trendu 'Optymizm Rynku GPW',
     obniżając je z samej góry ekranu (dodano margines pt-16 / pt-20, wyśrodkowanie pionowe
     oraz obsługę przewijania overflow-y-auto).
   - Przycisk zamknięcia 'X' oraz stopka są teraz w 100% dostępne i klikalne na każdym ekranie.

2. SUWAKI DO ZDJĘCIA W TLE: PRZEZROCZYSTOŚĆ / JASNOŚĆ ORAZ ROZMYCIE (BLUR):
   - W sekcji ustawień tła dodano dwa precyzyjne suwaki:
     a) Widoczność / Jasność Tła (od 20% do 100%) - eliminuje efekt zbyt ciemnego tła,
        pozwalając użytkownikowi ustawić idealny poziom widoczności zdjęcia.
     b) Efekt Rozmycia (Blur od 0px do 20px) - pozwala zachować ostrość zdjęcia (0px)
        lub nadać nowoczesny fintechowy efekt glassmorphism (5-15px).

3. OCENA TRENDU, REKOMENDACJE BIUR MAKLERSKICH I FORMACJE ŚWIEC JAPOŃSKICH:
   - W tabeli Rankingu Spółek oraz w Etapie 2 Konsensusu dodano 3 kluczowe parametry:
     a) Ocena Trendu GPW: siła i kierunek (Bardzo silny wzrostowy, Wzrostowy, Boczny,
        Spadkowy, Silny spadkowy) wraz z punktacją 0-100 pkt wyliczaną ze średnich SMA50,
        SMA200, wskaźnika RSI14 i MACD.
     b) Rekomendacja Biur Maklerskich (KUPUJ / AKUMULUJ / TRZYMAJ / REDUKUJ / SPRZEDAJ)
        wraz z konsensusem ceny docelowej w PLN.
     c) Analiza i Ocena Formacji Świecowych: wykrywanie i klasyfikacja formacji świecowych
        (Młot, Odwrócony Młot, Objęcie Hossy, Spadająca Gwiazda, Wisielec, Objęcie Bessy,
        Trzy Białe Żołnierze, Doji Ważka, Doji Nagrobek) z podziałem na sygnały Bycze i Niedźwiedzie.
   - Dodano pełne sortowanie tabeli po Ocenie Trendu, Rekomendacjach oraz Formacjach Świecowych.

4. DUŻE, WYRAŹNE LOGO GIEŁDOWE (BYK & NIEDŹWIEDŹ):
   - Przeprojektowano i powiększone logo w belce górnej. Zwierzęta Byk (hossa/zielony)
     i Niedźwiedź (bessa/czerwony) są znacznie większe, mają wyraziste rogi, paszcze,
     kły oraz złoty piorun rynkowy z efektem świecenia (glow).

================================================================================
Wersja 1.2 (2026-11-04) - Motywy Kafelków, Tło z Dysku, Optymizm Rynku & Logo Byk/Niedźwiedź
================================================================================
1. PEŁNE KOLOROWANIE KAFELEK I PANELI W MOTYWACH:
   - Naprawiono zmianę kolorów kafelków we wszystkich motywach (Forrest: głęboka
     leśna szmaragdowa zieleń; Ocean: granat morski; Jasny: czysta biel z ciemnym
     tekstem i subtelnymi cieniami).
   - Wszystkie obramowania, tła paneli i wewnętrzne sekcje natychmiast adaptują się
     do wybranego motywu bez pozostawiania ciemnoszarych kafelków.

2. WGOTOWANIE I STABILIZACJA WŁASNEGO TŁA Z DYSKU (CANVAS AUTO-RESIZE):
   - Wdrożono mechanizm automatycznej kompresji i skalowania obrazów wczytywanych
     z dysku za pomocą Canvas (do maks. 1920x1080), co zapobiega błędom
     QuotaExceededError w przeglądarce i natychmiast aplikuje tło.
   - Po kliknięciu 'Zapisz Wszystkie Ustawienia' okno ustawień zamyka się automatycznie.

3. DEDYKOWANY PRZYCISK TESTU TELEGRAM W USTAWIENIACH:
   - W sekcji bota Telegram dodano wyraźny przycisk 'Testuj Bot' z bezpośrednią
     informacją zwrotną o statusie doręczenia wiadomości.

4. PONOWNE PRZELICZANIE ŹRÓDEŁ W ETAPIE 1:
   - W zakładce 'Etap 1: Audyt Trafności' dodano przycisk 'Przelicz Wszystkie Źródła Ponownie'
     wyliczający na nowo wskaźniki skuteczności i generujący powiadomienie toast.

5. WARTOŚĆ PROCENTOWA ZMIANY PRZY NOTOWANIACH:
   - Wzbogacono wszystkie kafelki walorów, selektor szybkiego wyboru i listy
     rozwijane o precyzyjną procentową zmianę dzienną (np. '+1.85%' / '-0.70%').

6. 'OPTYMIZM RYNKU' (%) I INTERAKTYWNY WYKRES TRENDU:
   - Parametr 'Sentyment' został przekształcony w 'Optymizm rynku' podawany
     w ujęciu procentowym (0-100%) z dokładnym objaśnieniem w tooltipie.
   - Po kliknięciu otwiera się okno z 14-dniowym wykresem trendu, korelacją
     z indeksem strachu WIG-VIX oraz poziomami wyprzedania/euforii.

7. NOWE LOGO GIEŁDOWE: BYK & NIEDŹWIEDŹ (BULL & BEAR):
   - Wprowadzono nowe, prestiżowe wektorowe logo prezentujące Byka (hossa)
     i Niedźwiedzia (bessa) z rozdzielającym je złotym piorunem giełdowym
     oraz napisem StockSignalPl.

================================================================================
Wersja 1.1 (2026-11-04) - Aktualizacja Funkcjonalna & Personalizacja UI
================================================================================
1. ZARZĄDZANIE PORTFELAMI (DODAWANIE I USUWANIE):
   - Dodano przycisk '+' w selektorze portfeli umożliwiający tworzenie nowych
     portfeli z indywidualnym profilem ryzyka i kapitałem początkowym w PLN.
   - W każdym portfelu dodano dedykowany przełącznik Auto-Pilot (ON/OFF)
     oraz powiadomień Telegram (ON/OFF).
   - Dodano możliwość bezpiecznego usuwania portfela (z zabezpieczeniem min. 1).

2. NOWE MOTYWY GRAFICZNE & WŁASNE TŁO:
   - Dodano 4 kompleksowe motywy: Ciemny (Dark), Jasny (Light GPW), Ocean (Niebieski/Morski)
     oraz Forrest (Leśny/Szmaragdowy) z pełnym dopasowaniem kolorów kart, tekstu i tabel.
   - Wprowadzono opcję ładowania własnego tła z adresu URL (link) lub z pliku lokalnego
     (PNG, JPG, WEBP) wraz z przyciskiem 'Zastosuj Tło' i 'Wyczyść Tło'.

3. ANALIZA NOWYCH WALORÓW GPW:
   - Dodano moduł '+ Dodaj Nowy Walor GPW / Stooq' w rankingu i konsensusie.
   - Możliwość natychmiastowego dodawania dowolnych spółek z WIG20, mWIG40, sWIG80,
     NewConnect oraz instrumentów pochodnych z automatycznym wyliczaniem wskaźników.

4. TABELE: ZAMROŻONA PIERWSZA KOLUMNA I SORTOWANIE:
   - We wszystkich tabelach pierwsza kolumna jest nieruchoma (sticky/pinned)
     podczas poziomego przewijania na mniejszych ekranach.
   - Wdrożono dwukierunkowe sortowanie (rosnąco/malejąco) po kliknięciu w nagłówki.

5. PRZEWIJANIE POZIOME Z PRZYCISKAMI < I >:
   - Na wszystkich listach kafelków (selektor portfeli, szybkie tickery, pasek górny)
     dodano przyciski nawigacyjne '<' i '>' dla wygodnego przewijania.

6. LICZNIK I USTAWIENIE CZASU ODŚWIEŻANIA NOTOWAŃ:
   - Obok przycisku Stooq dodano dynamiczny licznik odliczający sekundy do kolejnego
     odświeżenia notowań (np. 'Odświeżenie za: 3s').
   - Dodano konfigurację interwału odświeżania (2s, 3s, 5s, 10s, 30s, 60s).

7. TOOLTIPY I INFORMACJE O SYSTEMIE:
   - Dodano szczegółowe tooltipy objaśniające działanie każdego wskaźnika i funkcji.
   - Na belce górnej dodano ikonę 'i' (Informacje i Changelog) oraz zębatkę (Ustawienia).

================================================================================
Wersja 1.0 (2026-11-04) - Oficjalne Wydanie StockSignalPl
================================================================================
- Pierwsza wersja dedykowana dla Giełdy Papierów Wartościowych w Warszawie (GPW).
- Waluta bazowa PLN (zł), Benchmark Indeks WIG20, WIG-VIX Fear & Greed.
- 10 źródeł sygnałowych, konsensus live, Auto-Pilot (>=76%), Multi-TP 33/33/34.
- Portfele 5-in-1, Dziennik Tradera z eksportem CSV, Kalkulator Pozycji w PLN.
================================================================================`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="StockSignalPL"
              className="w-10 h-12 object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.35)] shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight select-none">
                  <span className="text-emerald-400">Stock</span>
                  <span className="text-yellow-400">Signal</span>
                  <span className="text-emerald-400">PL</span>
                </h3>
                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 rounded-full shadow-sm">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Polski Rynek Giełdowy GPW Warszawa & Rynek Surowców</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'info'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>O Aplikacji & Funkcje</span>
          </button>
          <button
            onClick={() => setActiveTab('changelog')}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'changelog'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Changelog (Historia Zmian)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed flex-1">
          {activeTab === 'info' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Platforma Inwestycyjna GPW Warszawa & Surowce (100% Dane Rzeczywiste)</span>
                </h4>
                <p className="text-slate-300">
                  <b>StockSignalPL v2.0</b> to profesjonalny system wspomagania decyzji inwestycyjnych dla polskiego rynku akcji, kontraktów terminowych oraz <b>rynku surowców</b> (Złoto, Ropa Brent, Ropa WTI, Platyna, Srebro, Miedź, Gaz Ziemny, Pszenica). Wszystkie notowania, świece OHLC oraz wyceny portfeli bazują w 100% na autentycznych danych z warszawskiej giełdy (GPW), tabeli kursów NBP oraz światowych giełd surowcowych COMEX/NYMEX (całkowicie wyeliminowano sztuczne losowe ticki). Posiada zintegrowaną bazę danych <b>PostgreSQL 16</b> z obsługą konteneryzacji <b>Docker & Docker Compose</b> dla serwera Ubuntu.
                </p>
              </div>

              {/* Contact Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Kontakt & Wsparcie</span>
                    <a href="mailto:slavosmm@gmail.com" className="text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors">
                      slavosmm@gmail.com
                    </a>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono text-[11px] font-semibold text-center sm:text-right">
                  Kontakt: slavosmm@gmail.com
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <h5 className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Portfele Strategii (6-in-1 w tym Surowce + Własne)</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Twórz własne portfele za pomocą znaku '+', monitoruj pozycje z 3-stopniową realizacją Multi-TP (33/33/34) i automatycznym przesuwaniem SL na Break-Even.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <h5 className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Pilot (&gt;= 76%) & Alerty</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Niezależne włączanie Auto-Pilota i powiadomień Telegram dla każdego portfela z osobna. Natychmiastowa realizacja zleceń po osiągnięciu progu zgodności.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <h5 className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Kalkulator Ryzyka w PLN</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Zaawansowane wyliczanie wielkości pozycji (ilość akcji, wartość w zł, maks. strata na SL) z użyciem stałego ryzyka lub Modelu Kelly'ego.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <h5 className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Wykres Świecowy Recharts OHLC</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Wizualizacja świec japońskich OHLC pobieranych w locie przez proxy Stooq (0 MB bazy danych na serwerze) wraz ze średnimi SMA20 i SMA50.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
                <span>Waluta Bazowa: <b>PLN (zł)</b> • Benchmark: <b>Indeks WIG20</b></span>
                <span className="font-mono text-emerald-400 font-semibold">Kontakt: slavosmm@gmail.com</span>
              </div>
            </div>
          ) : (
            <div>
              <pre className="font-mono text-[11px] text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 whitespace-pre-wrap select-text max-h-[50vh] overflow-y-auto">
                {changelogContent}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>© 2026 StockSignalPL</span>
            <span>•</span>
            <span className="text-yellow-400 font-medium">slavosmm@gmail.com</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-950/30 cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
