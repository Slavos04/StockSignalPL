import http from 'http';
import https from 'https';
import { dbGetAllPortfoliosWithUsers, dbSavePortfolio, dbSaveTrade, dbGetSettings } from './db';
import { MarketSessionService } from '../services/marketSessionService';

interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  trendScore?: number;
  rsi14?: number;
  macdHist?: number;
  analystRecommendation?: string;
  market?: 'GPW' | 'Surowce' | 'NewConnect' | 'FW20';
  isCommodity?: boolean;
}

const DEFAULT_WATCHLIST = [
  'PKN', 'KGH', 'PKO', 'PZU', 'CDR', 'DNP', 'LPP', 'ALE', 'PEO', 'KRU',
  'XTB', 'TPE', 'PGE', 'CPS', 'BDX', 'CAR', '11B', 'ACP', 'MIL', 'ENA',
  'OPL', 'JSW', 'KTY', 'SAN', 'CCC', 'MLS', 'CLD', 'XAU', 'XAG', 'CB',
  'CL', 'NG', 'FW20', 'XPT', 'ZW'
];

export class ServerAutoPilotDaemon {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;
  private static lastRunTimestamp: number = 0;
  private static currentIntervalMs: number = 15000;
  private static cachedQuotes: Map<string, MarketQuote> = new Map();
  public static forceSessionOpenTest: boolean = false;
  public static cyclesCount: number = 0;
  public static lastExecutionSummary: string = 'Silnik serwerowy gotowy';

  /**
   * Startuje autonomiczny proces egzekucyjny bota w tle na serwerze Node.js.
   * Działa 24/7 niezależnie od tego, czy ktokolwiek jest zalogowany i czy okno przeglądarki jest włączone.
   */
  public static start(intervalMs: number = 15000): void {
    if (this.isRunning) return;
    this.currentIntervalMs = intervalMs;
    this.isRunning = true;
    console.log(`[AutoPilot Daemon] 🤖 Inicjalizacja Autonomicznego Silnika Bota 24/7 (interwał: ${intervalMs / 1000}s)...`);

    // Pierwszy cykl po 3 sekundach od startu serwera
    setTimeout(() => {
      this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Błąd pierwszego cyklu:', err));
    }, 3000);

    // Główna pętla w tle serwera
    this.intervalHandle = setInterval(() => {
      this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Błąd cyklu:', err));
    }, this.currentIntervalMs);
  }

  public static setIntervalMs(newIntervalMs: number): void {
    this.currentIntervalMs = Math.max(1000, newIntervalMs);
    console.log(`[AutoPilot Daemon] ⏱️ Zmieniono częstotliwość pracy silnika serwera na: ${this.currentIntervalMs / 1000}s`);
    if (this.isRunning) {
      if (this.intervalHandle) {
        clearInterval(this.intervalHandle);
      }
      this.intervalHandle = setInterval(() => {
        this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Błąd cyklu:', err));
      }, this.currentIntervalMs);
    }
  }

  public static setForceSessionOpenTest(val: boolean): void {
    this.forceSessionOpenTest = val;
    console.log(`[AutoPilot Daemon] 🔄 Tryb testowy otwartej sesji (forceSessionOpenTest) ustawiony na: ${val}`);
  }

  public static getIntervalMs(): number {
    return this.currentIntervalMs;
  }

  public static async getStatus(): Promise<{
    isRunning: boolean;
    intervalMs: number;
    lastRunTimestamp: number;
    cyclesCount: number;
    lastExecutionSummary: string;
    forceSessionOpenTest: boolean;
    monitoredPortfoliosCount: number;
  }> {
    const portfolios = await dbGetAllPortfoliosWithUsers();
    return {
      isRunning: this.isRunning,
      intervalMs: this.currentIntervalMs,
      lastRunTimestamp: this.lastRunTimestamp,
      cyclesCount: this.cyclesCount,
      lastExecutionSummary: this.lastExecutionSummary,
      forceSessionOpenTest: this.forceSessionOpenTest,
      monitoredPortfoliosCount: portfolios.length
    };
  }

