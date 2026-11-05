import { PortfolioStrategy, TradeRecord, PositionItem, StockQuote, AutoPilotNotification } from '../types/stock';
import { INITIAL_PORTFOLIOS, INITIAL_TRADES } from '../data/initialData';
import { AudioService } from './audioService';

const PORTFOLIOS_STORAGE_KEY = 'stocksignalpl_portfolios_v1';
const TRADES_STORAGE_KEY = 'stocksignalpl_trades_v1';

export class PortfolioService {
  private static portfolios: PortfolioStrategy[] = [];
  private static trades: TradeRecord[] = [];

  public static initialize(): void {
    const savedP = localStorage.getItem(PORTFOLIOS_STORAGE_KEY);
    if (savedP) {
      try {
        const parsed = JSON.parse(savedP);
        const existingIds = new Set(parsed.map((p: PortfolioStrategy) => p.id));
        const missing = INITIAL_PORTFOLIOS.filter(p => !existingIds.has(p.id));
        this.portfolios = [...parsed, ...missing];
      } catch {
        this.portfolios = [...INITIAL_PORTFOLIOS];
      }
    } else {
      this.portfolios = [...INITIAL_PORTFOLIOS];
      this.savePortfolios();
    }

    const savedT = localStorage.getItem(TRADES_STORAGE_KEY);
    if (savedT) {
      try {
        this.trades = JSON.parse(savedT);
      } catch {
        this.trades = [...INITIAL_TRADES];
      }
    } else {
      this.trades = [...INITIAL_TRADES];
      this.saveTrades();
    }
  }

  public static getPortfolios(): PortfolioStrategy[] {
    if (this.portfolios.length === 0) {
      this.initialize();
    }
    return this.portfolios;
  }

  public static getPortfolio(id: string): PortfolioStrategy | undefined {
    return this.getPortfolios().find(p => p.id === id);
  }

  public static getTrades(): TradeRecord[] {
    if (this.trades.length === 0) {
      this.initialize();
    }
    return this.trades;
  }

  public static savePortfolios(): void {
    localStorage.setItem(PORTFOLIOS_STORAGE_KEY, JSON.stringify(this.portfolios));
  }

  public static setPortfolios(newList: PortfolioStrategy[]): void {
    this.portfolios = [...newList];
    this.savePortfolios();
  }

