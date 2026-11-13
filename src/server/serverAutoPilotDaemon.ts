import http from 'http';
import https from 'https';
import {
  dbGetAllPortfoliosWithUsers,
  dbSavePortfolio,
  dbSaveTrade,
  dbGetSettings,
  dbSaveNotification
} from './db';
import { MarketSessionService } from '../services/marketSessionService';
import { INITIAL_STOCKS } from '../data/initialData';
import { enrichStockSignalsPure } from '../utils/stockSignals';
import { formatWarsawDateTime, formatWarsawIsoDate, formatWarsawTime } from '../utils/dateTime';
import type { StockQuote } from '../types/stock';

interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  trendScore: number;
  rsi14: number;
  macdHist: number;
  analystRecommendation?: string;
  market: StockQuote['market'];
  isCommodity: boolean;
}

const DEFAULT_WATCHLIST = Array.from(
  new Set([
    ...INITIAL_STOCKS.map(s => s.symbol),
    'WIG20'
  ])
);

const normTicker = (s: string): string =>
  (s || '').toUpperCase().replace('.PL', '').replace('.WA', '').replace('.F', '').trim();

let seqCounter = 0;
function nextId(prefix: string, ticker: string): string {
  seqCounter = (seqCounter + 1) % 100000;
  return `${prefix}_${Date.now()}_${seqCounter}_${normTicker(ticker)}`;
}

export class ServerAutoPilotDaemon {
  private static isRunning = false;
  private static isCycleExecuting = false;
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
    this.currentIntervalMs = Math.max(1000, intervalMs);
    this.isRunning = true;
    console.log(`[AutoPilot Daemon] 🤖 Inicjalizacja Autonomicznego Silnika Bota 24/7 (interwał: ${this.currentIntervalMs / 1000}s)...`);

