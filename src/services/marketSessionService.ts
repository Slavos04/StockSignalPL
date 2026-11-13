/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MarketSessionState =
  | 'OPEN'           // Sesja w toku (09:00 - 17:00 Notowania Ciągłe)
  | 'CLOSING'        // Faza zamknięcia / dogrywka (17:00 - 17:10)
  | 'PRE_MARKET'     // Faza przed otwarciem (08:30 - 09:00, przyjmowanie zleceń)
  | 'CLOSED_BEFORE'  // Przed sesją (00:00 - 08:30)
  | 'CLOSED_AFTER'   // Po sesji (17:10 - 23:59)
  | 'WEEKEND'        // Sobota / Niedziela
  | 'HOLIDAY';       // Dzień wolny od sesji giełdowej GPW

export interface MarketSessionInfo {
  isOpen: boolean;             // True tylko gdy trwają notowania ciągłe (09:00 - 17:00)
  state: MarketSessionState;
  statusLabel: string;         // Krótki nagłówek, np. "Sesja GPW: Otwarta"
  details: string;             // Szczegółowy opis, np. "Notowania ciągłe akcji (do 17:00)"
  warsawTimeStr: string;       // Czas warszawski (HH:MM:SS)
  warsawDateStr: string;       // Data warszawska (DD.MM.YYYY)
  nextSessionText: string;     // Kiedy kolejna sesja
  holidayName?: string;
  isHoliday: boolean;
  isWeekend: boolean;
  timeRemainingStr?: string;   // Czas pozostały do zamknięcia lub otwarcia
}

/**
 * Algorytm wyznaczania daty Niedzieli Wielkanocnej (Computus Meeusa/Jonesa)
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed (2 = marzec, 3 = kwiecień)
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Sprawdza czy dany dzień roku jest dniem wolnym od sesji giełdowej GPW
 */
export function getPolishHolidayName(year: number, month: number, day: number): string | null {
  // Stałe dni wolne od sesji GPW:
  if (month === 0 && day === 1) return 'Nowy Rok';
  if (month === 0 && day === 6) return 'Święto Trzech Króli';
  if (month === 4 && day === 1) return 'Święto Pracy';
  if (month === 4 && day === 3) return 'Święto Konstytucji 3 Maja';
  if (month === 7 && day === 15) return 'Wniebowzięcie NMP / Wojska Polskiego';
  if (month === 10 && day === 1) return 'Wszystkich Świętych';
  if (month === 10 && day === 11) return 'Narodowe Święto Niepodległości';
  if (month === 11 && day === 24) return 'Wigilia Bożego Narodzenia (brak sesji GPW)';
  if (month === 11 && day === 25) return 'Boże Narodzenie (I dzień)';
  if (month === 11 && day === 26) return 'Boże Narodzenie (II dzień)';
  if (month === 11 && day === 31) return 'Sylwester (brak sesji GPW)';

  // Święta ruchome wielkanocne:
  const easter = getEasterSunday(year);
  const easterDate = new Date(Date.UTC(year, easter.month, easter.day));

  // Wielki Piątek (2 dni przed Wielkanocą - GPW nie handluje)
  const goodFriday = new Date(easterDate);
  goodFriday.setUTCDate(easterDate.getUTCDate() - 2);
  if (month === goodFriday.getUTCMonth() && day === goodFriday.getUTCDate()) {
    return 'Wielki Piątek (brak sesji GPW)';
  }

  // Poniedziałek Wielkanocny (1 dzień po Wielkanocy)
  const easterMonday = new Date(easterDate);
  easterMonday.setUTCDate(easterDate.getUTCDate() + 1);
  if (month === easterMonday.getUTCMonth() && day === easterMonday.getUTCDate()) {
    return 'Poniedziałek Wielkanocny';
  }

  // Boże Ciało (czwartek, 60 dni po Wielkanocy)
  const corpusChristi = new Date(easterDate);
  corpusChristi.setUTCDate(easterDate.getUTCDate() + 60);
  if (month === corpusChristi.getUTCMonth() && day === corpusChristi.getUTCDate()) {
    return 'Boże Ciało';
  }

  return null;
}