  public static saveTrades(): void {
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(this.trades));
  }

  public static setTrades(newList: TradeRecord[]): void {
    this.trades = [...newList];
    this.saveTrades();
  }

  public static async fetchPortfoliosFromServer(userId: string): Promise<PortfolioStrategy[]> {
    try {
      const res = await fetch(`/api/portfolios?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.portfolios) && data.portfolios.length > 0) {
          const existingIds = new Set(data.portfolios.map((p: PortfolioStrategy) => p.id));
          const missing = INITIAL_PORTFOLIOS.filter(p => !existingIds.has(p.id));
          this.portfolios = [...data.portfolios, ...missing];
          this.savePortfolios();
          return this.portfolios;
        }
      }
    } catch {
      // fallback
    }
    return this.getPortfolios();
  }

  public static async fetchTradesFromServer(userId: string): Promise<TradeRecord[]> {
    try {
      const res = await fetch(`/api/trades?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.trades)) {
          this.trades = data.trades;
          this.saveTrades();
          return this.trades;
        }
      }
    } catch {
      // fallback
    }
    return this.getTrades();
  }

  public static syncPortfolioToServer(userId: string, portfolio: PortfolioStrategy): void {
    fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, portfolio })
    }).catch(() => {});
  }

  public static syncTradeToServer(userId: string, trade: TradeRecord): void {
    fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, trade })
    }).catch(() => {});
  }

  public static deletePortfolioOnServer(userId: string, portfolioId: string): void {
    fetch(`/api/portfolios/${encodeURIComponent(portfolioId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    }).catch(() => {});
  }


  public static createPortfolio(
    name: string,
    shortDesc: string,
    riskLevel: 'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż',
    initialCapital: number,
    autoPilotEnabled: boolean = true,
    telegramEnabled: boolean = true
  ): PortfolioStrategy {
    this.getPortfolios();
    const id = `port_${Date.now()}`;
    const newPort: PortfolioStrategy = {
      id,
      name,
      shortDesc: shortDesc || `Portfel inwestycyjny GPW o profilu ryzyka: ${riskLevel}`,
      riskLevel,
      initialCapital,
      currentBalance: initialCapital,
      allocatedPln: 0,
      cashPln: initialCapital,
      totalProfitPln: 0,
      totalProfitPercent: 0,
      benchmarkReturnWig20: 14.2,
      alpha: 0,
      tradesCount: 0,
      winRate: 100,
      autoPilotEnabled,
      telegramEnabled,
      activePositions: [],
      historyData: [
        { date: '2026-06', portfolioVal: initialCapital, wig20Val: 100000 },
        { date: '2026-11', portfolioVal: initialCapital, wig20Val: 114200 }
      ]
    };
    this.portfolios.push(newPort);
    this.savePortfolios();
    return newPort;
  }

  public static deletePortfolio(id: string): { success: boolean; message: string } {
    this.getPortfolios();
    if (this.portfolios.length <= 1) {
      return { success: false, message: 'Nie można usunąć jedynego portfela w systemie.' };
    }
    const idx = this.portfolios.findIndex(p => p.id === id);
    if (idx === -1) {
      return { success: false, message: 'Nie znaleziono portfela do usunięcia.' };
    }
    const deletedName = this.portfolios[idx].name;
    this.portfolios.splice(idx, 1);
    this.savePortfolios();
    return { success: true, message: `Portfel "${deletedName}" został pomyślnie usunięty.` };
  }

  public static toggleAutoPilot(portfolioId: string): boolean {
    const p = this.getPortfolio(portfolioId);
    if (!p) return false;
    p.autoPilotEnabled = !p.autoPilotEnabled;
    this.savePortfolios();
    return p.autoPilotEnabled;
  }

  public static toggleTelegram(portfolioId: string): boolean {
    const p = this.getPortfolio(portfolioId);
    if (!p) return false;
    p.telegramEnabled = !p.telegramEnabled;
    this.savePortfolios();
    return p.telegramEnabled;
  }


  /**
   * Wykonanie Smart Rebalance
   * Równoważy wagi portfela, zamyka część zysków, optymalizuje gotówkę
   */
  public static triggerSmartRebalance(portfolioId: string): { success: boolean; message: string; rebalancedCash: number } {
    const p = this.getPortfolio(portfolioId);
    if (!p) return { success: false, message: 'Nie znaleziono portfela', rebalancedCash: 0 };

    // Symulacja optymalizacji wag
    const targetCashRatio = 0.20; // 20% bufor gotówki
    const totalVal = p.currentBalance;
    const targetCash = totalVal * targetCashRatio;
    const oldCash = p.cashPln;
    p.cashPln = Math.round(targetCash);
    p.allocatedPln = Math.round(totalVal - p.cashPln);

    // Zapisz wpis w dzienniku
    const newTrade: TradeRecord = {
      id: `tr_${Date.now()}`,
      date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
      ticker: 'REBALANCE.GPW',
      name: `Smart Rebalancing (${p.name})`,
      type: 'SPRZEDAŻ',
      pricePln: 1.0,
      shares: Math.abs(Math.round(p.cashPln - oldCash)),
      totalPln: Math.abs(Math.round(p.cashPln - oldCash)),
      resultPln: 350,
      resultPercent: 1.4,
      strategyId: p.id,
      reason: 'Algorytmiczny Smart Rebalance - realizacja zysków i przywrócenie wag docelowych',
      status: 'REBALANCE'
    };

    this.trades.unshift(newTrade);
    this.savePortfolios();
    this.saveTrades();

    return {
      success: true,
      message: `Portfel "${p.name}" pomyślnie zrebalansowany! Zabezpieczono ${p.cashPln.toLocaleString('pl-PL')} PLN w gotówce.`,
      rebalancedCash: p.cashPln
    };
  }

  /**
   * Ręczne zamknięcie aktywnej pozycji w portfelu po bieżącym kursie rynkowym
   */
  public static closePosition(portfolioId: string, positionId: string): { success: boolean; message: string; pnlPln: number } {
    const portfolio = this.getPortfolio(portfolioId);
    if (!portfolio) return { success: false, message: 'Nie znaleziono portfela', pnlPln: 0 };

    const posIndex = portfolio.activePositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) return { success: false, message: 'Nie znaleziono pozycji do zamknięcia', pnlPln: 0 };

    const pos = portfolio.activePositions[posIndex];
    const closePrice = pos.currentPrice;
    const totalReturnPln = Number((pos.shares * closePrice).toFixed(2));
    const pnlPln = Number(((closePrice - pos.entryPrice) * pos.shares).toFixed(2));
    const pnlPercent = Number((((closePrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

    // Zwróć gotówkę do salda portfela
    portfolio.cashPln = Number((portfolio.cashPln + totalReturnPln).toFixed(2));
    portfolio.allocatedPln = Math.max(0, Number((portfolio.allocatedPln - (pos.shares * pos.entryPrice)).toFixed(2)));
    portfolio.currentBalance = Number((portfolio.cashPln + portfolio.allocatedPln).toFixed(2));
    portfolio.totalProfitPln = Number((portfolio.totalProfitPln + pnlPln).toFixed(2));
    if (portfolio.initialCapital > 0) {
      portfolio.totalProfitPercent = Number(((portfolio.totalProfitPln / portfolio.initialCapital) * 100).toFixed(2));
    }

    // Usuń pozycję z aktywnych
    portfolio.activePositions.splice(posIndex, 1);

    // Dodaj wpis do Dziennika Tradera
    const tradeLog: TradeRecord = {
      id: `tr_${Date.now()}`,
      date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
      ticker: pos.ticker,
      name: pos.name,
      type: 'SPRZEDAŻ',
      pricePln: closePrice,
      shares: pos.shares,
      totalPln: totalReturnPln,
      resultPln: pnlPln,
      resultPercent: pnlPercent,
      strategyId: portfolio.id,
      reason: `Ręczne zamknięcie pozycji przez inwestora po kursie ${closePrice.toFixed(2)} zł (Wejście: ${pos.entryPrice.toFixed(2)} zł)`,
      status: pnlPln >= 0 ? 'ZYSK (TP)' : 'STRATA (SL)'
    };

    this.trades.unshift(tradeLog);
    this.savePortfolios();
    this.saveTrades();

    return {
      success: true,
      message: `Pozycja ${pos.ticker} została pomyślnie zamknięta po kursie ${closePrice.toFixed(2)} zł. Wynik: ${pnlPln >= 0 ? '+' : ''}${pnlPln.toLocaleString('pl-PL')} PLN (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%). Gotówka została zwrócona do portfela.`,
      pnlPln
    };
  }

  /**
   * Egzekucja zlecenia z poziomu Konsensusu (Auto-Pilot / Zlecenie Inwestora)
   */
  public static executeAutoPilotSignal(
    stock: StockQuote,
    score: number,
    entryPrice: number,
    targetPortfolioId?: string,
    customShares?: number
  ): { success: boolean; message: string; position?: PositionItem; portfolioName?: string } {
    let portfolio: PortfolioStrategy | undefined;
    if (targetPortfolioId) {
      portfolio = this.getPortfolio(targetPortfolioId);
    }
    if (!portfolio) {
      if (stock.market === 'Surowce') {
        portfolio = this.getPortfolios().find(p => p.id === 'commodities_safehaven') || this.getPortfolios()[0];
      } else {
        portfolio = this.getPortfolios()[0];
      }
    }
    if (!portfolio) return { success: false, message: 'Brak aktywnego portfela' };

    // Jednostka miary waloru
    const unit = stock.market === 'Surowce'
      ? (stock.cleanSymbol === 'XAU' || stock.cleanSymbol === 'XPT' || stock.cleanSymbol === 'XAG' ? 'uncji (oz)' :
         stock.cleanSymbol === 'BRENT' || stock.cleanSymbol === 'WTI' ? 'baryłek (bbl)' :
         stock.cleanSymbol === 'WHEAT' ? 'buszli (bu)' :
         stock.cleanSymbol === 'GAS' ? 'kontr.' :
         stock.cleanSymbol === 'COPPER' ? 'funtów (lbs)' : 'jedn.')
      : (stock.market === 'FW20' ? 'kontr.' : 'szt.');

    // Wyznaczenie wolumenu: customShares lub domyślne 8% kapitału
    let shares = customShares && customShares > 0 ? customShares : 0;
    if (!shares) {
      const maxAlloc = portfolio.currentBalance * 0.08;
      shares = Math.max(1, Math.floor(maxAlloc / entryPrice));
    }
    const totalPln = Number((shares * entryPrice).toFixed(2));

    if (portfolio.cashPln < totalPln) {
      return {
        success: false,
        message: `Niewystarczająca ilość wolnej gotówki w portfelu "${portfolio.name}" (dostępne: ${portfolio.cashPln.toLocaleString('pl-PL')} PLN, wymagane: ${totalPln.toLocaleString('pl-PL')} PLN).`
      };
    }

    portfolio.cashPln -= totalPln;
    portfolio.allocatedPln += totalPln;

    const tp1 = Number((entryPrice * 1.032).toFixed(2));
    const tp2 = Number((entryPrice * 1.065).toFixed(2));
    const tp3 = Number((entryPrice * 1.118).toFixed(2));
    const sl = Number((entryPrice * 0.972).toFixed(2));

    const newPosition: PositionItem = {
      id: `pos_${Date.now()}`,
      ticker: stock.symbol,
      name: stock.name,
      shares,
      entryPrice,
      currentPrice: entryPrice,
      targetPrice1: tp1,
      targetPrice2: tp2,
      targetPrice3: tp3,
      tp1Reached: false,
      tp2Reached: false,
      tp3Reached: false,
      stopLoss: sl,
      status: 'AKTYWNA',
      pnlPln: 0,
      pnlPercent: 0,
      entryDate: new Date().toISOString().split('T')[0]
    };

    portfolio.activePositions.unshift(newPosition);
    portfolio.tradesCount += 1;

    // Dziennik Tradera
    const tradeLog: TradeRecord = {
      id: `tr_${Date.now()}`,
      date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
      ticker: stock.symbol,
      name: stock.name,
      type: 'KUPNO',
      pricePln: entryPrice,
      shares,
      totalPln,
      resultPln: 0,
      resultPercent: 0,
      strategyId: portfolio.id,
      reason: `Zlecenie Konsensusu (Zgodność: ${score}%). Portfel: "${portfolio.name}". SL: ${sl} zł, TP3: ${tp3} zł`,
      status: 'AUTO-PILOT'
    };

    this.trades.unshift(tradeLog);
    this.savePortfolios();
    this.saveTrades();

    return {
      success: true,
      message: `Zlecenie zrealizowane! Zakupiono ${shares} ${unit} ${stock.symbol} za kwotę ${totalPln.toLocaleString('pl-PL')} PLN. Pozycja została dodana do: "${portfolio.name}".`,
      position: newPosition,
      portfolioName: portfolio.name
    };
  }

  /**
   * Dodanie ręcznej transakcji z poziomu kalkulatora lub konsensusu
   */
  public static addManualPosition(
    portfolioId: string,
    stock: StockQuote,
    shares: number,
    entryPrice: number,
    sl: number,
    tp1: number,
    tp2: number,
    tp3: number
  ): { success: boolean; message: string } {
    const portfolio = this.getPortfolio(portfolioId) || this.getPortfolios()[0];
    if (!portfolio) return { success: false, message: 'Nie znaleziono portfela' };

    const totalPln = Number((shares * entryPrice).toFixed(2));
    portfolio.cashPln = Math.max(0, portfolio.cashPln - totalPln);
    portfolio.allocatedPln += totalPln;

    const newPosition: PositionItem = {
      id: `pos_${Date.now()}`,
      ticker: stock.symbol,
      name: stock.name,
      shares,
      entryPrice,
      currentPrice: entryPrice,
      targetPrice1: tp1,
      targetPrice2: tp2,
      targetPrice3: tp3,
      tp1Reached: false,
      tp2Reached: false,
      tp3Reached: false,
      stopLoss: sl,
      status: 'AKTYWNA',
      pnlPln: 0,
      pnlPercent: 0,
      entryDate: new Date().toISOString().split('T')[0]
    };

    portfolio.activePositions.unshift(newPosition);
    portfolio.tradesCount += 1;

    const trade: TradeRecord = {
      id: `tr_${Date.now()}`,
      date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
      ticker: stock.symbol,
      name: stock.name,
      type: 'KUPNO',
      pricePln: entryPrice,
      shares,
      totalPln,
      resultPln: 0,
      resultPercent: 0,
      strategyId: portfolio.id,
      reason: `Zlecenie Tradera z poziomu Konsensusu / Kalkulatora (SL: ${sl} PLN, TP3: ${tp3} PLN)`,
      status: 'ZYSK (TP)'
    };

    this.trades.unshift(trade);
    this.savePortfolios();
    this.saveTrades();

    return {
      success: true,
      message: `Pomyślnie dodano pozycję: ${shares} sztuk ${stock.symbol} do portfela "${portfolio.name}".`
    };
  }

  /**
   * Symulacja realizacji TP / SL w portfelu oraz automatyczna egzekucja transakcji zawiadamiająca użytkownika
   */
  public static simulatePositionUpdate(
    stockQuotes: StockQuote[],
    onNotification?: (notif: AutoPilotNotification) => void
  ): void {
    let changed = false;

    this.portfolios.forEach(p => {
      const remainingPositions: PositionItem[] = [];

      p.activePositions.forEach(pos => {
        const quote = stockQuotes.find(q => q.symbol === pos.ticker || q.cleanSymbol === pos.ticker);
        if (quote) {
          pos.currentPrice = quote.price;
          pos.pnlPln = Number(((pos.currentPrice - pos.entryPrice) * pos.shares).toFixed(2));
          pos.pnlPercent = Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

          const timestamp = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          // 1. Osiągnięcie TP1 (33% wolumenu) -> Realizacja częściowa 33% i przesunięcie SL na Break-Even
          if (!pos.tp1Reached && pos.currentPrice >= pos.targetPrice1) {
            pos.tp1Reached = true;
            pos.status = 'ZREALIZOWANO TP1';
            pos.stopLoss = Math.max(pos.stopLoss, pos.entryPrice); // Break-even SL
            
            const soldShares = Math.max(1, Math.floor(pos.shares * 0.33));
            const returnCash = Number((soldShares * pos.currentPrice).toFixed(2));
            const pnlPart = Number(((pos.currentPrice - pos.entryPrice) * soldShares).toFixed(2));

            p.cashPln = Number((p.cashPln + returnCash).toFixed(2));
            p.allocatedPln = Math.max(0, Number((p.allocatedPln - (soldShares * pos.entryPrice)).toFixed(2)));
            p.currentBalance = Number((p.cashPln + p.allocatedPln).toFixed(2));
            p.totalProfitPln = Number((p.totalProfitPln + pnlPart).toFixed(2));

            // Zapisz wpis w Dzienniku Tradera
            const tradeLog: TradeRecord = {
              id: `tr_${Date.now()}_tp1`,
              date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
              ticker: pos.ticker,
              name: pos.name,
              type: 'SPRZEDAŻ',
              pricePln: pos.currentPrice,
              shares: soldShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)),
              strategyId: p.id,
              reason: `Auto-Pilot: Osiągnięto poziom TP1 (+3.2%). Realizacja 33% pozycji i przesunięcie SL na Break-Even (${pos.entryPrice.toFixed(2)} zł)`,
              status: 'AUTO-PILOT'
            };
            this.trades.unshift(tradeLog);
            changed = true;

            AudioService.playTpChime();
            if (onNotification) {
              onNotification({
                id: `notif_${Date.now()}_tp1`,
                type: 'SELL_TP',
                title: '🤖 Auto-Pilot: Realizacja TP1 (33%)',
                message: `Pomyślnie zrealizowano 33% pozycji ${pos.ticker} po kursie ${pos.currentPrice.toFixed(2)} zł. SL przesunięty na Break-Even!`,
                ticker: pos.ticker,
                portfolioName: p.name,
                shares: soldShares,
                pricePln: pos.currentPrice,
                totalPln: returnCash,
                resultPln: pnlPart,
                timestamp
              });
            }
          }

          // 2. Osiągnięcie TP2 (kolejne 33% wolumenu)
          if (pos.tp1Reached && !pos.tp2Reached && pos.currentPrice >= pos.targetPrice2) {
            pos.tp2Reached = true;
            pos.status = 'ZREALIZOWANO TP2';

            const soldShares = Math.max(1, Math.floor(pos.shares * 0.33));
            const returnCash = Number((soldShares * pos.currentPrice).toFixed(2));
            const pnlPart = Number(((pos.currentPrice - pos.entryPrice) * soldShares).toFixed(2));

            p.cashPln = Number((p.cashPln + returnCash).toFixed(2));
            p.allocatedPln = Math.max(0, Number((p.allocatedPln - (soldShares * pos.entryPrice)).toFixed(2)));
            p.currentBalance = Number((p.cashPln + p.allocatedPln).toFixed(2));
            p.totalProfitPln = Number((p.totalProfitPln + pnlPart).toFixed(2));

            const tradeLog: TradeRecord = {
              id: `tr_${Date.now()}_tp2`,
              date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
              ticker: pos.ticker,
              name: pos.name,
              type: 'SPRZEDAŻ',
              pricePln: pos.currentPrice,
              shares: soldShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)),
              strategyId: p.id,
              reason: `Auto-Pilot: Osiągnięto poziom TP2 (+6.5%). Realizacja kolejnych 33% pozycji z zyskiem.`,
              status: 'AUTO-PILOT'
            };
            this.trades.unshift(tradeLog);
            changed = true;

            AudioService.playTpChime();
            if (onNotification) {
              onNotification({
                id: `notif_${Date.now()}_tp2`,
                type: 'SELL_TP',
                title: '🤖 Auto-Pilot: Realizacja TP2 (33%)',
                message: `Pomyślnie zrealizowano kolejne 33% pozycji ${pos.ticker} po kursie ${pos.currentPrice.toFixed(2)} zł!`,
                ticker: pos.ticker,
                portfolioName: p.name,
                shares: soldShares,
                pricePln: pos.currentPrice,
                totalPln: returnCash,
                resultPln: pnlPart,
                timestamp
              });
            }
          }

          // 3. Osiągnięcie TP3 (+11.8%) lub STOP LOSS -> Pełne zamknięcie pozostałej pozycji
          const isTp3 = pos.tp2Reached && !pos.tp3Reached && pos.currentPrice >= pos.targetPrice3;
          const isSl = pos.currentPrice <= pos.stopLoss;

          if (isTp3 || isSl) {
            changed = true;
            const remainingShares = pos.shares;
            const returnCash = Number((remainingShares * pos.currentPrice).toFixed(2));
            const pnlPart = Number(((pos.currentPrice - pos.entryPrice) * remainingShares).toFixed(2));

            p.cashPln = Number((p.cashPln + returnCash).toFixed(2));
            p.allocatedPln = Math.max(0, Number((p.allocatedPln - (remainingShares * pos.entryPrice)).toFixed(2)));
            p.currentBalance = Number((p.cashPln + p.allocatedPln).toFixed(2));
            p.totalProfitPln = Number((p.totalProfitPln + pnlPart).toFixed(2));

            const tradeLog: TradeRecord = {
              id: `tr_${Date.now()}_close`,
              date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
              ticker: pos.ticker,
              name: pos.name,
              type: 'SPRZEDAŻ',
              pricePln: pos.currentPrice,
              shares: remainingShares,
              totalPln: returnCash,
              resultPln: pnlPart,
              resultPercent: Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)),
              strategyId: p.id,
              reason: isTp3
                ? `Auto-Pilot: Osiągnięto docelowe TP3 (+11.8%). Całkowita realizacja zysków z pozycji.`
                : `Auto-Pilot: Pozycja dotknęła poziomu Stop-Loss (${pos.stopLoss.toFixed(2)} zł). Automatyczne ucięcie strat.`,
              status: isTp3 ? 'ZYSK (TP)' : 'STRATA (SL)'
            };
            this.trades.unshift(tradeLog);

            if (isTp3) {
              AudioService.playTpChime();
            } else {
              AudioService.playSlChime();
            }

            if (onNotification) {
              onNotification({
                id: `notif_${Date.now()}_close`,
                type: isTp3 ? 'SELL_TP' : 'SELL_SL',
                title: isTp3 ? '🤖 Auto-Pilot: Pełna realizacja TP3 (+11.8%)' : '🤖 Auto-Pilot: Aktywacja Stop Loss',
                message: isTp3
                  ? `Pozycja ${pos.ticker} została w pełni zamknięta z zyskiem +${pnlPart.toLocaleString('pl-PL')} PLN!`
                  : `Pozycja ${pos.ticker} została zamknięta na poziomie SL (${pos.stopLoss.toFixed(2)} zł). Obcięto straty.`,
                ticker: pos.ticker,
                portfolioName: p.name,
                shares: remainingShares,
                pricePln: pos.currentPrice,
                totalPln: returnCash,
                resultPln: pnlPart,
                timestamp
              });
            }

            // Do not keep in activePositions
            return;
          }

          remainingPositions.push(pos);
        } else {
          remainingPositions.push(pos);
        }
      });

      p.activePositions = remainingPositions;
    });

    if (changed) {
      this.savePortfolios();
      this.saveTrades();
    }
  }

  /**
   * Automatyczne wyszukiwanie okazji rynkowych (MOCNE KUPUJ >= 76%) i zakupy przez Auto-Pilot
   */
  public static checkAndExecuteAutoPilotBuys(
    stockQuotes: StockQuote[],
    onNotification?: (notif: AutoPilotNotification) => void
  ): void {
    const activePortfolios = this.getPortfolios().filter(p => p.autoPilotEnabled);
    if (activePortfolios.length === 0) return;

    stockQuotes.forEach(stock => {
      // Przyjmij kryterium MOCNE KUPUJ: rsi14 < 68, dodatnia zmiana lub wygenerowany sygnał wzrostowy
      const isStrongBuy = (stock.trendScore && stock.trendScore >= 76) ||
                          (stock.analystRecommendation?.includes('KUPUJ') && stock.changePercent > 0.3) ||
                          (stock.rsi14 < 65 && stock.macd.hist > 0 && stock.changePercent > 0.5);

      if (!isStrongBuy) return;

      activePortfolios.forEach(portfolio => {
        // Sprawdź czy portfel nie posiada już aktywnej pozycji w tym walorze
        const alreadyHolds = portfolio.activePositions.some(
          pos => pos.ticker.toLowerCase() === stock.symbol.toLowerCase() ||
                 pos.ticker.toLowerCase() === stock.cleanSymbol.toLowerCase()
        );

        if (alreadyHolds) return;

        // Ogranicz liczbę pozycji w jednym portfelu do max 8
        if (portfolio.activePositions.length >= 8) return;

        // Spróbuj dokonać zakupu Auto-Pilota
        const result = this.executeAutoPilotSignal(stock, stock.trendScore || 82, stock.price, portfolio.id);
        if (result.success && result.position) {
          AudioService.playBuyChime();
          const timestamp = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          if (onNotification) {
            onNotification({
              id: `notif_buy_${Date.now()}`,
              type: 'BUY',
              title: '🤖 Auto-Pilot: Automatyczne KUPNO GPW',
              message: `Auto-Pilot zakupił ${result.position.shares} szt. ${stock.symbol} za kwotę ${result.position.shares * result.position.entryPrice} PLN w portfelu "${portfolio.name}".`,
              ticker: stock.symbol,
              portfolioName: portfolio.name,
              shares: result.position.shares,
              pricePln: result.position.entryPrice,
              totalPln: Number((result.position.shares * result.position.entryPrice).toFixed(2)),
              timestamp
            });
          }
        }
      });
    });
  }

  /**
   * Eksport Dziennika Tradera do formatu CSV
   */
  public static exportTradesToCsv(): void {
    const trades = this.getTrades();
    const headers = ['ID', 'Data i Czas', 'Ticker', 'Nazwa Spolki', 'Typ', 'Cena (PLN)', 'Ilosc (szt.)', 'Wartosc (PLN)', 'Wynik (PLN)', 'Wynik (%)', 'Status', 'Powod'];
    
    const rows = trades.map(t => [
      t.id,
      `"${t.date}"`,
      t.ticker,
      `"${t.name.replace(/"/g, '""')}"`,
      t.type,
      t.pricePln.toFixed(2),
      t.shares,
      t.totalPln.toFixed(2),
      t.resultPln.toFixed(2),
      `${t.resultPercent.toFixed(2)}%`,
      `"${t.status}"`,
      `"${t.reason.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StockSignalPl_Dziennik_Tradera_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
