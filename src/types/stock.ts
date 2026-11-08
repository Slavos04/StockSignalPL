/**
 * Typy danych dla platformy StockSignalPl v2.1
 * Rynek Giełdowy GPW Warszawa & Surowce
 */

export type StockMarket = 'WIG20' | 'mWIG40' | 'sWIG80' | 'NewConnect' | 'FW20' | 'Surowce';

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
  sma20?: number;
  sma50?: number;
}

export interface AnalystReportItem {
  id: string;
  broker: string;
  date: string;
  ticker: string;
  companyName: string;
  rating: 'KUPUJ' | 'AKUMULUJ' | 'TRZYMAJ' | 'REDUKUJ' | 'SPRZEDAJ';
  priceAtReport: number;
  targetPrice: number;
  currentPrice: number;
  returnPct: number;
  status: 'TARGET OSIĄGNIĘTY' | 'ZYSK W TRAKCIE' | 'STRATA (SL)' | 'W TRAKCIE';
  reportTitle: string;
  summary: string;
}

export interface StockQuote {
  symbol: string;         // np. PKN.PL
  cleanSymbol: string;    // PKN
  name: string;           // Orlen S.A.
  market: StockMarket;
  sector: string;
  price: number;          // PLN
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;         // PLN
  changePercent: number;  // %
  volume: number;         // sztuk
  turnoverPln: number;    // PLN
  peRatio: number;        // C/Z
  pbvRatio: number;       // C/WK
  dividendYield: number;  // %
  marketCapMlnPln: number;// mln PLN
  rsi14: number;
  macd: { value: number; signal: number; hist: number };
  sma50: number;
  sma200: number;
  candlestickPattern: string;
  trendRating?: 'BARDZO SILNY WZROSTOWY' | 'WZROSTOWY' | 'BOCZNY / KONSOLIDACJA' | 'SPADKOWY' | 'SILNY SPADKOWY';
  trendScore?: number; // 0 - 100
  analystRecommendation?: 'KUPUJ (BUY)' | 'AKUMULUJ' | 'TRZYMAJ (HOLD)' | 'REDUKUJ' | 'SPRZEDAJ (SELL)';
  analystTargetPrice?: number; // Docelowa cena analityków w PLN
  candlestickSignalType?: 'BYCZA (HOSSA)' | 'NIEDŹWIEDZIA (BESSA)' | 'NEUTRALNA';
  sparkline: number[];
  history: HistoricalBar[];
}

export type SignalVerdict = 'MOCNE KUPUJ' | 'KUPUJ' | 'NEUTRALNIE' | 'SPRZEDAJ' | 'MOCNE SPRZEDAJ';

export interface SignalSource {
  id: string;
  name: string;
  category: string;
  description: string;
  accuracyPercent: number; // Audytowana skuteczność %
  weight: number;          // Waga w algorytmie (suma wag = 100%)
  totalSignals: number;
  profitableSignals: number;
  unprofitableSignals: number;
  profitFactor: number;
  maxDrawdown: number;
  defaultWeight: number;
  status: 'KUPUJ' | 'SPRZEDAJ' | 'NEUTRALNIE';
  score: number;           // -100 do +100
  details: string;
}

export interface ConsensusBreakdownItem {
  sourceId: string;
  name: string;
  signal: 'KUPUJ' | 'SPRZEDAJ' | 'NEUTRALNIE';
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface StockConsensus {
  ticker: string;
  overallScore: number;     // 0 - 100%
  rawScore: number;         // -100 do +100
  verdict: SignalVerdict;
  confidence: number;       // 0 - 100%
  autoPilotActive: boolean; // Aktywny jeśli overallScore >= 76%
  entryPrice: number;       // PLN
  stopLoss: number;         // PLN
  stopLossPercent: number;  // %
  tp1: number;              // PLN (33% wolumenu)
  tp1Percent: number;
  tp2: number;              // PLN (33% wolumenu)
  tp2Percent: number;
  tp3: number;              // PLN (34% wolumenu)
  tp3Percent: number;
  riskRewardRatio: number;  // np. 2.8:1
  sources: ConsensusBreakdownItem[];
  timestamp: string;
}

export type PositionSide = 'LONG' | 'SHORT';

export interface PositionItem {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  targetPrice3: number;
  tp1Reached: boolean;
  tp2Reached: boolean;
  tp3Reached: boolean;
  stopLoss: number;
  positionSide?: PositionSide; // LONG (wzrost) lub SHORT (spadek)
  status: 'AKTYWNA' | 'ZREALIZOWANO TP1' | 'ZREALIZOWANO TP2' | 'ZAMKNIĘTO ZYSK' | 'STOP LOSS';
  pnlPln: number;
  pnlPercent: number;
  entryDate: string;
}

export type AllowedMarketFilter = 'ALL' | 'GPW' | 'Surowce' | 'NewConnect' | 'FW20';
export type MarketSegment = 'GPW' | 'Surowce' | 'NewConnect' | 'FW20';

export interface AutoPilotLogItem {
  id: string;
  timestamp: string;
  ticker: string;
  action: 'KUPNO_LONG' | 'KUPNO_SHORT' | 'SPRZEDAŻ_TP' | 'SPRZEDAŻ_SL' | 'AUTO_CUT' | 'POMINIĘTO';
  confidence: number;
  riskRewardRatio: number;
  reason: string;
  portfolioId: string;
  portfolioName: string;
}

export interface PortfolioStrategy {
  id: string;
  name: string;
  shortDesc: string;
  riskLevel: 'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż';
  allowedMarkets?: MarketSegment[]; // Ograniczenie Auto-Pilota do wybranych rynków (checkboxy)
  allowedMarket?: AllowedMarketFilter; // Dla kompatybilności wstecznej
  initialCapital: number;
  currentBalance: number;
  allocatedPln: number;
  cashPln: number;
  totalProfitPln: number;
  totalProfitPercent: number;
  benchmarkReturnWig20: number; // WIG20 benchmark %
  alpha: number;                 // Przewaga nad rynkiem
  tradesCount: number;
  winRate: number;
  autoPilotEnabled: boolean;
  telegramEnabled: boolean;