/**
 * Zwraca datę i czas w strefie czasowej 'Europe/Warsaw'
 */
export function getWarsawDate(date: Date = new Date()): Date {
  const str = date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' });
  return new Date(str);
}

export class MarketSessionService {
  /**
   * Sprawdza aktualny stan sesji giełdowej na Giełdzie Papierów Wartościowych w Warszawie
   */
  public static getGpwStatus(refDate: Date = new Date()): MarketSessionInfo {
    const warsaw = getWarsawDate(refDate);

    const year = warsaw.getFullYear();
    const month = warsaw.getMonth();
    const day = warsaw.getDate();
    const dayOfWeek = warsaw.getDay(); // 0 = Niedziela, 6 = Sobota

    const hours = warsaw.getHours();
    const minutes = warsaw.getMinutes();
    const seconds = warsaw.getSeconds();
    const totalMinutes = hours * 60 + minutes;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const warsawTimeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    const warsawDateStr = `${pad(day)}.${pad(month + 1)}.${year}`;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holidayName = getPolishHolidayName(year, month, day);
    const isHoliday = Boolean(holidayName);

    // Dzień wolny: Weekend
    if (isWeekend) {
      const daysUntilMonday = dayOfWeek === 6 ? 2 : 1;
      return {
        isOpen: false,
        state: 'WEEKEND',
        statusLabel: 'GPW: Zamknięta (Weekend)',
        details: 'Giełda Papierów Wartościowych w Warszawie nie pracuje w weekendy.',
        warsawTimeStr,
        warsawDateStr,
        nextSessionText: daysUntilMonday === 1 ? 'Najbliższa sesja: Jutro (Poniedziałek) o 09:00' : 'Najbliższa sesja: Poniedziałek o 09:00',
        isHoliday: false,
        isWeekend: true
      };
    }

    // Dzień wolny: Święto
    if (isHoliday) {
      return {
        isOpen: false,
        state: 'HOLIDAY',
        statusLabel: `GPW: Zamknięta (${holidayName})`,
        details: `Dzień ustawowo wolny od sesji giełdowej: ${holidayName}.`,
        warsawTimeStr,
        warsawDateStr,
        nextSessionText: 'Najbliższa sesja: w kolejny dzień roboczy o 09:00',
        holidayName: holidayName || undefined,
        isHoliday: true,
        isWeekend: false
      };
    }

    // Dzień powszedni sesyjny (Poniedziałek - Piątek):
    // Harmonogram GPW:
    // 00:00 - 08:30: Przed sesją
    // 08:30 - 09:00: Faza przed otwarciem (fixing o 09:00)
    // 09:00 - 17:00: Notowania ciągłe (Sesja aktywna, auto-odświeżanie działa)
    // 17:00 - 17:05: Faza przed zamknięciem
    // 17:05 - 17:10: Dogrywka
    // 17:10 - 23:59: Po sesji

    // 09:00 = 540 min, 17:00 = 1020 min
    const OPEN_MINUTES = 9 * 60; // 540
    const CLOSE_MINUTES = 17 * 60; // 1020
    const PRE_MARKET_MINUTES = 8 * 60 + 30; // 510
    const AFTER_MARKET_END = 17 * 60 + 10; // 1030

    if (totalMinutes < PRE_MARKET_MINUTES) {
      const minutesToOpen = OPEN_MINUTES - totalMinutes;
      const h = Math.floor(minutesToOpen / 60);
      const m = minutesToOpen % 60;
      return {
        isOpen: false,
        state: 'CLOSED_BEFORE',
        statusLabel: 'GPW: Przed sesją (Zamknięta)',
        details: `Otwarcie notowań ciągłych dzisiaj o 09:00 (za ${h}g ${m}m).`,
        warsawTimeStr,
        warsawDateStr,
        nextSessionText: 'Otwarcie dzisiaj o 09:00',
        timeRemainingStr: `${h}g ${m}m do otwarcia`,
        isHoliday: false,
        isWeekend: false
      };
    }

    if (totalMinutes >= PRE_MARKET_MINUTES && totalMinutes < OPEN_MINUTES) {
      const minutesToOpen = OPEN_MINUTES - totalMinutes;
      return {
        isOpen: false,
        state: 'PRE_MARKET',
        statusLabel: 'GPW: Faza przed otwarciem',
        details: `Przyjmowanie zleceń do fixingu. Otwarcie notowań za ${minutesToOpen} min.`,
        warsawTimeStr,
        warsawDateStr,
        nextSessionText: `Otwarcie sesji o 09:00 (za ${minutesToOpen} min)`,
        timeRemainingStr: `${minutesToOpen} min do otwarcia`,
        isHoliday: false,
        isWeekend: false
      };
    }

    if (totalMinutes >= OPEN_MINUTES && totalMinutes < CLOSE_MINUTES) {
      const minutesToClose = CLOSE_MINUTES - totalMinutes;
      const h = Math.floor(minutesToClose / 60);
      const m = minutesToClose % 60;
      return {
        isOpen: true,
        state: 'OPEN',
        statusLabel: 'GPW: Sesja Otwarta',
        details: `Notowania ciągłe w toku (do zamknięcia pozostało ${h}g ${m}m).`,
        warsawTimeStr,
        warsawDateStr,
        nextSessionText: `Sesja trwa do 17:00 (zamknięcie za ${h}g ${m}m)`,
        timeRemainingStr: `${h}g ${m}m do 17:00`,
        isHoliday: false,
        isWeekend: false
      };
    }

    if (totalMinutes >= CLOSE_MINUTES && totalMinutes <= AFTER_MARKET_END) {
      return {
        isOpen: false,
        state: 'CLOSING',
        statusLabel: 'GPW: Fixing i Dogrywka',
        details: 'Faza zamknięcia i dogrywki (17:00 - 17:10). Notowania ciągłe zakończone.',
        warsawTimeStr,
        warsawDateStr,
        nextSessionText: dayOfWeek === 5 ? 'Najbliższa sesja: Poniedziałek o 09:00' : 'Najbliższa sesja: Jutro o 09:00',
        isHoliday: false,
        isWeekend: false
      };
    }

    // totalMinutes > AFTER_MARKET_END (po 17:10)
    const nextDayText = dayOfWeek === 5
      ? 'Najbliższa sesja w Poniedziałek o 09:00'
      : 'Najbliższa sesja Jutro o 09:00';

    return {
      isOpen: false,
      state: 'CLOSED_AFTER',
      statusLabel: 'GPW: Po sesji (Zamknięta)',
      details: `Dzisiejsza sesja GPW została zakończona o 17:00. ${nextDayText}.`,
      warsawTimeStr,
      warsawDateStr,
      nextSessionText: nextDayText,
      isHoliday: false,
      isWeekend: false
    };
  }

