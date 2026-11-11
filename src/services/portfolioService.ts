import { PortfolioStrategy, TradeRecord, PositionItem, StockQuote, AutoPilotNotification, MarketSegment, AllowedMarketFilter, StockMarket } from '../types/stock';
import { INITIAL_PORTFOLIOS, INITIAL_TRADES } from '../data/initialData';
import { AudioService } from './audioService';
import { MarketSessionService } from './marketSessionService';
import { SettingsService } from './settingsService';
import { AuthService } from './authService';

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
        const parsed: TradeRecord[] = JSON.parse(savedT);
        // Odfiltruj transakcje błędnie wygenerowane w sobotę 07.11.2026 przed wdrożeniem blokady rynkowej
        this.trades = parsed.filter(t => !(t.date && (t.date.includes('7.11.2026') || t.date.includes('07.11.2026') || t.date.includes('2026-11-07'))));
        this.saveTrades();
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
    try {
      const user = AuthService.getCurrentUser();
      const userId = user?.id || 'usr_admin';
      this.portfolios.forEach(p => {
        this.syncPortfolioToServer(userId, p);
      });
    } catch {}
  }

  public static setPortfolios(newList: PortfolioStrategy[]): void {
    this.portfolios = [...newList];
    this.savePortfolios();
  }

  public static saveTrades(): void {
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(this.trades));
    try {
      const user = AuthService.getCurrentUser();
      const userId = user?.id || 'usr_admin';
      if (this.trades.length > 0) {
        this.syncTradeToServer(userId, this.trades[0]);
      }
    } catch {}
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
          this.trades = data.trades.filter((t: TradeRecord) => !(t.date && (t.date.includes('7.11.2026') || t.date.includes('07.11.2026') || t.date.includes('2026-11-07'))));
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


  public static isStockMarketAllowed(portfolio: PortfolioStrategy, stockMarket: StockMarket): boolean {
    let stockSegment: MarketSegment = 'GPW';
    if (stockMarket === 'Surowce') stockSegment = 'Surowce';
    else if (stockMarket === 'NewConnect') stockSegment = 'NewConnect';
    else if (stockMarket === 'FW20') stockSegment = 'FW20';
    else stockSegment = 'GPW';

    if (portfolio.allowedMarkets && portfolio.allowedMarkets.length > 0) {
      return portfolio.allowedMarkets.includes(stockSegment);
    }

    if (portfolio.allowedMarket && portfolio.allowedMarket !== 'ALL') {
      if (portfolio.allowedMarket === 'Surowce') return stockMarket === 'Surowce';
      if (portfolio.allowedMarket === 'GPW') return (stockMarket !== 'Surowce' && stockMarket !== 'NewConnect' && stockMarket !== 'FW20');
      if (portfolio.allowedMarket === 'NewConnect') return stockMarket === 'NewConnect';
      if (portfolio.allowedMarket === 'FW20') return stockMarket === 'FW20';
    }

    return true;
  }

  public static createPortfolio(
    name: string,
    shortDesc: string,
    riskLevel: 'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż',
    initialCapital: number,
    autoPilotEnabled: boolean = true,
    telegramEnabled: boolean = true,
    allowedMarkets: MarketSegment[] = ['GPW', 'Surowce', 'NewConnect', 'FW20']
  ): PortfolioStrategy {
    this.getPortfolios();
    const id = `port_${Date.now()}`;
    const newPort: PortfolioStrategy = {
      id,
      name,
      shortDesc: shortDesc || `Portfel inwestycyjny GPW o profilu ryzyka: ${riskLevel}`,
      riskLevel,
      allowedMarkets,
      allowedMarket: allowedMarkets.length === 4 ? 'ALL' : (allowedMarkets[0] as any || 'ALL'),
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
      createdAt: new Date().toISOString().split('T')[0],
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

  public static updatePortfolioStrategy(
    portfolioId: string,
    updates: {
      name?: string;
      shortDesc?: string;
      riskLevel?: 'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż';
      allowedMarkets?: MarketSegment[];
      allowedMarket?: AllowedMarketFilter;
      autoPilotEnabled?: boolean;
      telegramEnabled?: boolean;
      autoPilotMinConfidence?: number;
      autoPilotMinRiskReward?: number;
      autoPilotMaxPositions?: number;
      autoPilotAllocationPercent?: number;
      drawdownLockCap?: number;
      autoCutWeakConsensus?: boolean;
      orderExecutionType?: 'MARKET' | 'LIMIT_ZONE';
      positionSizingModel?: 'FIXED_PERCENT' | 'KELLY' | 'VOLATILITY_ATR';
      stopLossTrailingMode?: 'BREAK_EVEN_TP1' | 'TRAILING_ATR' | 'SWING_LOW';
      categoryAllocationLimit?: number;
      allowPyramiding?: boolean;
      multiTpBreakEvenEnabled?: boolean;
      anchorLeaderTracking?: boolean;
      anchorLeaderTicker?: string;
      anchorLeaderTrendMode?: 'STRICT_SAME_DIRECTION' | 'MOMENTUM_CONFIRMATION' | 'CONTRARIAN_HEDGE';
      anchorLeaderCorrelation?: number;
      anchorLeaderLagMinutes?: number;
      addCashPln?: number;
    }
  ): { success: boolean; message: string; portfolio?: PortfolioStrategy } {
    const portfolio = this.getPortfolio(portfolioId);
    if (!portfolio) return { success: false, message: 'Nie znaleziono portfela do edycji.' };

    if (updates.name !== undefined) portfolio.name = updates.name.trim();
    if (updates.shortDesc !== undefined) portfolio.shortDesc = updates.shortDesc.trim();
    if (updates.riskLevel !== undefined) portfolio.riskLevel = updates.riskLevel;
    if (updates.allowedMarkets !== undefined) portfolio.allowedMarkets = updates.allowedMarkets;
    if (updates.allowedMarket !== undefined) portfolio.allowedMarket = updates.allowedMarket;
    if (updates.autoPilotEnabled !== undefined) portfolio.autoPilotEnabled = updates.autoPilotEnabled;
    if (updates.telegramEnabled !== undefined) portfolio.telegramEnabled = updates.telegramEnabled;
    if (updates.autoPilotMinConfidence !== undefined) portfolio.autoPilotMinConfidence = updates.autoPilotMinConfidence;
    if (updates.autoPilotMinRiskReward !== undefined) portfolio.autoPilotMinRiskReward = updates.autoPilotMinRiskReward;
    if (updates.autoPilotMaxPositions !== undefined) portfolio.autoPilotMaxPositions = updates.autoPilotMaxPositions;
    if (updates.autoPilotAllocationPercent !== undefined) portfolio.autoPilotAllocationPercent = updates.autoPilotAllocationPercent;
    if (updates.drawdownLockCap !== undefined) portfolio.drawdownLockCap = updates.drawdownLockCap;
    if (updates.autoCutWeakConsensus !== undefined) portfolio.autoCutWeakConsensus = updates.autoCutWeakConsensus;
    if (updates.orderExecutionType !== undefined) portfolio.orderExecutionType = updates.orderExecutionType;
    if (updates.positionSizingModel !== undefined) portfolio.positionSizingModel = updates.positionSizingModel;
    if (updates.stopLossTrailingMode !== undefined) portfolio.stopLossTrailingMode = updates.stopLossTrailingMode;
    if (updates.categoryAllocationLimit !== undefined) portfolio.categoryAllocationLimit = updates.categoryAllocationLimit;
    if (updates.allowPyramiding !== undefined) portfolio.allowPyramiding = updates.allowPyramiding;
    if (updates.multiTpBreakEvenEnabled !== undefined) portfolio.multiTpBreakEvenEnabled = updates.multiTpBreakEvenEnabled;
    if (updates.anchorLeaderTracking !== undefined) portfolio.anchorLeaderTracking = updates.anchorLeaderTracking;
    if (updates.anchorLeaderTicker !== undefined) portfolio.anchorLeaderTicker = updates.anchorLeaderTicker;
    if (updates.anchorLeaderTrendMode !== undefined) portfolio.anchorLeaderTrendMode = updates.anchorLeaderTrendMode;
    if (updates.anchorLeaderCorrelation !== undefined) portfolio.anchorLeaderCorrelation = updates.anchorLeaderCorrelation;
    if (updates.anchorLeaderLagMinutes !== undefined) portfolio.anchorLeaderLagMinutes = updates.anchorLeaderLagMinutes;

    if (updates.addCashPln && updates.addCashPln > 0) {
      portfolio.cashPln += updates.addCashPln;
      portfolio.initialCapital += updates.addCashPln;
      portfolio.currentBalance += updates.addCashPln;
    }

    this.savePortfolios();
    return {
      success: true,
      message: `Strategia portfela "${portfolio.name}" została pomyślnie zaktualizowana!`,
      portfolio
    };
  }

  public static resetPortfolio(id: string): { success: boolean; message: string; portfolio?: PortfolioStrategy } {
    const portfolio = this.getPortfolio(id);
    if (!portfolio) return { success: false, message: 'Nie znaleziono portfela do zresetowania.' };

    portfolio.cashPln = portfolio.initialCapital;
    portfolio.allocatedPln = 0;
    portfolio.currentBalance = portfolio.initialCapital;
    portfolio.totalProfitPln = 0;
    portfolio.totalProfitPercent = 0;
    portfolio.activePositions = [];
    portfolio.autoPilotLogs = [];
    portfolio.drawdownLockActive = false;

    this.savePortfolios();
    return {
      success: true,
      message: `Portfel "${portfolio.name}" został zresetowany do kapitału początkowego ${portfolio.initialCapital.toLocaleString('pl-PL')} PLN.`,
      portfolio
    };
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

  public static addAutoPilotLog(portfolio: PortfolioStrategy, logItem: import('../types/stock').AutoPilotLogItem): void {
    if (!portfolio.autoPilotLogs) portfolio.autoPilotLogs = [];
    portfolio.autoPilotLogs.unshift(logItem);
    if (portfolio.autoPilotLogs.length > 100) {
      portfolio.autoPilotLogs = portfolio.autoPilotLogs.slice(0, 100);
    }
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

    // Weryfikacja czy rynek dla waloru jest obecnie otwarty
    const forceTest = SettingsService.getSettings().forceSessionOpenTest;
    const marketCheck = MarketSessionService.isMarketOpenForStock(pos.ticker, new Date(), forceTest);
    if (!marketCheck.isOpen) {
      return {
        success: false,
        message: `Nie można zamknąć pozycji. Rynek dla ${pos.ticker} jest ZAMKNIĘTY (${marketCheck.marketName}). ${marketCheck.reason}`,
        pnlPln: 0
      };
    }

    const closePrice = pos.currentPrice;
    const isShort = pos.positionSide === 'SHORT';
    const totalReturnPln = Number((pos.shares * closePrice).toFixed(2));
    const pnlPln = isShort
      ? Number(((pos.entryPrice - closePrice) * pos.shares).toFixed(2))
      : Number(((closePrice - pos.entryPrice) * pos.shares).toFixed(2));
    const pnlPercent = isShort
      ? Number((((pos.entryPrice - closePrice) / pos.entryPrice) * 100).toFixed(2))
      : Number((((closePrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

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
    customShares?: number,
    positionSide: 'LONG' | 'SHORT' = 'LONG'
  ): { success: boolean; message: string; position?: PositionItem; portfolioName?: string } {
    // Weryfikacja czy rynek dla waloru jest obecnie otwarty
    const forceTest = SettingsService.getSettings().forceSessionOpenTest;
    const marketCheck = MarketSessionService.isMarketOpenForStock(stock, new Date(), forceTest);
    if (!marketCheck.isOpen) {
      return {
        success: false,
        message: `Zlecenie odrzucone. Rynek dla waloru ${stock.symbol} jest ZAMKNIĘTY (${marketCheck.marketName}). ${marketCheck.reason}`
      };
    }

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

    // Wyznaczenie wolumenu: customShares lub alokacja % z konfigu
    let shares = customShares && customShares > 0 ? customShares : 0;
    if (!shares) {
      const allocPct = (portfolio.autoPilotAllocationPercent || 15) / 100;
      const maxAlloc = portfolio.currentBalance * allocPct;
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

    const isShort = positionSide === 'SHORT';
    const tp1 = isShort ? Number((entryPrice * 0.968).toFixed(2)) : Number((entryPrice * 1.032).toFixed(2));
    const tp2 = isShort ? Number((entryPrice * 0.935).toFixed(2)) : Number((entryPrice * 1.065).toFixed(2));
    const tp3 = isShort ? Number((entryPrice * 0.882).toFixed(2)) : Number((entryPrice * 1.118).toFixed(2));
    const sl  = isShort ? Number((entryPrice * 1.028).toFixed(2)) : Number((entryPrice * 0.972).toFixed(2));

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
      positionSide,
      status: 'AKTYWNA',
      pnlPln: 0,
      pnlPercent: 0,
      entryDate: new Date().toISOString().split('T')[0]
    };

    portfolio.activePositions.unshift(newPosition);

    this.addAutoPilotLog(portfolio, {
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('pl-PL'),
      ticker: stock.symbol,
      action: isShort ? 'KUPNO_SHORT' : 'KUPNO_LONG',
      confidence: score,
      riskRewardRatio: 2.8,
      reason: `Zlecenie ${isShort ? 'SHORT (Gra na spadki)' : 'LONG (Gra na wzrosty)'}: Konsensus ${score}% >= ${(portfolio.autoPilotMinConfidence || 76)}%`,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name
    });
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
      message: `Zlecenie zrealizowane! Zakupiono ${shares} szt. ${stock.symbol} za kwotę ${totalPln.toLocaleString('pl-PL')} PLN. Pozycja została dodana do: "${portfolio.name}".`,
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
    // Weryfikacja czy rynek dla waloru jest obecnie otwarty
    const forceTest = SettingsService.getSettings().forceSessionOpenTest;
    const marketCheck = MarketSessionService.isMarketOpenForStock(stock, new Date(), forceTest);
    if (!marketCheck.isOpen) {
      return {
        success: false,
        message: `Dodanie pozycji odrzucone. Rynek dla ${stock.symbol} jest ZAMKNIĘTY (${marketCheck.marketName}). ${marketCheck.reason}`
      };
    }

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
    const forceTest = SettingsService.getSettings().forceSessionOpenTest;

    this.portfolios.forEach(p => {
      const remainingPositions: PositionItem[] = [];

      p.activePositions.forEach(pos => {
        const quote = stockQuotes.find(q => q.symbol === pos.ticker || q.cleanSymbol === pos.ticker);
        if (quote) {
          // Zawsze aktualizuj bieżący kurs rynkowy i wynik PnL na żywo z ostatniego ticka
          pos.currentPrice = quote.price;
          pos.pnlPln = Number(((pos.currentPrice - pos.entryPrice) * pos.shares).toFixed(2));
          pos.pnlPercent = Number((((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

          // Na zamkniętym rynku brak realizacji automatycznych zleceń TP/SL
          const marketCheck = MarketSessionService.isMarketOpenForStock(quote, new Date(), forceTest);
          if (!marketCheck.isOpen) {
            remainingPositions.push(pos);
            return;
          }

          const timestamp = new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' });

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

    const forceTest = SettingsService.getSettings().forceSessionOpenTest;

    stockQuotes.forEach(stock => {
      // Weryfikacja czy rynek dla danego waloru jest otwarty
      const marketCheck = MarketSessionService.isMarketOpenForStock(stock, new Date(), forceTest);
      if (!marketCheck.isOpen) return;

      // Przyjmij kryterium MOCNE KUPUJ: rsi14 < 68, dodatnia zmiana lub wygenerowany sygnał wzrostowy
      const isStrongBuy = (stock.trendScore && stock.trendScore >= 76) ||
                          (stock.analystRecommendation?.includes('KUPUJ') && stock.changePercent > 0.3) ||
                          (stock.rsi14 < 65 && stock.macd.hist > 0 && stock.changePercent > 0.5);

      if (!isStrongBuy) return;

      activePortfolios.forEach(portfolio => {
        // Sprawdź Blokadę Osuwiska Kapitału (Drawdown Lock Cap)
        const currentDd = portfolio.initialCapital > 0
          ? ((portfolio.currentBalance - portfolio.initialCapital) / portfolio.initialCapital) * 100
          : 0;
        const maxDdCap = portfolio.drawdownLockCap !== undefined ? portfolio.drawdownLockCap : -15;

        if (currentDd <= maxDdCap) {
          portfolio.drawdownLockActive = true;
          this.addAutoPilotLog(portfolio, {
            id: `log_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('pl-PL'),
            ticker: 'DRAWDOWN_LOCK',
            action: 'POMINIĘTO',
            confidence: 0,
            riskRewardRatio: 0,
            reason: `Blokada Osuwiska Kapitału: Spadek (${currentDd.toFixed(1)}%) przekroczył próg (${maxDdCap}%). Wstrzymano zakupy.`,
            portfolioId: portfolio.id,
            portfolioName: portfolio.name
          });
          return;
        }

        // Auto-Cięcie osłabionego konsensusu (<45%)
        if (portfolio.autoCutWeakConsensus && portfolio.activePositions.length > 0) {
          portfolio.activePositions.forEach(pos => {
            const currentStock = stockQuotes.find(s => s.symbol === pos.ticker || s.cleanSymbol === pos.ticker);
            if (currentStock && (currentStock.trendScore || 50) < 45) {
              this.closePosition(portfolio.id, pos.id);
              this.addAutoPilotLog(portfolio, {
                id: `log_${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('pl-PL'),
                ticker: pos.ticker,
                action: 'AUTO_CUT',
                confidence: currentStock.trendScore || 40,
                riskRewardRatio: 0,
                reason: `Auto-Cięcie Risk Management: Konsensus spadł do ${currentStock.trendScore || 40}% (<45%). Zamykanie pozycji.`,
                portfolioId: portfolio.id,
                portfolioName: portfolio.name
              });
            }
          });
        }

        // Weryfikacja ograniczeń rynkowych w strategii tego portfela
        if (!this.isStockMarketAllowed(portfolio, stock.market)) return;

        // Sprawdź czy portfel nie posiada już aktywnej pozycji w tym walorze
        const alreadyHolds = portfolio.activePositions.some(
          pos => pos.ticker.toLowerCase() === stock.symbol.toLowerCase() ||
                 pos.ticker.toLowerCase() === stock.cleanSymbol.toLowerCase()
        );

        if (alreadyHolds) return;

        // Limit jednoczesnych pozycji
        const maxPos = portfolio.autoPilotMaxPositions || 5;
        if (portfolio.activePositions.length >= maxPos) {
          this.addAutoPilotLog(portfolio, {
            id: `log_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('pl-PL'),
            ticker: stock.symbol,
            action: 'POMINIĘTO',
            confidence: stock.trendScore || 80,
            riskRewardRatio: 2.5,
            reason: `Pominięto ${stock.symbol}: Osiągnięto limit ${maxPos} pozycji jednoczesnych w portfelu.`,
            portfolioId: portfolio.id,
            portfolioName: portfolio.name
          });
          return;
        }

        // Min Pewność Konsensusu
        const minConf = portfolio.autoPilotMinConfidence || 76;
        if ((stock.trendScore || 70) < minConf) return;

        // Spróbuj dokonać zakupu Auto-Pilota
        const result = this.executeAutoPilotSignal(stock, stock.trendScore || 82, stock.price, portfolio.id, undefined, 'LONG');
        if (result.success && result.position) {
          AudioService.playBuyChime();
          const timestamp = new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' });
          if (onNotification) {
            onNotification({
              id: `notif_buy_${Date.now()}`,
              type: 'BUY',
              title: '🤖 Auto-Pilot: Automatyczne KUPNO GPW / Surowce',
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
   * Eksport Otwartych Pozycji do formatu CSV
   */
  public static exportPositionsToCsv(): void {
    const portfolios = this.getPortfolios();
    const headers = ['Portfel', 'Ticker', 'Nazwa', 'Kierunek', 'Ilosc', 'Cena Wejscia (PLN)', 'Aktualna Cena (PLN)', 'Wartosc (PLN)', 'PnL (PLN)', 'PnL (%)', 'Status', 'Data Wejscia'];

    const rows: string[][] = [];
    portfolios.forEach(p => {
      p.activePositions.forEach(pos => {
        rows.push([
          `"${p.name.replace(/"/g, '""')}"`,
          pos.ticker,
          `"${pos.name.replace(/"/g, '""')}"`,
          pos.positionSide || 'LONG',
          pos.shares.toString(),
          pos.entryPrice.toFixed(2),
          pos.currentPrice.toFixed(2),
          (pos.shares * pos.currentPrice).toFixed(2),
          pos.pnlPln.toFixed(2),
          `${pos.pnlPercent.toFixed(2)}%`,
          `"${pos.status}"`,
          `"${pos.entryDate}"`
        ]);
      });
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StockSignalPl_Otwarte_Pozycje_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Aktualizacja notatki do transakcji
   */
  public static updateTradeNote(tradeId: string, note: string): boolean {
    const trade = this.getTrades().find(t => t.id === tradeId);
    if (!trade) return false;
    trade.notes = note.trim();
    this.saveTrades();
    return true;
  }

  /**
   * Eksport Dziennika Tradera do formatu CSV
   */
  public static exportTradesToCsv(): void {
    const trades = this.getTrades();
    const headers = ['ID', 'Data i Czas', 'Ticker', 'Nazwa Spolki', 'Typ', 'Cena (PLN)', 'Ilosc (szt.)', 'Wartosc (PLN)', 'Wynik (PLN)', 'Wynik (%)', 'Status', 'Notatka', 'Powod'];

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
      `"${(t.notes || '').replace(/"/g, '""')}"`,
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
