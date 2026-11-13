import React, { useState, useMemo, useRef } from 'react';
import { StockQuote, PortfolioStrategy, TradeRecord, StockMarket, AppCurrency } from '../types/stock';
import { StooqService } from '../services/stooqService';
import { PortfolioService } from '../services/portfolioService';
import { TelegramService } from '../services/telegramService';
import { MarketSessionService } from '../services/marketSessionService';
import { SettingsService } from '../services/settingsService';
import { CandlestickRecharts } from './CandlestickRecharts';
import { AddNewStockModal } from './AddNewStockModal';
import {
  Send,
  CheckCircle2,
  Zap,
  AlertTriangle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  ArrowUpDown,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TabConsensusProps {
  stocks: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  portfolios: PortfolioStrategy[];
  onPortfoliosUpdate: (p: PortfolioStrategy[]) => void;
  trades: TradeRecord[];
  onTradesUpdate: (t: TradeRecord[]) => void;
  onNavigateToCalculator: (symbol: string) => void;
  onSwitchToPortfolios?: () => void;
  onStockAdded: (stock: StockQuote) => void;
  currency?: AppCurrency;
  usdPlnRate?: number;
}

export const TabConsensus: React.FC<TabConsensusProps> = ({
  stocks,
  selectedSymbol,
  onSelectSymbol,
  portfolios,
  onPortfoliosUpdate,
  onTradesUpdate,
  onNavigateToCalculator,
  onSwitchToPortfolios,
  onStockAdded,
  currency = 'PLN',
  usdPlnRate = 3.97
}) => {
  const fmtMoney = (valPln: number, dec = 2) => SettingsService.formatMoney(valPln, currency, usdPlnRate, dec);
  const currCode = SettingsService.getCurrencyCode(currency);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [marketFilter, setMarketFilter] = useState<'ALL' | StockMarket>('ALL');

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [customSharesInput, setCustomSharesInput] = useState<number>(0);

  // Sorting state for 10 sources table
  const [sourceSortField, setSourceSortField] = useState<'name' | 'signal' | 'score' | 'weight' | 'contribution'>('score');
  const [sourceSortOrder, setSourceSortOrder] = useState<'asc' | 'desc'>('desc');

  const tickersBarRef = useRef<HTMLDivElement>(null);

  const scrollTickers = (direction: 'left' | 'right') => {
    if (tickersBarRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tickersBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const filteredStocks = useMemo(() => {
    if (marketFilter === 'ALL') return stocks;
    return stocks.filter(s => s.market === marketFilter);
  }, [stocks, marketFilter]);

  const currentStock = stocks.find(s => s.symbol.toLowerCase() === selectedSymbol.toLowerCase()) || stocks[0];

  // Auto-select best portfolio when stock changes or portfolios load
  React.useEffect(() => {
    if (!currentStock) return;
    if (currentStock.market === 'Surowce') {
      const commPort = portfolios.find(p => p.id === 'commodities_safehaven');
      if (commPort) {
        setSelectedPortfolioId(commPort.id);
        setCustomSharesInput(0);
        return;
      }
    }
    if (!selectedPortfolioId || !portfolios.some(p => p.id === selectedPortfolioId)) {
      setSelectedPortfolioId(portfolios[0]?.id || 'wig20_bluechips');
    }
    setCustomSharesInput(0);
  }, [currentStock?.symbol, portfolios]);

  const targetPortfolio = useMemo(() => {
    return portfolios.find(p => p.id === selectedPortfolioId) || portfolios[0];
  }, [portfolios, selectedPortfolioId]);

  const unit = useMemo(() => {
    if (!currentStock) return 'szt.';
    if (currentStock.market === 'Surowce') {
      if (currentStock.cleanSymbol === 'XAU' || currentStock.cleanSymbol === 'XPT' || currentStock.cleanSymbol === 'XAG') return 'uncji (oz)';
      if (currentStock.cleanSymbol === 'BRENT' || currentStock.cleanSymbol === 'WTI') return 'baryłek (bbl)';
      if (currentStock.cleanSymbol === 'WHEAT') return 'buszli (bu)';
      if (currentStock.cleanSymbol === 'GAS') return 'kontr.';
      if (currentStock.cleanSymbol === 'COPPER') return 'funtów (lbs)';
      return 'jedn.';
    }
    if (currentStock.market === 'FW20') return 'kontr.';
    return 'szt.';
  }, [currentStock]);

  const consensus = useMemo(() => {
    if (!currentStock) return null;
    return StooqService.calculateConsensus(currentStock);
  }, [currentStock]);

  const marketStatus = useMemo(() => {
    if (!currentStock) return { isOpen: true, marketName: '', reason: '' };
    return MarketSessionService.isMarketOpenForStock(currentStock);
  }, [currentStock]);

  const defaultShares = useMemo(() => {
    if (!consensus || !targetPortfolio) return 1;
    const maxAlloc = targetPortfolio.currentBalance * 0.08;
    return Math.max(1, Math.floor(maxAlloc / consensus.entryPrice));
  }, [consensus?.entryPrice, targetPortfolio?.currentBalance]);

  const activeShares = customSharesInput > 0 ? customSharesInput : defaultShares;
  const totalCostPln = consensus ? Number((activeShares * consensus.entryPrice).toFixed(2)) : 0;

  const handleExecuteAutoPilot = () => {
    if (!currentStock || !consensus) return;
    const res = PortfolioService.executeAutoPilotSignal(
      currentStock,
      consensus.overallScore,
      consensus.entryPrice,
      selectedPortfolioId,
      activeShares
    );
    if (res.success) {
      setToastMessage(res.message);
      onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
      onTradesUpdate([...PortfolioService.getTrades()]);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => setToastMessage(null), 7000);
    } else {
      setToastMessage(res.message);
      setTimeout(() => setToastMessage(null), 7000);
    }
  };

  const handleSendTelegram = async () => {
    if (!currentStock || !consensus) return;
    setIsSendingTelegram(true);
    const res = await TelegramService.sendStockSignal(currentStock, consensus);
    setIsSendingTelegram(false);
    setToastMessage(res.message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'MOCNE KUPUJ':
        return 'bg-emerald-950 text-emerald-300 border-emerald-500/80';
      case 'KUPUJ':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-600/50';
      case 'NEUTRALNIE':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'SPRZEDAJ':
        return 'bg-rose-950/60 text-rose-400 border-rose-600/50';
      case 'MOCNE SPRZEDAJ':
        return 'bg-rose-950 text-rose-300 border-rose-500/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const toggleSourceSort = (field: typeof sourceSortField) => {
    if (sourceSortField === field) {
      setSourceSortOrder(sourceSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSourceSortField(field);
      setSourceSortOrder('desc');
    }
  };

  const sortedSources = useMemo(() => {
    if (!consensus?.sources) return [];
    return [...consensus.sources].sort((a, b) => {
      let valA = a[sourceSortField];
      let valB = b[sourceSortField];
      if (sourceSortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [consensus, sourceSortField, sourceSortOrder]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/80 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-medium animate-bounce max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <span className="block font-bold text-white">{toastMessage}</span>
          </div>
          {onSwitchToPortfolios && (
            <button
              onClick={onSwitchToPortfolios}
              title="Przejdź do zakładki Portfele i otwartych pozycji"
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0 transition-colors text-[10px] cursor-pointer shadow-md"
            >
              Zobacz w Portfelu →
            </button>
          )}
        </div>
      )}

      {/* Stock Quick Selector Bar with Segment Filter, Scroll + Add Stock Button */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl space-y-2.5">
        {/* Market Filter Chips Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(['ALL', 'WIG20', 'mWIG40', 'sWIG80', 'NewConnect', 'FW20', 'Surowce'] as const).map(m => (
              <button
                key={m}
                onClick={() => {
                  setMarketFilter(m);
                  if (m !== 'ALL') {
                    const match = stocks.find(s => s.market === m);
                    if (match && match.market !== currentStock?.market) {
                      onSelectSymbol(match.symbol);
                    }
                  }
                }}
                title={m === 'ALL' ? 'Pokaż wszystkie segmenty rynku' : `Filtruj walory z segmentu ${m}`}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  marketFilter === m
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40'
                    : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {m === 'ALL' ? 'Wszystkie Segmenty' : m === 'Surowce' ? 'Surowce & Metale' : m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Add New Stock / Commodity Button */}
            <button
              onClick={() => setIsAddStockOpen(true)}
              title="Dodaj nowy walor lub surowiec do bazy analizy (+)"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-emerald-950 text-slate-200 hover:text-emerald-300 border border-slate-700 text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nowy Walor / Surowiec</span>
            </button>
          </div>
        </div>

        {/* Scrollable Ticker Bar & Dropdown */}
        <div className="flex items-center gap-2">
          {/* Scroll Left Button */}
          <button
            onClick={() => scrollTickers('left')}
            title="Przewiń listę walorów w lewo (<)"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Quick Tickers */}
          <div
            ref={tickersBarRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-1"
          >
            {filteredStocks.map(stock => {
              const isSelected = stock.symbol.toLowerCase() === currentStock?.symbol.toLowerCase();
              return (
                <button
                  key={stock.symbol}
                  onClick={() => onSelectSymbol(stock.symbol)}
                  title={`${stock.cleanSymbol} (${stock.name}) • Rynek: ${stock.market} • Kurs: ${fmtMoney(stock.price)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/40 ring-1 ring-emerald-500'
                      : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{stock.cleanSymbol}</span>
                    {stock.market === 'Surowce' && (
                      <span className="text-[9px] px-1 py-0.2 bg-amber-950/80 text-amber-300 border border-amber-600/40 rounded font-normal">
                        Surowiec
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] block ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtMoney(stock.price)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scrollTickers('right')}
            title="Przewiń listę walorów w prawo (>)"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Select Dropdown */}
          <div className="w-48 sm:w-60 shrink-0">
            <select
              value={currentStock?.symbol}
              onChange={(e) => onSelectSymbol(e.target.value)}
              title="Wybierz walor lub surowiec"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            >
              {stocks.map(s => (
                <option key={s.symbol} value={s.symbol}>
                  [{s.market}] {s.cleanSymbol} - {s.name} ({fmtMoney(s.price)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {currentStock && consensus && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Interactive Chart & Execution Levels */}
          <div className="lg:col-span-2 space-y-6">
            {/* Technical Trend, Analyst Rating & Candlestick Analysis Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Trend Rating */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl" title="Kierunek i siła trendu wyznaczana przez SMA50, SMA200, MACD i RSI14">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {currentStock.market === 'Surowce' ? 'Ocena Trendu Surowca' : 'Ocena Trendu Rynkowego'}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black text-emerald-400">
                      {currentStock.trendRating || 'WZROSTOWY'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      {currentStock.trendScore ?? 75}/100
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">SMA50: {fmtMoney(currentStock.sma50)} • RSI: {currentStock.rsi14}</span>
                </div>

                {/* 2. Candlestick Pattern */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl" title="Wykryta formacja świecowa japońska (np. Młot, Wisielec, Spadająca Gwiazda)">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Formacja Świecowa</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black text-white truncate">
                      {currentStock.candlestickPattern || 'Objęcie Hossy'}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold inline-block mt-0.5 ${
                    currentStock.candlestickSignalType === 'NIEDŹWIEDZIA (BESSA)' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {currentStock.candlestickSignalType || 'Formacja Bycza (Hossa)'}
                  </span>
                </div>

                {/* 3. Analyst Recommendation & Target Price */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl" title="Średnia cena docelowa z rekomendacji i prognoz rynkowych">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Rekomendacja & Cel</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-black text-lime-400">
                      {currentStock.analystRecommendation || 'KUPUJ (BUY)'}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      Cel: {currentStock.analystTargetPrice ? fmtMoney(currentStock.analystTargetPrice) : '—'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Konsensus analityków i wycen rynkowych</span>
                </div>
              </div>
            </div>

            {/* Recharts Candlestick Chart with Stooq Historical OHLC */}
            <CandlestickRecharts stock={currentStock} height={340} currency={currency} usdPlnRate={usdPlnRate} />

            {/* Execution Levels Card (Entry, SL, Multi-TP 33/33/34) with tooltips */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Rekomendowane Poziomy Wejścia & Multi-TP (33/33/34)</span>
                  </h3>
                  <p className="text-xs text-slate-400">Algorytmiczne cele cenowe i poziomy egzekucji dla {currentStock.symbol} ({currCode})</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigateToCalculator(currentStock.symbol)}
                    title={`Przejdź do kalkulatora wielkości pozycji w ${currCode}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Kalkulator Wielkości</span>
                  </button>
                </div>
              </div>

              {/* Levels Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3"
                  title="Sugerowana optymalna cena wejścia na rynku"
                >
                  <span className="text-[10px] text-slate-400 block">CENA WEJŚCIA</span>
                  <span className="text-base font-black text-white font-mono mt-0.5 block">
                    {fmtMoney(consensus.entryPrice)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Aktualny kurs rynkowy</span>
                </div>

                <div
                  className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3"
                  title="Poziom Stop Loss (obrona przed nadmierną stratą na kapitale)"
                >
                  <span className="text-[10px] text-rose-300 font-semibold block">STOP LOSS</span>
                  <span className="text-base font-black text-rose-400 font-mono mt-0.5 block">
                    {fmtMoney(consensus.stopLoss)}
                  </span>
                  <span className="text-[10px] text-rose-500 font-mono">-{consensus.stopLossPercent}%</span>
                </div>

                <div
                  className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3"
                  title="Pierwszy Take Profit (+3.2%): realizacja 33% pozycji i przesunięcie SL na poziom wejścia (Break-Even)"
                >
                  <span className="text-[10px] text-emerald-300 font-semibold block">TP1 (33% wolumenu)</span>
                  <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                    {fmtMoney(consensus.tp1)}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-mono">+{consensus.tp1Percent}%</span>
                </div>

                <div
                  className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3"
                  title="Drugi Take Profit (+6.5%): realizacja kolejnych 33% zysków z pozycji"
                >
                  <span className="text-[10px] text-emerald-300 font-semibold block">TP2 (33% wolumenu)</span>
                  <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                    {fmtMoney(consensus.tp2)}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-mono">+{consensus.tp2Percent}%</span>
                </div>

                <div
                  className="bg-emerald-950/40 border border-emerald-700/60 rounded-xl p-3"
                  title="Trzeci Take Profit (+11.8%): zamknięcie pozostałych 34% pozycji i maksymalizacja zysku trendowego"
                >
                  <span className="text-[10px] text-emerald-300 font-semibold block">TP3 (34% wolumenu)</span>
                  <span className="text-base font-black text-emerald-300 font-mono mt-0.5 block">
                    {fmtMoney(consensus.tp3)}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">+{consensus.tp3Percent}%</span>
                </div>
              </div>

              {/* R:R Ratio info */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                <span className="flex items-center gap-1.5" title="Stosunek oczekiwanego ważonego zysku z poziomów TP do ryzyka Stop Loss">
                  <span>Stosunek Zysku do Ryzyka (R:R):</span>
                  <b className="text-emerald-400 font-mono">1 : {consensus.riskRewardRatio}</b>
                </span>
                <span className="text-[11px] text-slate-500">
                  Po osiągnięciu TP1 zlecenie SL automatycznie przesuwa się na Break-Even ({fmtMoney(consensus.entryPrice)}).
                </span>
              </div>
            </div>
          </div>

          {/* Right Col: Consensus Score Gauge & Transparent Order Execution Controls */}
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                  Agregacja Konsensusu Etapu 2
                </span>

                {/* Score Gauge Circle */}
                <div
                  className="relative w-40 h-40 mx-auto my-4 flex items-center justify-center cursor-help"
                  title={`Ogólny poziom zgodności 10 algorytmów sygnałowych: ${consensus.overallScore}% (${consensus.verdict})`}
                >
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#1e293b"
                      strokeWidth="9"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke={consensus.overallScore >= 76 ? '#10b981' : consensus.overallScore >= 60 ? '#84cc16' : '#f43f5e'}
                      strokeWidth="9"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * consensus.overallScore) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white font-mono">{consensus.overallScore}%</span>
                    <span className="text-[10px] text-slate-400 font-semibold">ZGODNOŚĆ</span>
                  </div>
                </div>

                {/* Verdict Badge */}
                <div className="inline-block mb-3">
                  <span
                    title={`Zagregowany werdykt 10 algorytmów: ${consensus.verdict} (${consensus.overallScore}%)`}
                    className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wide border shadow-sm ${getVerdictBadge(consensus.verdict)}`}
                  >
                    {consensus.verdict}
                  </span>
                </div>

                {/* Auto-Pilot Status Banner */}
                <div className="mt-2 mb-4">
                  {consensus.autoPilotActive ? (
                    <div
                      className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-center gap-2"
                      title="Konsensus osiągnął wymagany próg 76% - zlecenie jest gotowe do natychmiastowej realizacji przez Auto-Pilota"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                      <span className="font-bold">AUTO-PILOT AKTYWNY (Zgodność &gt;= 76%)</span>
                    </div>
                  ) : (
                    <div
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs flex items-center justify-center gap-2"
                      title="Do aktywacji trybu Auto-Pilot wymagany jest poziom konsensusu co najmniej 76%"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Konsensus poniżej progu Auto-Pilot (wymagane 76%)</span>
                    </div>
                  )}
                </div>

                {/* Transparent Order Controls Card */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3 text-left">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Parametry Zlecenia</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentStock.cleanSymbol} • {fmtMoney(consensus.entryPrice)}
                    </span>
                  </div>

                  {!marketStatus.isOpen && (
                    <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-300">Handel Wstrzymany: Rynek Zamknięty ({marketStatus.marketName})</span>
                        <span className="text-[10px] text-amber-200/90 block leading-tight">{marketStatus.reason}</span>
                      </div>
                    </div>
                  )}

                  {/* 1. Target Portfolio Selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Docelowy Portfel Inwestycyjny:
                    </label>
                    <select
                      value={selectedPortfolioId}
                      onChange={(e) => setSelectedPortfolioId(e.target.value)}
                      title="Wybierz portfel, do którego zostanie dodana ta pozycja"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                    >
                      {portfolios.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Gotówka: {fmtMoney(p.cashPln)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Quantity / Volume Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Ilość do zakupu ({unit}):
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Standard 8%: {defaultShares} {unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={activeShares}
                        onChange={(e) => setCustomSharesInput(Math.max(1, parseFloat(e.target.value) || 1))}
                        title="Wpisz liczbę jednostek do zakupu"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      {customSharesInput > 0 && customSharesInput !== defaultShares && (
                        <button
                          onClick={() => setCustomSharesInput(0)}
                          title="Przywróć wyliczenie domyślne (8% kapitału portfela)"
                          className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-xl border border-slate-700 shrink-0 cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Transaction Summary Banner */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-sans">Wartość Transakcji:</span>
                      <span className="font-bold text-emerald-400">{fmtMoney(totalCostPln)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-sans">Dostępna Gotówka:</span>
                      <span className={targetPortfolio && targetPortfolio.cashPln >= totalCostPln ? 'text-slate-300' : 'text-rose-400 font-bold'}>
                        {targetPortfolio ? fmtMoney(targetPortfolio.cashPln) : fmtMoney(0)}
                      </span>
                    </div>
                    {targetPortfolio && targetPortfolio.cashPln < totalCostPln && (
                      <div className="text-[10px] text-rose-400 font-sans font-semibold pt-1 border-t border-rose-950 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>Brak gotówki w portfelu na zakup {activeShares} {unit}!</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleExecuteAutoPilot}
                      disabled={Boolean(targetPortfolio && targetPortfolio.cashPln < totalCostPln)}
                      title={
                        targetPortfolio && targetPortfolio.cashPln >= totalCostPln
                          ? `Zrealizuj kupno ${activeShares} ${unit} ${currentStock.cleanSymbol} za kwotę ${fmtMoney(totalCostPln)} w portfelu "${targetPortfolio.name}"`
                          : 'Niewystarczająca ilość wolnej gotówki w wybranym portfelu'
                      }
                      className={`w-full py-3 px-3.5 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        targetPortfolio && targetPortfolio.cashPln < totalCostPln
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                      }`}
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span className="truncate">
                        Kup {activeShares} {unit} {currentStock.cleanSymbol} ({fmtMoney(totalCostPln)})
                      </span>
                    </button>

                    <button
                      onClick={handleSendTelegram}
                      disabled={isSendingTelegram}
                      title="Wyślij sformatowaną wiadomość HTML z sygnałem i poziomami cenowymi na podłączony kanał Telegram"
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Send className={`w-3.5 h-3.5 text-sky-400 ${isSendingTelegram ? 'animate-spin' : ''}`} />
                      <span>{isSendingTelegram ? 'Wysyłanie alertu...' : 'Wyślij Alert do Telegram'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10 Sources Detailed Breakdown Table (Sticky First Column + Header Sorting) */}
      {consensus && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Rozbicie Konsensusu: 10 Algorytmów Sygnałowych</h3>
              <p className="text-xs text-slate-400">
                Pierwsza kolumna (Źródło) jest zablokowana podczas przewijania. Kliknij nagłówek kolumny, aby posortować.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold select-none">
                  {/* Sticky Column 1: Źródło Sygnału */}
                  <th
                    onClick={() => toggleSourceSort('name')}
                    className="pb-3 sticky left-0 z-20 bg-slate-900 px-3 cursor-pointer hover:text-white min-w-[180px]"
                    title="Kliknij, aby posortować po nazwie źródła"
                  >
                    <div className="flex items-center gap-1">
                      <span>Źródło Sygnału</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSourceSort('signal')}
                    className="pb-3 px-3 text-center cursor-pointer hover:text-white"
                    title="Kliknij, aby posortować po kierunku sygnału"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Sygnał</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSourceSort('score')}
                    className="pb-3 px-3 text-center cursor-pointer hover:text-white"
                    title="Kliknij, aby posortować po ocenie punktowej"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Ocena (Score)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSourceSort('weight')}
                    className="pb-3 px-3 text-center cursor-pointer hover:text-white"
                    title="Kliknij, aby posortować po wadze"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Waga</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSourceSort('contribution')}
                    className="pb-3 px-3 text-center cursor-pointer hover:text-white"
                    title="Kliknij, aby posortować po wkładzie procentowym"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Wkład w Wynik</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="pb-3 px-3">Uzasadnienie Algorytmu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sortedSources.map(src => {
                  return (
                    <tr key={src.sourceId} className="hover:bg-slate-800/40 transition-colors">
                      {/* Sticky Column 1: Źródło Sygnału */}
                      <td className="py-3 sticky left-0 z-10 bg-slate-900 px-3 font-semibold text-white shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        {src.name}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          src.signal === 'KUPUJ'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : src.signal === 'SPRZEDAJ'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {src.signal}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                        {src.score}/100
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {src.weight}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                        +{src.contribution}%
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px] max-w-md truncate" title={src.reason}>
                        {src.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal to add new stock */}
      <AddNewStockModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        onStockAdded={(newStock) => {
          onStockAdded(newStock);
          setToastMessage(`Spółka ${newStock.symbol} (${newStock.name}) została pomyślnie dodana do bazy analizy!`);
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
};