  /**
   * Sprawdza czy rynek dla danego waloru (GPW lub Surowce) jest obecnie otwarty do zawierania transakcji.
   */
  public static isMarketOpenForStock(
    stockOrSymbol: { market?: string; category?: string; symbol?: string; cleanSymbol?: string } | string,
    refDate: Date = new Date(),
    forceSessionOpenTest: boolean = false
  ): { isOpen: boolean; marketName: string; reason: string } {
    if (forceSessionOpenTest) {
      return {
        isOpen: true,
        marketName: 'Tryb Testowy',
        reason: 'Wymuszono tryb otwartej sesji dla celów testowych w ustawieniach aplikacji.'
      };
    }

    let isCommodity = false;
    let symbolClean = '';

    if (typeof stockOrSymbol === 'string') {
      symbolClean = stockOrSymbol.toUpperCase();
    } else if (stockOrSymbol) {
      const m = (stockOrSymbol.market || '').toUpperCase();
      const c = (stockOrSymbol.category || '').toUpperCase();
      const s = (stockOrSymbol.cleanSymbol || stockOrSymbol.symbol || '').toUpperCase();
      symbolClean = s;
      if (m === 'SUROWCE' || c === 'SUROWCE') {
        isCommodity = true;
      }
    }

    const cleanBase = symbolClean.replace('.PL', '').replace('.F', '').replace('.WA', '').trim();
    const exactCommodityBases = new Set(['XAU', 'XAG', 'XPT', 'CB', 'BRENT', 'CL', 'WTI', 'NG', 'NATGAS', 'HG', 'COPPER', 'ZW', 'W', 'WHEAT', 'CORN', 'GOLD', 'SILVER', 'OIL', 'PLATINUM']);
    const commodityPrefixes = ['XAU', 'XAG', 'XPT', 'BRENT', 'WTI', 'COPPER', 'NATGAS', 'WHEAT', 'CORN', 'CB.', 'CL.', 'NG.', 'HG.', 'ZW.'];
    if (
      exactCommodityBases.has(cleanBase) ||
      commodityPrefixes.some(prefix => symbolClean.startsWith(prefix) || symbolClean.includes(prefix))
    ) {
      isCommodity = true;
    }

    const warsaw = getWarsawDate(refDate);
    const dayOfWeek = warsaw.getDay(); // 0 = Niedziela, 6 = Sobota
    const hours = warsaw.getHours();
    const minutes = warsaw.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    if (isCommodity) {
      // Rynek Surowców (Global Futures 24/5):
      // Otwarty od Niedzieli 23:00 CET do Piątku 23:00 CET.
      // Zamknięty: Sobota, Niedziela do 23:00 CET, Piątek po 23:00 CET, Przerwa 23:00-00:00.

      if (dayOfWeek === 6) { // Sobota
        return {
          isOpen: false,
          marketName: 'Surowce Globalne (24/5)',
          reason: 'Rynek surowcowy jest zamknięty w weekend (sobota). Ponowne otwarcie handlu w niedzielę o 23:00.'
        };
      }

      if (dayOfWeek === 0 && totalMinutes < 23 * 60) { // Niedziela do 23:00
        const minsLeft = 23 * 60 - totalMinutes;
        const h = Math.floor(minsLeft / 60);
        const m = minsLeft % 60;
        return {
          isOpen: false,
          marketName: 'Surowce Globalne (24/5)',
          reason: `Rynek surowcowy otworzy się w niedzielę o 23:00 (za ${h}g ${m}m).`
        };
      }

      if (dayOfWeek === 5 && totalMinutes >= 23 * 60) { // Piątek po 23:00
        return {
          isOpen: false,
          marketName: 'Surowce Globalne (24/5)',
          reason: 'Rynek surowcowy został zamknięty w piątek o 23:00. Otwarcie w niedzielę o 23:00.'
        };
      }

      if (totalMinutes >= 23 * 60) { // Przerwa techniczna 23:00 - 00:00
        return {
          isOpen: false,
          marketName: 'Surowce Globalne (24/5)',
          reason: 'Przerwa rozliczeniowo-techniczna giełd surowcowych (23:00 - 00:00).'
        };
      }

      return {
        isOpen: true,
        marketName: 'Surowce Globalne (24/5)',
        reason: 'Rynek surowców jest aktywny. Notowania i transakcje ciągłe 24/5.'
      };
    }

    // Giełda Papierów Wartościowych w Warszawie (GPW)
    const gpwStatus = this.getGpwStatus(refDate);
    if (!gpwStatus.isOpen) {
      return {
        isOpen: false,
        marketName: 'GPW Warszawa',
        reason: `Giełda GPW jest obecnie zamknięta (${gpwStatus.statusLabel}). Notowania ciągłe i transakcje odbywają się w dni robocze od 09:00 do 17:00.`
      };
    }

    return {
      isOpen: true,
      marketName: 'GPW Warszawa',
      reason: 'Sesja GPW otwarta (notowania i transakcje ciągłe).'
    };
  }
}
