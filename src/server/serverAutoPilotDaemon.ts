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
  'OPL', 'JSW', 'KTY', 'SAN', 'XAU', 'XAG', 'CB', 'CL', 'NG', 'FW20'
];

export class ServerAutoPilotDaemon {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;
  private static lastRunTimestamp: number = 0;
  private static currentIntervalMs: number = 15000;
  private static cachedQuotes: Map<string, MarketQuote> = new Map();

  /**
   * Startuje autonomiczny proces egzekucyjny bota w tle na serwerze Node.js.
   * Działa niezależnie od tego, czy ktokolwiek jest zalogowany i czy przeglądarka jest otwarta.
   */
  public static start(intervalMs: number = 15000): void {
    if (this.isRunning) return;
    this.currentIntervalMs = intervalMs;
    this.isRunning = true;
    console.log(`[AutoPilot Daemon] 🤖 Inicjalizacja Autonomicznego Silnika Bota 24/7 (interwał: ${intervalMs / 1000}s)...`);

    // Pierwszy cykl po 4 sekundach od startu serwera
    setTimeout(() => {
      this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Error in first cycle:', err));
    }, 4000);

    // Główna pętla w tle serwera
    this.intervalHandle = setInterval(() => {
      this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Error in cycle:', err));
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
        this.executeCycle().catch(err => console.error('[AutoPilot Daemon] Error in cycle:', err));
      }, this.currentIntervalMs);
    }
  }

  public static getIntervalMs(): number {
    return this.currentIntervalMs;
  }

  public static getStatus(): { isRunning: boolean; intervalMs: number; lastRunTimestamp: number } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.currentIntervalMs,
      lastRunTimestamp: this.lastRunTimestamp
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
   * 1. Pobiera świeże kursy rynkowe GPW i Surowców
   * 2. Odpytuje bazę danych o wszystkie portfele użytkowników z włączonym Auto-Pilotem
   * 3. Weryfikuje warunki Stop Loss i Take Profit (TP1/TP2/TP3)
   * 4. Wyszukuje silne okazje i automatycznie zawiera nowe transakcje
   * 5. Zapisuje zaktualizowane salda i pozycje bezpośrednio w PostgreSQL
   * 6. Wysyła alerty Telegram (jeśli portfel ma włączone alerty)
   */
  public static async executeCycle(): Promise<void> {
    try {
      this.lastRunTimestamp = Date.now();
      const quotes = await this.fetchLiveQuotes();
      if (!quotes || quotes.length === 0) return;

      const userPortfolios = await dbGetAllPortfoliosWithUsers();
      if (!userPortfolios || userPortfolios.length === 0) return;

      for (const item of userPortfolios) {
        const { userId, portfolio } = item;
        if (!portfolio || !portfolio.autoPilotEnabled) continue;

        let portfolioChanged = false;
        const now = new Date();
        const remainingPositions: any[] = [];
        const positions = portfolio.activePositions || [];

        // ---------------------------------------------------------------------
        // KROK 1: Weryfikacja zleceń TP / SL dla otwartych pozycji
        // ---------------------------------------------------------------------
        for (const pos of positions) {
          const quote = quotes.find(q =>
            q.symbol.toUpperCase() === pos.ticker.toUpperCase() ||
            pos.ticker.toUpperCase().startsWith(q.symbol.toUpperCase())
          );

          if (!quote) {
            remainingPositions.push(pos);
            continue;
          }

          // Weryfikacja czy rynek jest aktualnie otwarty dla tego waloru
          const marketCheck = MarketSessionService.isMarketOpenForStock(pos.ticker, now, false);
          if (!marketCheck.isOpen) {
            remainingPositions.push(pos);
            continue;
          }

          pos.currentPrice = quote.price;
          const isShort = pos.positionSide === 'SHORT';

          pos.pnlPln = isShort
            ? Number(((pos.entryPrice - pos.currentPrice) * pos.shares).toFixed(2))
            : Number(((pos.currentPrice - pos.entryPrice) * pos.shares).toFixed(2));

          pos.pnlPercent = isShort
            ? Number((((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100).toFixed(2))
            : Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

          const dateStr = now.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

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

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer)</b>: Realizacja TP1 (33% pozycji)\n` +
              `Walor: <b>${pos.ticker}</b>\n` +
              `Portfel: <i>${portfolio.name}</i>\n` +
              `Kurs egzekucji: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `Wynik: <b>+${pnlPart.toFixed(2)} PLN</b>\n` +
              `Stop Loss został automatycznie przestawiony na Break-Even!`
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

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer)</b>: Realizacja TP2 (33% pozycji)\n` +
              `Walor: <b>${pos.ticker}</b>\n` +
              `Portfel: <i>${portfolio.name}</i>\n` +
              `Kurs egzekucji: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `Wynik: <b>+${pnlPart.toFixed(2)} PLN</b>`
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

            await this.sendTelegramAlertIfEnabled(userId, portfolio,
              `🤖 <b>Auto-Pilot 24/7 (Serwer)</b>: ${hitTp3 ? '🏆 Pełna Realizacja TP3 (+11.8%)' : '🛡️ Aktywacja Stop Loss'}\n` +
              `Walor: <b>${pos.ticker}</b>\n` +
              `Portfel: <i>${portfolio.name}</i>\n` +
              `Kurs zamknięcia: <b>${pos.currentPrice.toFixed(2)} zł</b>\n` +
              `Wynik transakcji: <b>${pnlPart >= 0 ? '+' : ''}${pnlPart.toFixed(2)} PLN (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)</b>`
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
        // Sprawdź czy nie przekroczono Drawdown Lock Cap (-15%)
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

              // Weryfikacja czy rynek waloru jest otwarty
              const marketCheck = MarketSessionService.isMarketOpenForStock(stock.symbol, now, false);
              if (!marketCheck.isOpen) continue;

              // Sprawdź czy portfel dopuszcza ten rynek
              const isAllowed = this.isMarketAllowedForPortfolio(portfolio, stock);
              if (!isAllowed) continue;

              // Sprawdź czy nie posiadamy już otwartej pozycji w tym walorze
              const alreadyHolds = portfolio.activePositions.some(
                (p: any) => p.ticker.toUpperCase() === stock.symbol.toUpperCase()
              );
              if (alreadyHolds) continue;

              // Warunek mocnego sygnału Auto-Pilota:
              const isOpportunity = (stock.trendScore && stock.trendScore >= minConf) ||
                                    (stock.analystRecommendation?.includes('KUPUJ') && stock.changePercent > 0.4);

              if (isOpportunity && stock.price > 0) {
                // Alokacja gotówki
                const allocPct = (portfolio.autoPilotAllocationPercent || 10) / 100;
                const buyBudget = Math.max(1000, portfolio.cashPln * allocPct);
                if (portfolio.cashPln >= buyBudget && buyBudget >= stock.price) {
                  const shares = Math.max(1, Math.floor(buyBudget / stock.price));
                  const totalPln = Number((shares * stock.price).toFixed(2));

                  portfolio.cashPln = Math.max(0, Number((portfolio.cashPln - totalPln).toFixed(2)));
                  portfolio.allocatedPln = Number((portfolio.allocatedPln + totalPln).toFixed(2));
                  portfolio.tradesCount = (portfolio.tradesCount || 0) + 1;

                  const atrMultiplier = stock.isCommodity ? 0.045 : 0.038;
                  const sl = Number((stock.price * (1 - atrMultiplier)).toFixed(2));
                  const tp1 = Number((stock.price * 1.032).toFixed(2));
                  const tp2 = Number((stock.price * 1.065).toFixed(2));
                  const tp3 = Number((stock.price * 1.118).toFixed(2));

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
                    timestamp: now.toLocaleTimeString('pl-PL'),
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
                    date: now.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
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

                  console.log(`[AutoPilot Daemon] 🛒 Kupiono ${shares} szt. ${stock.symbol} po ${stock.price} zł w portfelu "${portfolio.name}" (User: ${userId})`);

                  await this.sendTelegramAlertIfEnabled(userId, portfolio,
                    `🤖 <b>Auto-Pilot 24/7 (Serwer)</b>: Nowe Zlecenie KUPNA\n` +
                    `Walor: <b>${stock.symbol}</b>\n` +
                    `Portfel: <i>${portfolio.name}</i>\n` +
                    `Pakiet: <b>${shares} szt.</b> po <b>${stock.price.toFixed(2)} zł</b> (${totalPln.toLocaleString('pl-PL')} PLN)\n` +
                    `Stop Loss: <b>${sl.toFixed(2)} zł</b> | Cel TP3: <b>${tp3.toFixed(2)} zł</b>`
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
    } catch (err: any) {
      console.error('[AutoPilot Daemon] Błąd pętli egzekucyjnej:', err.message);
    }
  }

  private static isMarketAllowedForPortfolio(portfolio: any, stock: MarketQuote): boolean {
    const isCommodity = stock.isCommodity || ['XAU', 'XAG', 'CB', 'CL', 'NG', 'COPPER'].some(c => stock.symbol.includes(c));
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
      const botToken = settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = settings?.chat_id || process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) return;

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
      req.on('error', () => {});
      req.write(postData);
      req.end();
    } catch {}
  }

  /**
   * Pobiera aktualne notowania ze sprawdzonego endpointu wewnętrznego lub bezpośrednio z serwerowego cache
   */
  private static async fetchLiveQuotes(): Promise<MarketQuote[]> {
    return new Promise((resolve) => {
      const port = process.env.PORT || '3000';
      const req = https.request({
        hostname: '127.0.0.1',
        port: parseInt(port, 10),
        path: `/api/live-quotes?symbols=${encodeURIComponent(DEFAULT_WATCHLIST.join(','))}`,
        method: 'GET',
        headers: { 'User-Agent': 'StockSignalPl-Daemon/2.2' },
        timeout: 4000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.success && Array.isArray(data.quotes)) {
              const quotes: MarketQuote[] = data.quotes.map((q: any) => ({
                symbol: q.symbol,
                price: q.price,
                change: q.change,
                changePercent: q.changePercent,
                trendScore: q.changePercent > 1.2 ? 84 : (q.changePercent > 0.3 ? 78 : 55),
                isCommodity: q.isCommodity
              }));
              quotes.forEach(q => this.cachedQuotes.set(q.symbol, q));
              return resolve(quotes);
            }
          } catch {}
          resolve(Array.from(this.cachedQuotes.values()));
        });
      });

      req.on('error', () => {
        resolve(Array.from(this.cachedQuotes.values()));
      });
      req.end();
    });
  }
}