  public static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    console.log('[AutoPilot Daemon] Silnik bota w tle został zatrzymany.');
  }

  /**
   * Główny cykl egzekucyjny Auto-Pilota:
   * 1. Odpytuje bazę danych o wszystkie portfele użytkowników z włączonym Auto-Pilotem
   * 2. Zgłasza zapotrzebowanie na notowania (w tym wszystkie aktywne pozycje)
   * 3. Pobiera świeże kursy rynkowe GPW i Surowców z wewnętrznego endpointu HTTP
   * 4. Weryfikuje warunki Stop Loss i Take Profit (TP1/TP2/TP3)
   * 5. Wyszukuje silne okazje i automatycznie zawiera nowe transakcje
   * 6. Zapisuje zaktualizowane salda i pozycje bezpośrednio w PostgreSQL / buforze serwera
   * 7. Wysyła alerty Telegram z dokładną datą i godziną egzekucji transakcji
   */
  public static async executeCycle(): Promise<void> {
    try {
      this.lastRunTimestamp = Date.now();
      this.cyclesCount++;

      const userPortfolios = await dbGetAllPortfoliosWithUsers();
      if (!userPortfolios || userPortfolios.length === 0) {
        this.lastExecutionSummary = 'Brak aktywnych portfeli z włączonym Auto-Pilotem';
        return;
      }

      // Zbierz tickery ze wszystkich otwartych pozycji portfeli
      const dynamicSymbols = new Set<string>();
      userPortfolios.forEach(item => {
        (item.portfolio.activePositions || []).forEach((pos: any) => {
          if (pos.ticker) dynamicSymbols.add(pos.ticker);
        });
      });

      const quotes = await this.fetchLiveQuotes(Array.from(dynamicSymbols));
      if (!quotes || quotes.length === 0) {
        this.lastExecutionSummary = 'Oczekiwanie na feed notowań rynkowych';
        return;
      }

      let totalOrdersExecuted = 0;
      const now = new Date();
      const norm = (s: string) => (s || '').toUpperCase().replace('.PL', '').replace('.WA', '').replace('.F', '').trim();

      for (const item of userPortfolios) {
        const { userId, portfolio } = item;
        if (!portfolio || !portfolio.autoPilotEnabled) continue;

        let portfolioChanged = false;
        const remainingPositions: any[] = [];
        const positions = portfolio.activePositions || [];

        // ---------------------------------------------------------------------
        // KROK 1: Weryfikacja zleceń TP / SL dla otwartych pozycji
        // ---------------------------------------------------------------------
        for (const pos of positions) {
          const quote = quotes.find(q => norm(q.symbol) === norm(pos.ticker));

          if (!quote) {
            remainingPositions.push(pos);
            continue;
          }

          // Zawsze aktualizuj bieżącą cenę rynkową i zysk/stratę z bieżącego ticka
          pos.currentPrice = quote.price;
          const isShort = pos.positionSide === 'SHORT';

          pos.pnlPln = isShort
            ? Number(((pos.entryPrice - pos.currentPrice) * pos.shares).toFixed(2))
            : Number(((pos.currentPrice - pos.entryPrice) * pos.shares).toFixed(2));

          pos.pnlPercent = isShort
            ? Number((((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100).toFixed(2))
            : Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

          // Weryfikacja czy rynek jest aktualnie otwarty dla tego waloru (lub czy trwa test wymuszonej sesji)
          const marketCheck = MarketSessionService.isMarketOpenForStock(pos.ticker, now, this.forceSessionOpenTest);
          if (!marketCheck.isOpen) {
            remainingPositions.push(pos);
            continue;
          }

          const executionTimeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const executionDateStr = now.toLocaleDateString('pl-PL');
          const dateStr = `${executionDateStr}, ${executionTimeStr}`;

          // 1. Osiągnięcie TP1 (33% wolumenu) -> realizacja 33% i przesunięcie SL na Break-Even
          const hitTp1 = isShort
            ? (!pos.tp1Reached && pos.currentPrice <= pos.targetPrice1)
            : (!pos.tp1Reached && pos.currentPrice >= pos.targetPrice1);

          if (hitTp1) {
            pos.tp1Reached = true;
            pos.status = 'ZREALIZOWANO TP1';
            pos.stopLoss = isShort
              ? Math.min(pos.stopLoss, pos.entryPrice)
              : Math.max(pos.stopLoss, pos.entryPrice); // Break-Even

            const soldShares = Math.max(1, Math.floor(pos.shares * 0.33));
            const returnCash = Number((soldShares * pos.currentPrice).toFixed(2));
            const pnlPart = isShort
              ? Number(((pos.entryPrice - pos.currentPrice) * soldShares).toFixed(2))
              : Number(((pos.currentPrice - pos.entryPrice) * soldShares).toFixed(2));

            portfolio.cashPln = Number((portfolio.cashPln + returnCash).toFixed(2));
            portfolio.allocatedPln = Math.max(0, Number((portfolio.allocatedPln - (soldShares * pos.entryPrice)).toFixed(2)));
            portfolio.currentBalance = Number((portfolio.cashPln + portfolio.allocatedPln).toFixed(2));
            portfolio.totalProfitPln = Number((portfolio.totalProfitPln + pnlPart).toFixed(2));

            const tradeLog = {
              id: `tr_srv_${Date.now()}_tp1`,
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: isShort ? 'KUPNO' : 'SPRZEDAŻ',
              pricePln: pos.currentPrice,
              shares: soldShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: pos.pnlPercent,
              strategyId: portfolio.id,
              reason: `Serwer 24/7 Auto-Pilot: Osiągnięto poziom TP1. Realizacja 33% pozycji i przesunięcie SL na Break-Even (${pos.entryPrice.toFixed(2)} zł)`,
              status: 'AUTO-PILOT'
            };

            await dbSaveTrade(userId, tradeLog);
            portfolioChanged = true;
            totalOrdersExecuted++;

            console.log(`[AutoPilot Daemon] 🎯 TP1 wykonane w tle: ${pos.ticker} (${soldShares} szt.) w portfelu "${portfolio.name}"`);

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: Realizacja TP1 (33% pozycji)\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏛️ Walor: <b>${pos.ticker}</b>\n` +
              `💼 Portfel: <i>${portfolio.name}</i>\n` +
              `💵 Kurs egzekucji: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `📦 Sprzedano: <b>${soldShares} szt.</b> (Zwrócono: ${returnCash.toLocaleString('pl-PL')} PLN)\n` +
              `📈 Zysk: <b>+${pnlPart.toFixed(2)} PLN (+${pos.pnlPercent.toFixed(2)}%)</b>\n` +
              `🛡️ Stop Loss został automatycznie przestawiony na Break-Even (${pos.entryPrice.toFixed(2)} zł)!\n` +
              `⏰ <b>Godzina transakcji:</b> <code>${executionTimeStr}</code> (${executionDateStr})\n` +
              `📡 <i>Transakcja zrealizowana automatycznie przez serwer (okno przeglądarki wyłączone)</i>`
            );
          }

          // 2. Osiągnięcie TP2 (kolejne 33% wolumenu)
          const hitTp2 = isShort
            ? (pos.tp1Reached && !pos.tp2Reached && pos.currentPrice <= pos.targetPrice2)
            : (pos.tp1Reached && !pos.tp2Reached && pos.currentPrice >= pos.targetPrice2);

          if (hitTp2) {
            pos.tp2Reached = true;
            pos.status = 'ZREALIZOWANO TP2';

            const soldShares = Math.max(1, Math.floor(pos.shares * 0.33));
            const returnCash = Number((soldShares * pos.currentPrice).toFixed(2));
            const pnlPart = isShort
              ? Number(((pos.entryPrice - pos.currentPrice) * soldShares).toFixed(2))
              : Number(((pos.currentPrice - pos.entryPrice) * soldShares).toFixed(2));

            portfolio.cashPln = Number((portfolio.cashPln + returnCash).toFixed(2));
            portfolio.allocatedPln = Math.max(0, Number((portfolio.allocatedPln - (soldShares * pos.entryPrice)).toFixed(2)));
            portfolio.currentBalance = Number((portfolio.cashPln + portfolio.allocatedPln).toFixed(2));
            portfolio.totalProfitPln = Number((portfolio.totalProfitPln + pnlPart).toFixed(2));

            const tradeLog = {
              id: `tr_srv_${Date.now()}_tp2`,
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: isShort ? 'KUPNO' : 'SPRZEDAŻ',
              pricePln: pos.currentPrice,
              shares: soldShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: pos.pnlPercent,
              strategyId: portfolio.id,
              reason: `Serwer 24/7 Auto-Pilot: Osiągnięto poziom TP2. Realizacja kolejnych 33% pozycji z zyskiem.`,
              status: 'AUTO-PILOT'
            };

            await dbSaveTrade(userId, tradeLog);
            portfolioChanged = true;
            totalOrdersExecuted++;

            console.log(`[AutoPilot Daemon] 🎯 TP2 wykonane w tle: ${pos.ticker} w portfelu "${portfolio.name}"`);

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: Realizacja TP2 (33% pozycji)\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏛️ Walor: <b>${pos.ticker}</b>\n` +
              `💼 Portfel: <i>${portfolio.name}</i>\n` +
              `💵 Kurs egzekucji: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `📦 Sprzedano: <b>${soldShares} szt.</b>\n` +
              `📈 Zysk: <b>+${pnlPart.toFixed(2)} PLN (+${pos.pnlPercent.toFixed(2)}%)</b>\n` +
              `⏰ <b>Godzina transakcji:</b> <code>${executionTimeStr}</code> (${executionDateStr})\n` +
              `📡 <i>Transakcja zrealizowana automatycznie przez serwer (okno przeglądarki wyłączone)</i>`
            );
          }

          // 3. Osiągnięcie TP3 lub STOP LOSS -> Pełne zamknięcie pozycji
          const hitTp3 = isShort
            ? (pos.tp2Reached && !pos.tp3Reached && pos.currentPrice <= pos.targetPrice3)
            : (pos.tp2Reached && !pos.tp3Reached && pos.currentPrice >= pos.targetPrice3);

          const hitSl = isShort
            ? (pos.currentPrice >= pos.stopLoss)
            : (pos.currentPrice <= pos.stopLoss);

          if (hitTp3 || hitSl) {
            const remainingShares = pos.shares;
            const returnCash = Number((remainingShares * pos.currentPrice).toFixed(2));
            const pnlPart = isShort
              ? Number(((pos.entryPrice - pos.currentPrice) * remainingShares).toFixed(2))
              : Number(((pos.currentPrice - pos.entryPrice) * remainingShares).toFixed(2));

            portfolio.cashPln = Number((portfolio.cashPln + returnCash).toFixed(2));
            portfolio.allocatedPln = Math.max(0, Number((portfolio.allocatedPln - (remainingShares * pos.entryPrice)).toFixed(2)));
            portfolio.currentBalance = Number((portfolio.cashPln + portfolio.allocatedPln).toFixed(2));
            portfolio.totalProfitPln = Number((portfolio.totalProfitPln + pnlPart).toFixed(2));

            const tradeLog = {
              id: `tr_srv_${Date.now()}_close`,
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: isShort ? 'KUPNO' : 'SPRZEDAŻ',
              pricePln: pos.currentPrice,
              shares: remainingShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: pos.pnlPercent,
              strategyId: portfolio.id,
              reason: hitTp3
                ? `Serwer 24/7 Auto-Pilot: Osiągnięto docelowe TP3 (+11.8%). Całkowita realizacja zysków bez obecności użytkownika.`
                : `Serwer 24/7 Auto-Pilot: Osiągnięto poziom Stop Loss (${pos.stopLoss.toFixed(2)} zł). Automatyczne obcięcie straty.`,
              status: hitTp3 ? 'ZYSK (TP)' : 'STRATA (SL)'
            };

            await dbSaveTrade(userId, tradeLog);
            portfolioChanged = true;
            totalOrdersExecuted++;

            console.log(`[AutoPilot Daemon] ${hitTp3 ? '🏆 TP3' : '🛡️ SL'} wykonane w tle: ${pos.ticker} w portfelu "${portfolio.name}"`);

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: ${hitTp3 ? '🏆 Pełna Realizacja TP3 (+11.8%)' : '🛡️ Aktywacja Stop Loss'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏛️ Walor: <b>${pos.ticker}</b>\n` +
              `💼 Portfel: <i>${portfolio.name}</i>\n` +
              `💵 Kurs zamknięcia: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `📦 Zamknięto: <b>${remainingShares} szt.</b> (Zwrócono: ${returnCash.toLocaleString('pl-PL')} PLN)\n` +
              `📊 Wynik transakcji: <b>${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)</b>\n` +
              `⏰ <b>Godzina transakcji:</b> <code>${executionTimeStr}</code> (${executionDateStr})\n` +
              `📡 <i>Transakcja zrealizowana automatycznie przez serwer (okno przeglądarki wyłączone)</i>`
            );

            // Pozycja została w całości zamknięta – nie dodajemy jej do remainingPositions
            continue;
          }

          remainingPositions.push(pos);
        }

        portfolio.activePositions = remainingPositions;

        // ---------------------------------------------------------------------
        // KROK 2: Wyszukiwanie nowych okazji rynkowych (Kupno Auto-Pilota)
        // ---------------------------------------------------------------------
        const currentDd = portfolio.initialCapital > 0
          ? ((portfolio.currentBalance - portfolio.initialCapital) / portfolio.initialCapital) * 100
          : 0;
        const maxDdCap = portfolio.drawdownLockCap !== undefined ? portfolio.drawdownLockCap : -15;

        if (currentDd > maxDdCap) {
          const maxPos = portfolio.autoPilotMaxPositions || 5;
          const minConf = portfolio.autoPilotMinConfidence || 75;

          if (portfolio.activePositions.length < maxPos) {
            for (const stock of quotes) {
              if (portfolio.activePositions.length >= maxPos) break;

              // Weryfikacja czy rynek waloru jest otwarty (lub czy włączono test)
              const marketCheck = MarketSessionService.isMarketOpenForStock(stock.symbol, now, this.forceSessionOpenTest);
              if (!marketCheck.isOpen) continue;

              // Sprawdź czy portfel dopuszcza ten rynek
              const isAllowed = this.isMarketAllowedForPortfolio(portfolio, stock);
              if (!isAllowed) continue;

              // Sprawdź czy nie posiadamy już otwartej pozycji w tym walorze
              const alreadyHolds = portfolio.activePositions.some(
                (p: any) => norm(p.ticker) === norm(stock.symbol)
              );
              if (alreadyHolds) continue;

              // Warunek mocnego sygnału Auto-Pilota:
              const isOpportunity = (stock.trendScore && stock.trendScore >= minConf) ||
                                    (stock.analystRecommendation?.includes('KUPUJ') && stock.changePercent > 0.3) ||
                                    (stock.changePercent > 0.4);

              if (isOpportunity && stock.price > 0) {
                // Alokacja gotówki
                const allocPct = (portfolio.autoPilotAllocationPercent || 10) / 100;
                const buyBudget = Math.max(1000, portfolio.cashPln * allocPct);
                if (portfolio.cashPln >= buyBudget && buyBudget >= stock.price) {
                  const shares = Math.max(1, Math.floor(buyBudget / stock.price));
                  const totalPln = Number((shares * stock.price).toFixed(2));

                  portfolio.cashPln = Math.max(0, Number((portfolio.cashPln - totalPln).toFixed(2)));
                  portfolio.allocatedPln = Number((portfolio.allocatedPln + totalPln).toFixed(2));
                  portfolio.currentBalance = Number((portfolio.cashPln + portfolio.allocatedPln).toFixed(2));
                  portfolio.tradesCount = (portfolio.tradesCount || 0) + 1;

                  const atrMultiplier = stock.isCommodity ? 0.045 : 0.038;
                  const sl = Number((stock.price * (1 - atrMultiplier)).toFixed(2));
                  const tp1 = Number((stock.price * 1.032).toFixed(2));
                  const tp2 = Number((stock.price * 1.065).toFixed(2));
                  const tp3 = Number((stock.price * 1.118).toFixed(2));

                  const executionTimeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const executionDateStr = now.toLocaleDateString('pl-PL');
                  const dateStr = `${executionDateStr}, ${executionTimeStr}`;

                  const newPosition = {
                    id: `pos_srv_${Date.now()}`,
                    ticker: stock.symbol,
                    name: stock.symbol,
                    shares,
                    entryPrice: stock.price,
                    currentPrice: stock.price,
                    targetPrice1: tp1,
                    targetPrice2: tp2,
                    targetPrice3: tp3,
                    tp1Reached: false,
                    tp2Reached: false,
                    tp3Reached: false,
                    stopLoss: sl,
                    positionSide: 'LONG',
                    status: 'AKTYWNA',
                    pnlPln: 0,
                    pnlPercent: 0,
                    entryDate: now.toISOString().split('T')[0]
                  };

                  portfolio.activePositions.unshift(newPosition);

                  // Dziennik audytowy Auto-Pilota
                  if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
                  portfolio.autoPilotLogs.unshift({
                    id: `log_${Date.now()}`,
                    timestamp: executionTimeStr,
                    ticker: stock.symbol,
                    action: 'KUPNO_LONG',
                    confidence: stock.trendScore || 80,
                    riskRewardRatio: 2.8,
                    reason: `Autonomiczne wejście na serwerze: Konsensus ${stock.trendScore || 80}% >= ${minConf}%`,
                    portfolioId: portfolio.id,
                    portfolioName: portfolio.name
                  });

                  // Zapis do Dziennika Tradera
                  const tradeLog = {
                    id: `tr_srv_${Date.now()}_buy`,
                    date: dateStr,
                    ticker: stock.symbol,
                    name: stock.symbol,
                    type: 'KUPNO',
                    pricePln: stock.price,
                    shares,
                    totalPln,
                    resultPln: 0,
                    resultPercent: 0,
                    strategyId: portfolio.id,
                    reason: `Autonomiczny zakup serwerowy (Konsensus: ${stock.trendScore || 80}%). SL: ${sl} zł, TP3: ${tp3} zł`,
                    status: 'AUTO-PILOT'
                  };

                  await dbSaveTrade(userId, tradeLog);
                  portfolioChanged = true;
                  totalOrdersExecuted++;

                  console.log(`[AutoPilot Daemon] 🛒 Kupiono w tle: ${shares} szt. ${stock.symbol} po ${stock.price} zł w portfelu "${portfolio.name}" (User: ${userId})`);

                  await this.sendTelegramAlertIfEnabled(userId, portfolio,
                    `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: Nowe Zlecenie KUPNA\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `🏛️ Walor: <b>${stock.symbol}</b>\n` +
                    `💼 Portfel: <i>${portfolio.name}</i>\n` +
                    `📦 Pakiet: <b>${shares} szt.</b> po <b>${stock.price.toFixed(2)} zł</b> (${totalPln.toLocaleString('pl-PL')} PLN)\n` +
                    `🛑 Stop Loss: <b>${sl.toFixed(2)} zł</b> | 🎯 Cel TP3: <b>${tp3.toFixed(2)} zł</b>\n` +
                    `⏰ <b>Godzina transakcji:</b> <code>${executionTimeStr}</code> (${executionDateStr})\n` +
                    `📡 <i>Zlecenie wykonane w tle przez serwer (okno przeglądarki wyłączone)</i>`
                  );
                }
              }
            }
          }
        }

        if (portfolioChanged) {
          portfolio.updatedAt = new Date().toISOString();
          await dbSavePortfolio(userId, portfolio);
        }
      }

      this.lastExecutionSummary = totalOrdersExecuted > 0
        ? `Zrealizowano ${totalOrdersExecuted} zleceń w tle o ${now.toLocaleTimeString('pl-PL')}`
        : `Monitorowano ${userPortfolios.length} portfeli o ${now.toLocaleTimeString('pl-PL')} (kursy aktywne)`;

    } catch (err: any) {
      console.error('[AutoPilot Daemon] Błąd pętli egzekucyjnej:', err.message);
      this.lastExecutionSummary = `Błąd pętli: ${err.message}`;
    }
  }

  private static isMarketAllowedForPortfolio(portfolio: any, stock: MarketQuote): boolean {
    const isCommodity = stock.isCommodity || ['XAU', 'XAG', 'CB', 'CL', 'NG', 'COPPER', 'XPT', 'ZW'].some(c => stock.symbol.includes(c));
    const isFw20 = stock.symbol.includes('FW20');

    if (portfolio.allowedMarkets && Array.isArray(portfolio.allowedMarkets)) {
      if (isCommodity && !portfolio.allowedMarkets.includes('Surowce')) return false;
      if (isFw20 && !portfolio.allowedMarkets.includes('FW20')) return false;
      if (!isCommodity && !isFw20 && !portfolio.allowedMarkets.includes('GPW')) return false;
    }
    return true;
  }

  /**
   * Wysyła powiadomienie Telegram jeśli portfel i ustawienia użytkownika mają skonfigurowanego bota
   */
  private static async sendTelegramAlertIfEnabled(userId: string, portfolio: any, message: string): Promise<void> {
    if (!portfolio.telegramEnabled) return;
    try {
      const settings = await dbGetSettings(userId);
      const botToken = settings?.bot_token || settings?.botToken || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = settings?.chat_id || settings?.chatId || process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        return;
      }

      const postData = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' });
      const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      });
      req.on('error', (err) => {
        console.error('[AutoPilot Daemon] Telegram send error:', err.message);
      });
      req.write(postData);
      req.end();
    } catch (err: any) {
      console.error('[AutoPilot Daemon] Telegram exception:', err.message);
    }
  }

  /**
   * Pobiera aktualne notowania z wewnętrznego endpointu HTTP /api/market-quotes
   */
  private static async fetchLiveQuotes(extraSymbols: string[] = []): Promise<MarketQuote[]> {
    return new Promise((resolve) => {
      const port = process.env.PORT || '3000';
      const symbolsSet = new Set<string>([...DEFAULT_WATCHLIST, ...extraSymbols]);
      const symbolQuery = Array.from(symbolsSet).join(',');

      const req = http.request({
        hostname: '127.0.0.1',
        port: parseInt(port, 10),
        path: `/api/market-quotes?symbols=${encodeURIComponent(symbolQuery)}`,
        method: 'GET',
        headers: { 'User-Agent': 'StockSignalPl-Daemon/2.4' },
        timeout: 5000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.success && Array.isArray(data.quotes)) {
              const quotes: MarketQuote[] = data.quotes.map((q: any) => {
                const isCommodity = Boolean(q.isCommodity || ['XAU', 'XAG', 'CB', 'CL', 'NG', 'COPPER', 'XPT', 'ZW'].some(c => q.symbol.includes(c)));
                let score = 70;
                if (q.changePercent > 1.2) score = 86;
                else if (q.changePercent > 0.4) score = 80;
                else if (q.changePercent > 0) score = 75;
                else if (q.changePercent < -1.5) score = 42;
                else if (q.changePercent < -0.5) score = 55;
                else score = 68;

                return {
                  symbol: q.symbol,
                  price: q.price,
                  change: q.change,
                  changePercent: q.changePercent,
                  trendScore: score,
                  isCommodity
                };
              });
              quotes.forEach(q => this.cachedQuotes.set(q.symbol, q));
              return resolve(quotes);
            }
          } catch (e: any) {
            console.error('[AutoPilot Daemon] Parse quotes error:', e.message);
          }
          resolve(Array.from(this.cachedQuotes.values()));
        });
      });

      req.on('error', (err) => {
        console.error('[AutoPilot Daemon] Fetch quotes network error:', err.message);
        resolve(Array.from(this.cachedQuotes.values()));
      });
      req.end();
    });
  }
}