  // Zaawansowane parametry Auto-Pilota & Ochrony Kapitału (Zbieżne z CryptoSignal Engine)
  orderExecutionType?: 'MARKET' | 'LIMIT_ZONE';
  positionSizingModel?: 'FIXED_PERCENT' | 'KELLY' | 'VOLATILITY_ATR';
  stopLossTrailingMode?: 'BREAK_EVEN_TP1' | 'TRAILING_ATR' | 'SWING_LOW';
  categoryAllocationLimit?: number; // np. 40%
  allowPyramiding?: boolean;        // Dokupowanie kolejnej partii po osiągnięciu TP1
  multiTpBreakEvenEnabled?: boolean; // Podział 33/33/34% + przesunięcie SL na Break-Even
  
  // Benchmark Leader Tracking & Lag (Śledzenie Waloru Wiodącego)
  anchorLeaderTracking?: boolean;
  anchorLeaderTicker?: string;      // np. 'WIG20', 'FW2020.PL', 'CB.F', 'XAUUSD'
  anchorLeaderTrendMode?: 'STRICT_SAME_DIRECTION' | 'MOMENTUM_CONFIRMATION' | 'CONTRARIAN_HEDGE';
  anchorLeaderCorrelation?: number; // 50% - 95%
  anchorLeaderLagMinutes?: number;  // 0 - 240 min

  autoPilotMinConfidence?: number;     // np. 76% min. pewności konsensusu
  autoPilotMinRiskReward?: number;     // np. 2.0:1 min R:R
  autoPilotMaxPositions?: number;      // np. 5 max pozycji jednocześnie
  autoPilotAllocationPercent?: number; // np. 15% wolnej gotówki per zlecenie
  drawdownLockCap?: number;            // np. -15% max osuwisko kapitału
  drawdownLockActive?: boolean;        // Stan blokady osuwiska
  autoCutWeakConsensus?: boolean;      // Automatyczne zamykanie pozycji gdy Konsensus < 45%
  autoPilotLogs?: AutoPilotLogItem[];  // Dziennik audytowy decyzji bota

  activePositions: PositionItem[];
  historyData: { date: string; portfolioVal: number; wig20Val: number }[];
}

export interface TradeRecord {
  id: string;
  date: string;
  ticker: string;
  name: string;
  type: 'KUPNO' | 'SPRZEDAŻ' | 'KUPNO_SHORT' | 'ZAMKNIĘCIE_SHORT';
  positionSide?: PositionSide;
  pricePln: number;
  shares: number;
  totalPln: number;
  resultPln: number;
  resultPercent: number;
  strategyId: string;
  reason: string;
  status: 'ZYSK (TP)' | 'STRATA (SL)' | 'REBALANCE' | 'AUTO-PILOT' | 'RĘCZNE' | 'AUTO_CUT';
  notes?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'trader' | 'viewer';
  status: 'active' | 'blocked';
  createdAt: string;
  lastLogin: string;
  passwordHash?: string;
  notes?: string;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  alertsEnabled: boolean;
  lastSentAt?: string;
}

export type AppTheme = 'dark' | 'light' | 'ocean' | 'forrest';
export type AppCurrency = 'PLN' | 'USD';

export interface AppSettings {
  theme: AppTheme;
  customBgUrl: string;
  refreshIntervalSec: number;
  currency?: AppCurrency;     // PLN (zł) lub USD ($)
  usdPlnRate?: number;        // Aktuany kurs USD/PLN z NBP / Stooq (domyślnie ~4.02)
  bgOpacity?: number; // 0 to 100 (default 85 = clear visibility, less dark overlay)
  bgBlur?: number;    // 0 to 20 px (default 0 = crisp background)
  forceSessionOpenTest?: boolean; // Opcjonalne wymuszenie symulacji sesji giełdowej w celach testowych
}

export interface FearGreedData {
  score: number; // 0 - 100
  label: 'Ekstremalny strach' | 'Strach' | 'Neutralnie' | 'Chciwość' | 'Ekstremalna chciwość';
  wigVix: number;
  wig20Change: number;
  wig20Value: number;
  updatedAt: string;
}

export interface AutoPilotNotification {
  id: string;
  type: 'BUY' | 'SELL_TP' | 'SELL_SL';
  title: string;
  message: string;
  ticker: string;
  portfolioName: string;
  shares: number;
  pricePln: number;
  totalPln: number;
  resultPln?: number;
  timestamp: string;
}