    setTimeout(() => {
      this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Błąd pierwszego cyklu:', err));
    }, 2500);

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
   * Główny cykl egzekucyjny Auto-Pilota na serwerze 24/7:
   * - Zawsze pobiera realne kursy z /api/market-quotes i łączy z fundamentami INITIAL_STOCKS
   * - Aktualizuje bieżącą wycenę wszystkich otwartych pozycji i salda portfeli
   * - Realizuje TP1 (33%), TP2 (33%), TP3 (34%) oraz Stop Loss (z prawidłowym zmniejszaniem liczby akcji!)
   * - Dokonuje nowych zakupów przy spełnieniu warunków strategii (w godzinach sesji lub trybie testowym)
   * - Zapisuje historię transakcji oraz powiadomienia z dokładną datą i godziną transakcji (Europe/Warsaw)
   */
  public static async executeCycle(): Promise<void> {
    if (this.isCycleExecuting) return;
    this.isCycleExecuting = true;

    try {
      this.lastRunTimestamp = Date.now();
      this.cyclesCount++;

      const userPortfolios = await dbGetAllPortfoliosWithUsers();
      if (!userPortfolios || userPortfolios.length === 0) {
        this.lastExecutionSummary = 'Brak aktywnych portfeli z włączonym Auto-Pilotem';
        return;
      }

      const dynamicSymbols = new Set<string>();
      userPortfolios.forEach(item => {
        (item.portfolio.activePositions || []).forEach((pos: any) => {
          if (pos.ticker) dynamicSymbols.add(pos.ticker);
        });
      });

      const quotes = await this.fetchLiveQuotes(Array.from(dynamicSymbols));
      if (!quotes || quotes.length === 0) {
        this.lastExecutionSummary = `Oczekiwanie na feed notowań (${formatWarsawTime()})`;
        return;
      }

      let totalOrdersExecuted = 0;
      const now = new Date();
      const dateStr = formatWarsawDateTime(now);
      const timeStr = formatWarsawTime(now);
      const isoDateStr = formatWarsawIsoDate(now);

      for (const item of userPortfolios) {
        const { userId, portfolio } = item;
        if (!portfolio || !portfolio.autoPilotEnabled) continue;

        let portfolioChanged = false;
        const remainingPositions: any[] = [];
        const positions = portfolio.activePositions || [];

        // ---------------------------------------------------------------------
        // KROK 1: Aktualizacja wyceny otwartych pozycji & realizacja TP / SL
        // ---------------------------------------------------------------------
        for (const pos of positions) {
          const quote = quotes.find(q => normTicker(q.symbol) === normTicker(pos.ticker));

          if (!quote || pos.shares <= 0) {
            if (pos.shares > 0) remainingPositions.push(pos);
            continue;
          }

          if (Math.abs((pos.currentPrice || 0) - quote.price) >= 0.005) {
            portfolioChanged = true;
          }

          pos.currentPrice = quote.price;
          const isShort = pos.positionSide === 'SHORT';

          const calcPnlPln = (sharesCount: number) =>
            isShort
              ? Number(((pos.entryPrice - pos.currentPrice) * sharesCount).toFixed(2))
              : Number(((pos.currentPrice - pos.entryPrice) * sharesCount).toFixed(2));

          const calcPnlPct = () =>
            pos.entryPrice > 0
              ? isShort
                ? Number((((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100).toFixed(2))
                : Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2))
              : 0;

          pos.pnlPln = calcPnlPln(pos.shares);
          pos.pnlPercent = calcPnlPct();

          // Weryfikacja czy rynek jest aktualnie otwarty dla tego waloru (lub czy trwa test wymuszonej sesji)
          const marketCheck = MarketSessionService.isMarketOpenForStock(
            { symbol: pos.ticker, market: quote.market },
            now,
            this.forceSessionOpenTest
          );
          if (!marketCheck.isOpen) {
            remainingPositions.push(pos);
            continue;
          }

          // 1. Osiągnięcie TP1 (33% wolumenu) -> realizacja 33% i przesunięcie SL na Break-Even
          const hitTp1 = isShort
            ? (!pos.tp1Reached && pos.currentPrice <= pos.targetPrice1)
            : (!pos.tp1Reached && pos.currentPrice >= pos.targetPrice1);

          const hitTp2 = isShort
            ? (pos.tp1Reached && !pos.tp2Reached && pos.currentPrice <= pos.targetPrice2)
            : (pos.tp1Reached && !pos.tp2Reached && pos.currentPrice >= pos.targetPrice2);

          const hitTp3 = isShort
            ? (pos.tp2Reached && !pos.tp3Reached && pos.currentPrice <= pos.targetPrice3)
            : (pos.tp2Reached && !pos.tp3Reached && pos.currentPrice >= pos.targetPrice3);

          const hitSl = isShort
            ? (pos.currentPrice >= pos.stopLoss)
            : (pos.currentPrice <= pos.stopLoss);

          if (hitTp1 && pos.shares > 0) {
            pos.tp1Reached = true;
            pos.status = 'ZREALIZOWANO TP1';
            pos.stopLoss = isShort
              ? Math.min(pos.stopLoss, pos.entryPrice)
              : Math.max(pos.stopLoss, pos.entryPrice);

            const soldShares = Math.min(pos.shares, Math.max(1, Math.floor(pos.shares * 0.33)));
            pos.shares = Math.max(0, pos.shares - soldShares);
            pos.pnlPln = calcPnlPln(pos.shares);

            const pnlPart = calcPnlPln(soldShares);
            const returnCash = isShort
              ? Number(Math.max(0, pos.entryPrice * soldShares + pnlPart).toFixed(2))
              : Number((soldShares * pos.currentPrice).toFixed(2));
            portfolio.cashPln = Number(((portfolio.cashPln || 0) + returnCash).toFixed(2));

            if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
            portfolio.autoPilotLogs.unshift({
              id: nextId('log_srv_tp1', pos.ticker),
              timestamp: dateStr,
              ticker: pos.ticker,
              action: 'SPRZEDAŻ_TP',
              confidence: quote.trendScore || 100,
              riskRewardRatio: 1.5,
              reason: `Realizacja TP1 (33%): sprzedano ${soldShares} szt. po ${pos.currentPrice.toFixed(2)} zł (PnL: ${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN). SL przestawiony na Break-Even.`,
              portfolioId: portfolio.id,
              portfolioName: portfolio.name
            });
            portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);

            const tradeLog = {
              id: nextId('tr_srv_tp1', pos.ticker),
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: isShort ? 'ZAMKNIĘCIE_SHORT' : 'SPRZEDAŻ',
              positionSide: pos.positionSide || 'LONG',
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
            await dbSaveNotification(userId, {
              id: nextId('notif_srv_tp1', pos.ticker),
              type: 'SELL_TP',
              title: '🤖 Serwer 24/7: Realizacja TP1 (33%)',
              message: `Zrealizowano 33% pozycji ${pos.ticker} (${soldShares} szt.) po ${pos.currentPrice.toFixed(2)} zł. SL na Break-Even!`,
              ticker: pos.ticker,
              portfolioName: portfolio.name,
              portfolioId: portfolio.id,
              shares: soldShares,
              pricePln: pos.currentPrice,
              totalPln: returnCash,
              resultPln: pnlPart,
              timestamp: dateStr,
              executedAtIso: now.toISOString(),
              source: 'SERVER_DAEMON',
              read: false
            });

            portfolioChanged = true;
            totalOrdersExecuted++;
            console.log(`[AutoPilot Daemon] 🎯 TP1 wykonane w tle o ${dateStr}: ${pos.ticker} (${soldShares} szt.) w portfelu "${portfolio.name}"`);

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: Realizacja TP1 (33% pozycji)\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏛️ Walor: <b>${pos.ticker}</b>\n` +
              `💼 Portfel: <i>${portfolio.name}</i>\n` +
              `💵 Kurs egzekucji: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `📦 Sprzedano: <b>${soldShares} szt.</b> (Pozostało: ${pos.shares} szt.)\n` +
              `📈 Zysk: <b>${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)</b>\n` +
              `🛡️ Stop Loss przestawiony na Break-Even (${pos.entryPrice.toFixed(2)} zł)\n` +
              `📅 <b>Data i godzina transakcji:</b> <code>${dateStr}</code>\n` +
              `📡 <i>Zlecenie wykonane w tle na serwerze (Warszawa CET/CEST)</i>`
            );

            if (pos.shares <= 0) {
              continue;
            }
          } else if (hitTp2 && pos.shares > 0) {
            // 2. Osiągnięcie TP2 (kolejne ~33% początkowej pozycji / 50% pozostałego pakietu)
            pos.tp2Reached = true;
            pos.status = 'ZREALIZOWANO TP2';

            const soldShares = Math.min(pos.shares, Math.max(1, Math.floor(pos.shares * 0.50)));
            pos.shares = Math.max(0, pos.shares - soldShares);
            pos.pnlPln = calcPnlPln(pos.shares);

            const pnlPart = calcPnlPln(soldShares);
            const returnCash = isShort
              ? Number(Math.max(0, pos.entryPrice * soldShares + pnlPart).toFixed(2))
              : Number((soldShares * pos.currentPrice).toFixed(2));
            portfolio.cashPln = Number(((portfolio.cashPln || 0) + returnCash).toFixed(2));

            if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
            portfolio.autoPilotLogs.unshift({
              id: nextId('log_srv_tp2', pos.ticker),
              timestamp: dateStr,
              ticker: pos.ticker,
              action: 'SPRZEDAŻ_TP',
              confidence: quote.trendScore || 100,
              riskRewardRatio: 2.4,
              reason: `Realizacja TP2 (33%): sprzedano ${soldShares} szt. po ${pos.currentPrice.toFixed(2)} zł (PnL: ${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN).`,
              portfolioId: portfolio.id,
              portfolioName: portfolio.name
            });
            portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);

            const tradeLog = {
              id: nextId('tr_srv_tp2', pos.ticker),
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: isShort ? 'ZAMKNIĘCIE_SHORT' : 'SPRZEDAŻ',
              positionSide: pos.positionSide || 'LONG',
              pricePln: pos.currentPrice,
              shares: soldShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: pos.pnlPercent,
              strategyId: portfolio.id,
              reason: `Serwer 24/7 Auto-Pilot: Osiągnięto poziom TP2. Realizacja kolejnej partii pozycji z zyskiem.`,
              status: 'AUTO-PILOT'
            };

            await dbSaveTrade(userId, tradeLog);
            await dbSaveNotification(userId, {
              id: nextId('notif_srv_tp2', pos.ticker),
              type: 'SELL_TP',
              title: '🤖 Serwer 24/7: Realizacja TP2 (33%)',
              message: `Zrealizowano kolejną partię ${pos.ticker} (${soldShares} szt.) po ${pos.currentPrice.toFixed(2)} zł!`,
              ticker: pos.ticker,
              portfolioName: portfolio.name,
              portfolioId: portfolio.id,
              shares: soldShares,
              pricePln: pos.currentPrice,
              totalPln: returnCash,
              resultPln: pnlPart,
              timestamp: dateStr,
              executedAtIso: now.toISOString(),
              source: 'SERVER_DAEMON',
              read: false
            });

            portfolioChanged = true;
            totalOrdersExecuted++;
            console.log(`[AutoPilot Daemon] 🎯 TP2 wykonane w tle o ${dateStr}: ${pos.ticker} (${soldShares} szt.) w portfelu "${portfolio.name}"`);

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: Realizacja TP2 (33% pozycji)\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏛️ Walor: <b>${pos.ticker}</b>\n` +
              `💼 Portfel: <i>${portfolio.name}</i>\n` +
              `💵 Kurs egzekucji: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `📦 Sprzedano: <b>${soldShares} szt.</b> (Pozostało: ${pos.shares} szt.)\n` +
              `📈 Zysk: <b>${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)</b>\n` +
              `📅 <b>Data i godzina transakcji:</b> <code>${dateStr}</code>\n` +
              `📡 <i>Zlecenie wykonane w tle na serwerze (Warszawa CET/CEST)</i>`
            );

            if (pos.shares <= 0) {
              continue;
            }
          } else if ((hitTp3 || hitSl) && pos.shares > 0) {
            // 3. Osiągnięcie TP3 lub STOP LOSS -> Pełne zamknięcie pozostałej pozycji
            const remainingShares = pos.shares;
            const pnlPart = calcPnlPln(remainingShares);
            const returnCash = isShort
              ? Number(Math.max(0, pos.entryPrice * remainingShares + pnlPart).toFixed(2))
              : Number((remainingShares * pos.currentPrice).toFixed(2));

            portfolio.cashPln = Number(((portfolio.cashPln || 0) + returnCash).toFixed(2));

            if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
            portfolio.autoPilotLogs.unshift({
              id: nextId(hitTp3 ? 'log_srv_tp3' : 'log_srv_sl', pos.ticker),
              timestamp: dateStr,
              ticker: pos.ticker,
              action: hitTp3 ? 'SPRZEDAŻ_TP' : 'SPRZEDAŻ_SL',
              confidence: quote.trendScore || 100,
              riskRewardRatio: hitTp3 ? 4.2 : 1,
              reason: hitTp3
                ? `Pełna realizacja TP3: zamknięto ${remainingShares} szt. po ${pos.currentPrice.toFixed(2)} zł (+${pnlPart.toFixed(2)} PLN).`
                : `Aktywacja Stop Loss (${pos.stopLoss.toFixed(2)} zł): zamknięto ${remainingShares} szt. (Wynik: ${pnlPart.toFixed(2)} PLN).`,
              portfolioId: portfolio.id,
              portfolioName: portfolio.name
            });
            portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);

            const tradeLog = {
              id: nextId(hitTp3 ? 'tr_srv_tp3' : 'tr_srv_sl', pos.ticker),
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: isShort ? 'ZAMKNIĘCIE_SHORT' : 'SPRZEDAŻ',
              positionSide: pos.positionSide || 'LONG',
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
            await dbSaveNotification(userId, {
              id: nextId(hitTp3 ? 'notif_srv_tp3' : 'notif_srv_sl', pos.ticker),
              type: hitTp3 ? 'SELL_TP' : 'SELL_SL',
              title: hitTp3 ? '🤖 Serwer 24/7: Pełna realizacja TP3' : '🤖 Serwer 24/7: Aktywacja Stop Loss',
              message: hitTp3
                ? `Pozycja ${pos.ticker} (${remainingShares} szt.) zamknięta z zyskiem po ${pos.currentPrice.toFixed(2)} zł.`
                : `Pozycja ${pos.ticker} (${remainingShares} szt.) zamknięta na Stop Loss (${pos.stopLoss.toFixed(2)} zł).`,
              ticker: pos.ticker,
              portfolioName: portfolio.name,
              portfolioId: portfolio.id,
              shares: remainingShares,
              pricePln: pos.currentPrice,
              totalPln: returnCash,
              resultPln: pnlPart,
              timestamp: dateStr,
              executedAtIso: now.toISOString(),
              source: 'SERVER_DAEMON',
              read: false
            });

            portfolioChanged = true;
            totalOrdersExecuted++;
            console.log(`[AutoPilot Daemon] ${hitTp3 ? '🏆 TP3' : '🛡️ SL'} wykonane w tle o ${dateStr}: ${pos.ticker} (${remainingShares} szt.) w "${portfolio.name}"`);

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: ${hitTp3 ? '🏆 Pełna Realizacja TP3' : '🛡️ Aktywacja Stop Loss'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏛️ Walor: <b>${pos.ticker}</b>\n` +
              `💼 Portfel: <i>${portfolio.name}</i>\n` +
              `💵 Kurs zamknięcia: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `📦 Zamknięto: <b>${remainingShares} szt.</b> (Zwrócono: ${returnCash.toLocaleString('pl-PL')} PLN)\n` +
              `📊 Wynik transakcji: <b>${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)</b>\n` +
              `📅 <b>Data i godzina transakcji:</b> <code>${dateStr}</code>\n` +
              `📡 <i>Zlecenie wykonane w tle na serwerze (Warszawa CET/CEST)</i>`
            );

            continue;
          } else if (portfolio.autoCutWeakConsensus && !isShort && quote.trendScore < 45 && pos.shares > 0) {
            // 4. Auto-Cięcie przy słabym konsensusie (<45%)
            const remainingShares = pos.shares;
            const pnlPart = calcPnlPln(remainingShares);
            const returnCash = Number((remainingShares * pos.currentPrice).toFixed(2));
            portfolio.cashPln = Number(((portfolio.cashPln || 0) + returnCash).toFixed(2));

            if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
            portfolio.autoPilotLogs.unshift({
              id: nextId('log_srv_cut', pos.ticker),
              timestamp: dateStr,
              ticker: pos.ticker,
              action: 'AUTO_CUT',
              confidence: quote.trendScore,
              riskRewardRatio: 0,
              reason: `Auto-Cięcie Risk Management: Konsensus spadł do ${quote.trendScore}% (<45%). Zamknięto ${remainingShares} szt. po ${pos.currentPrice.toFixed(2)} zł.`,
              portfolioId: portfolio.id,
              portfolioName: portfolio.name
            });
            portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);

            const tradeLog = {
              id: nextId('tr_srv_cut', pos.ticker),
              date: dateStr,
              ticker: pos.ticker,
              name: pos.name,
              type: 'SPRZEDAŻ',
              positionSide: pos.positionSide || 'LONG',
              pricePln: pos.currentPrice,
              shares: remainingShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: pos.pnlPercent,
              strategyId: portfolio.id,
              reason: `Serwer 24/7 Auto-Cięcie: Konsensus dla ${pos.ticker} spadł do ${quote.trendScore}% (<45%).`,
              status: pnlPart >= 0 ? 'ZYSK (TP)' : 'STRATA (SL)'
            };

            await dbSaveTrade(userId, tradeLog);
            await dbSaveNotification(userId, {
              id: nextId('notif_srv_cut', pos.ticker),
              type: pnlPart >= 0 ? 'SELL_TP' : 'SELL_SL',
              title: '🤖 Serwer 24/7: Auto-Cięcie Konsensusu',
              message: `Zamknięto ${pos.ticker} (${remainingShares} szt.) — konsensus spadł do ${quote.trendScore}% (<45%).`,
              ticker: pos.ticker,
              portfolioName: portfolio.name,
              portfolioId: portfolio.id,
              shares: remainingShares,
              pricePln: pos.currentPrice,
              totalPln: returnCash,
              resultPln: pnlPart,
              timestamp: dateStr,
              executedAtIso: now.toISOString(),
              source: 'SERVER_DAEMON',
              read: false
            });

            portfolioChanged = true;
            totalOrdersExecuted++;
            continue;
          }

          remainingPositions.push(pos);
        }

        portfolio.activePositions = remainingPositions;

        // Przelicz wycenę portfela po kroku 1 przed oceną Drawdown / Nowych zakupów
        this.recomputePortfolioMetrics(portfolio);

        // ---------------------------------------------------------------------
        // KROK 2: Wyszukiwanie nowych okazji rynkowych (Kupno Auto-Pilota)
        // ---------------------------------------------------------------------
        const currentDd = portfolio.initialCapital > 0
          ? ((portfolio.currentBalance - portfolio.initialCapital) / portfolio.initialCapital) * 100
          : 0;
        const maxDdCap = portfolio.drawdownLockCap !== undefined ? portfolio.drawdownLockCap : -15;

        if (currentDd <= maxDdCap) {
          if (!portfolio.drawdownLockActive) {
            portfolio.drawdownLockActive = true;
            if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
            portfolio.autoPilotLogs.unshift({
              id: nextId('log_srv_dd', 'DRAWDOWN'),
              timestamp: dateStr,
              ticker: 'DRAWDOWN_LOCK',
              action: 'POMINIĘTO',
              confidence: 0,
              riskRewardRatio: 0,
              reason: `Blokada Osuwiska Kapitału: Spadek (${currentDd.toFixed(1)}%) przekroczył próg (${maxDdCap}%). Wstrzymano nowe zakupy.`,
              portfolioId: portfolio.id,
              portfolioName: portfolio.name
            });
            portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);
            portfolioChanged = true;
          }
        } else {
          if (portfolio.drawdownLockActive) {
            portfolio.drawdownLockActive = false;
            portfolioChanged = true;
          }
          const maxPos = portfolio.autoPilotMaxPositions || 5;
          const minConf = portfolio.autoPilotMinConfidence || 76;

          if (portfolio.activePositions.length < maxPos) {
            // Sortuj kandydatów od najwyższego trendScore, żeby wybierać najsilniejsze walory
            const sortedQuotes = [...quotes].sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0));

            for (const stock of sortedQuotes) {
              if (portfolio.activePositions.length >= maxPos) break;

              const marketCheck = MarketSessionService.isMarketOpenForStock(
                { symbol: stock.symbol, market: stock.market },
                now,
                this.forceSessionOpenTest
              );
              if (!marketCheck.isOpen) continue;

              const isAllowed = this.isMarketAllowedForPortfolio(portfolio, stock);
              if (!isAllowed) continue;

              const alreadyHolds = portfolio.activePositions.some(
                (p: any) => normTicker(p.ticker) === normTicker(stock.symbol)
              );
              if (alreadyHolds) continue;

              const isStrongBuy =
                stock.trendScore >= minConf ||
                (stock.analystRecommendation?.includes('KUPUJ') && stock.changePercent > 0.3) ||
                (stock.rsi14 < 65 && stock.macdHist > 0 && stock.changePercent > 0.5);

              if (!isStrongBuy || stock.price <= 0) continue;

              const allocPct = (portfolio.autoPilotAllocationPercent || 15) / 100;
              const buyBudget = Math.max(1000, portfolio.currentBalance * allocPct);
              if (portfolio.cashPln < buyBudget || buyBudget < stock.price) continue;

              const shares = Math.max(1, Math.floor(buyBudget / stock.price));
              const totalPln = Number((shares * stock.price).toFixed(2));
              if (portfolio.cashPln < totalPln) continue;

              portfolio.cashPln = Math.max(0, Number((portfolio.cashPln - totalPln).toFixed(2)));
              portfolio.tradesCount = (portfolio.tradesCount || 0) + 1;

              const atrMultiplier = stock.isCommodity ? 0.045 : 0.038;
              const sl = Number((stock.price * (1 - atrMultiplier)).toFixed(2));
              const tp1 = Number((stock.price * 1.032).toFixed(2));
              const tp2 = Number((stock.price * 1.065).toFixed(2));
              const tp3 = Number((stock.price * 1.118).toFixed(2));

              const newPosition = {
                id: nextId('pos_srv', stock.symbol),
                ticker: stock.symbol,
                name: stock.name || stock.symbol,
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
                entryDate: isoDateStr
              };

              portfolio.activePositions.unshift(newPosition);

              if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
              portfolio.autoPilotLogs.unshift({
                id: nextId('log_srv', stock.symbol),
                timestamp: dateStr,
                ticker: stock.symbol,
                action: 'KUPNO_LONG',
                confidence: stock.trendScore,
                riskRewardRatio: 2.8,
                reason: `Autonomiczne wejście na serwerze (${dateStr}): Konsensus ${stock.trendScore}% >= ${minConf}%`,
                portfolioId: portfolio.id,
                portfolioName: portfolio.name
              });
              portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);

              const tradeLog = {
                id: nextId('tr_srv_buy', stock.symbol),
                date: dateStr,
                ticker: stock.symbol,
                name: stock.name || stock.symbol,
                type: 'KUPNO',
                positionSide: 'LONG',
                pricePln: stock.price,
                shares,
                totalPln,
                resultPln: 0,
                resultPercent: 0,
                strategyId: portfolio.id,
                reason: `Serwer 24/7 Auto-Pilot: Autonomiczny zakup PKC/Market (Konsensus: ${stock.trendScore}%). SL: ${sl} zł, TP3: ${tp3} zł`,
                status: 'AUTO-PILOT'
              };

              await dbSaveTrade(userId, tradeLog);
              await dbSaveNotification(userId, {
                id: nextId('notif_srv_buy', stock.symbol),
                type: 'BUY',
                title: '🤖 Serwer 24/7: Automatyczne KUPNO',
                message: `Auto-Pilot zakupił ${shares} szt. ${stock.symbol} po ${stock.price.toFixed(2)} zł (${totalPln.toLocaleString('pl-PL')} PLN) w "${portfolio.name}".`,
                ticker: stock.symbol,
                portfolioName: portfolio.name,
                portfolioId: portfolio.id,
                shares,
                pricePln: stock.price,
                totalPln,
                timestamp: dateStr,
                executedAtIso: now.toISOString(),
                source: 'SERVER_DAEMON',
                read: false
              });

              portfolioChanged = true;
              totalOrdersExecuted++;
              console.log(`[AutoPilot Daemon] 🛒 Kupiono w tle o ${dateStr}: ${shares} szt. ${stock.symbol} po ${stock.price} zł w "${portfolio.name}" (User: ${userId})`);

              await this.sendTelegramAlertIfEnabled(userId, portfolio,
                `🤖 <b>Auto-Pilot 24/7 (Serwer w Tle)</b>: Nowe Zlecenie KUPNA\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🏛️ Walor: <b>${stock.symbol}</b> (${stock.name})\n` +
                `💼 Portfel: <i>${portfolio.name}</i>\n` +
                `📦 Pakiet: <b>${shares} szt.</b> po <b>${stock.price.toFixed(2)} zł</b> (${totalPln.toLocaleString('pl-PL')} PLN)\n` +
                `🛑 Stop Loss: <b>${sl.toFixed(2)} zł</b> | 🎯 Cel TP3: <b>${tp3.toFixed(2)} zł</b>\n` +
                `📅 <b>Data i godzina transakcji:</b> <code>${dateStr}</code>\n` +
                `📡 <i>Zlecenie wykonane w tle przez serwer (okno przeglądarki może być zamknięte)</i>`
              );
            }
          }
        }

        if (portfolioChanged) {
          this.recomputePortfolioMetrics(portfolio);
          portfolio.updatedAt = now.toISOString();
          await dbSavePortfolio(userId, portfolio);
        }
      }

      this.lastExecutionSummary = totalOrdersExecuted > 0
        ? `Zrealizowano ${totalOrdersExecuted} zleceń w tle o ${timeStr} (${formatWarsawDateTime(now)})`
        : `Monitorowano ${userPortfolios.length} portfeli o ${timeStr} (kursy aktywne)`;

    } catch (err: any) {
      console.error('[AutoPilot Daemon] Błąd pętli egzekucyjnej:', err.message);
      this.lastExecutionSummary = `Błąd pętli: ${err.message}`;
    } finally {
      this.isCycleExecuting = false;
    }
  }

  private static recomputePortfolioMetrics(portfolio: any): void {
    const positions = portfolio.activePositions || [];
    const openVal = positions.reduce((sum: number, pos: any) => {
      const shares = Number(pos.shares) || 0;
      const cur = Number(pos.currentPrice) || Number(pos.entryPrice) || 0;
      const entry = Number(pos.entryPrice) || cur;
      if (pos.positionSide === 'SHORT') {
        const marginAndPnl = entry * shares + (entry - cur) * shares;
        return sum + Math.max(0, marginAndPnl);
      }
      return sum + (shares * cur);
    }, 0);

    portfolio.allocatedPln = Number(openVal.toFixed(2));
    portfolio.currentBalance = Number(((Number(portfolio.cashPln) || 0) + portfolio.allocatedPln).toFixed(2));
    const initCap = Number(portfolio.initialCapital) || 0;
    if (initCap > 0) {
      portfolio.totalProfitPln = Number((portfolio.currentBalance - initCap).toFixed(2));
      portfolio.totalProfitPercent = Number(((portfolio.totalProfitPln / initCap) * 100).toFixed(2));
    }
  }

  private static isMarketAllowedForPortfolio(portfolio: any, stock: MarketQuote): boolean {
    const isCommodity = stock.isCommodity || stock.market === 'Surowce';
    const isFw20 = stock.market === 'FW20' || stock.symbol.includes('FW20') || stock.symbol.includes('WIG20');
    const isNc = stock.market === 'NewConnect';

    if (portfolio.allowedMarkets && Array.isArray(portfolio.allowedMarkets) && portfolio.allowedMarkets.length > 0) {
      if (isCommodity && !portfolio.allowedMarkets.includes('Surowce')) return false;
      if (isFw20 && !portfolio.allowedMarkets.includes('FW20')) return false;
      if (isNc && !portfolio.allowedMarkets.includes('NewConnect')) return false;
      if (!isCommodity && !isFw20 && !isNc && !portfolio.allowedMarkets.includes('GPW')) return false;
    }
    return true;
  }

  private static async sendTelegramAlertIfEnabled(userId: string, portfolio: any, message: string): Promise<void> {
    if (!portfolio.telegramEnabled) return;
    try {
      const settings = await dbGetSettings(userId);
      const botToken = settings?.bot_token || settings?.botToken || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = settings?.chat_id || settings?.chatId || process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) return;

      const sentAt = formatWarsawDateTime();
      const fullMessage = `${message}\n📤 <i>Wysłano alert: ${sentAt}</i>`;

      const postData = JSON.stringify({ chat_id: chatId, text: fullMessage, parse_mode: 'HTML' });
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
   * i wzbogaca je o pełne wskaźniki z INITIAL_STOCKS + identyczną funkcję enrichStockSignalsPure jak w przeglądarce.
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
        headers: { 'User-Agent': 'StockSignalPl-Daemon/2.4.5' },
        timeout: 8000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.success && Array.isArray(data.quotes)) {
              const quotes: MarketQuote[] = data.quotes.map((q: any) => {
                const nq = normTicker(q.symbol);
                const base = INITIAL_STOCKS.find(
                  s => normTicker(s.symbol) === nq || normTicker(s.cleanSymbol) === nq ||
                       ((nq === 'WIG20' || nq === 'FW20' || nq === 'FW2020') && (normTicker(s.cleanSymbol) === 'FW20' || normTicker(s.cleanSymbol) === 'FW2020'))
                );

                const isCommodity = Boolean(
                  q.isCommodity ||
                  base?.market === 'Surowce' ||
                  ['XAU', 'XAG', 'CB', 'BRENT', 'CL', 'WTI', 'NG', 'HG', 'COPPER', 'XPT', 'ZW'].includes(nq)
                );

                const mergedStock: StockQuote = base
                  ? {
                      ...base,
                      price: Number(q.price),
                      previousClose: Number(q.previousClose || base.previousClose),
                      open: Number(q.open || base.open),
                      high: Number(Math.max(base.high, q.high || q.price)),
                      low: Number(Math.min(base.low, q.low || q.price)),
                      change: Number(q.change ?? (q.price - base.previousClose)),
                      changePercent: Number(q.changePercent ?? 0),
                      volume: Number(q.volume || base.volume)
                    }
                  : {
                      symbol: q.symbol,
                      cleanSymbol: nq,
                      name: q.symbol,
                      market: isCommodity ? 'Surowce' : nq.includes('FW20') ? 'FW20' : 'WIG20',
                      sector: isCommodity ? 'Surowce' : 'GPW',
                      price: Number(q.price),
                      open: Number(q.open || q.price),
                      high: Number(q.high || q.price),
                      low: Number(q.low || q.price),
                      previousClose: Number(q.previousClose || q.price),
                      change: Number(q.change || 0),
                      changePercent: Number(q.changePercent || 0),
                      volume: Number(q.volume || 10000),
                      turnoverPln: Math.round(Number(q.price) * Number(q.volume || 10000)),
                      peRatio: 12.0,
                      pbvRatio: 1.4,
                      dividendYield: 2.5,
                      marketCapMlnPln: 5000,
                      rsi14: q.changePercent > 0 ? 58 : 46,
                      macd: { value: 0.4, signal: 0.2, hist: q.changePercent >= 0 ? 0.2 : -0.2 },
                      sma50: Number((Number(q.price) * 0.97).toFixed(2)),
                      sma200: Number((Number(q.price) * 0.93).toFixed(2)),
                      candlestickPattern: 'Świeca Sesyjna',
                      sparkline: [Number(q.price)],
                      history: []
                    };

                const enriched = enrichStockSignalsPure(mergedStock);

                return {
                  symbol: base?.symbol || q.symbol,
                  name: enriched.name,
                  price: enriched.price,
                  change: enriched.change,
                  changePercent: enriched.changePercent,
                  trendScore: enriched.trendScore ?? 65,
                  rsi14: enriched.rsi14,
                  macdHist: enriched.macd?.hist ?? 0,
                  analystRecommendation: enriched.analystRecommendation,
                  market: enriched.market,
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
