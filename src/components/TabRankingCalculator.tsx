import React, { useState, useMemo, useRef } from 'react';
import { StockQuote, StockMarket, PortfolioStrategy } from '../types/stock';
import { PortfolioService } from '../services/portfolioService';
import { AddNewStockModal } from './AddNewStockModal';
import {
  BarChart3,
  Calculator,
  Search,
  ArrowUpDown,
  PlusCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  HelpCircle,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TabRankingCalculatorProps {
  stocks: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onSwitchToConsensus: (symbol: string) => void;
  portfolios: PortfolioStrategy[];
  onPortfoliosUpdate: (p: PortfolioStrategy[]) => void;
  onStockAdded: (stock: StockQuote) => void;
  onStockDeleted?: (symbol: string) => void;
}

export const TabRankingCalculator: React.FC<TabRankingCalculatorProps> = ({
  stocks,
  selectedSymbol,
  onSelectSymbol,
  onSwitchToConsensus,
  portfolios,
  onPortfoliosUpdate,
  onStockAdded,
  onStockDeleted
}) => {
  const [marketFilter, setMarketFilter] = useState<'ALL' | StockMarket>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'cleanSymbol' | 'market' | 'price' | 'changePercent' | 'turnoverPln' | 'peRatio' | 'dividendYield' | 'trendScore' | 'candlestickPattern' | 'analystRecommendation'>('trendScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);

  // Calculator inputs
  const selectedStock = stocks.find(s => s.symbol.toLowerCase() === selectedSymbol.toLowerCase()) || stocks[0];
  const [accountCapital, setAccountCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(2.0);
  const [useKellyModel, setUseKellyModel] = useState<boolean>(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(portfolios[0]?.id || 'wig20_bluechips');

  const [entryPrice, setEntryPrice] = useState<number>(selectedStock ? selectedStock.price : 68.45);
  const [stopLossPrice, setStopLossPrice] = useState<number>(selectedStock ? Number((selectedStock.price * 0.972).toFixed(2)) : 66.53);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const marketFilterBarRef = useRef<HTMLDivElement>(null);

  const scrollMarkets = (direction: 'left' | 'right') => {
    if (marketFilterBarRef.current) {
      const scrollAmount = direction === 'left' ? -150 : 150;
      marketFilterBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Sync inputs when selectedStock changes
  React.useEffect(() => {
    if (selectedStock) {
      setEntryPrice(selectedStock.price);
      setStopLossPrice(Number((selectedStock.price * 0.972).toFixed(2)));
    }
  }, [selectedStock.symbol]);

  // Filtering & Sorting
  const filteredStocks = useMemo(() => {
    return stocks
      .filter(s => {
        const matchesMarket = marketFilter === 'ALL' || s.market === marketFilter;
        const matchesSearch = s.cleanSymbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.candlestickPattern && s.candlestickPattern.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesMarket && matchesSearch;
      })
      .sort((a, b) => {
        let valA: any = a[sortField] ?? 0;
        let valB: any = b[sortField] ?? 0;
        if (sortField === 'trendScore') {
          valA = a.trendScore ?? 50;
          valB = b.trendScore ?? 50;
        }
        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [stocks, marketFilter, searchTerm, sortField, sortOrder]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Advanced Position Sizing Calculations
  const calculatedPosition = useMemo(() => {
    const slDiff = Math.max(0.01, entryPrice - stopLossPrice);
    const slPercent = (slDiff / entryPrice) * 100;

    let effectiveRiskPercent = riskPercent;

    if (useKellyModel) {
      const p = 0.78;
      const b = 2.8;
      const fullKelly = (p * (b + 1) - 1) / b;
      effectiveRiskPercent = Number((fullKelly * 0.05 * 100).toFixed(1));
    }

    const maxLossPln = (accountCapital * effectiveRiskPercent) / 100;
    const rawShares = maxLossPln / slDiff;
    const shares = Math.max(1, Math.floor(rawShares));
    const totalExposurePln = Number((shares * entryPrice).toFixed(2));

    const tp1 = Number((entryPrice * 1.032).toFixed(2));
    const tp2 = Number((entryPrice * 1.065).toFixed(2));
    const tp3 = Number((entryPrice * 1.118).toFixed(2));

    const tp1ProfitPln = Number(((tp1 - entryPrice) * (shares * 0.33)).toFixed(2));
    const tp2ProfitPln = Number(((tp2 - entryPrice) * (shares * 0.33)).toFixed(2));
    const tp3ProfitPln = Number(((tp3 - entryPrice) * (shares * 0.34)).toFixed(2));
    const totalExpectedProfitPln = Number((tp1ProfitPln + tp2ProfitPln + tp3ProfitPln).toFixed(2));

    return {
      effectiveRiskPercent,
      maxLossPln,
      shares,
      totalExposurePln,
      slPercent,
      tp1,
      tp2,
      tp3,
      tp1ProfitPln,
      tp2ProfitPln,
      tp3ProfitPln,
      totalExpectedProfitPln,
      riskRewardRatio: Number((totalExpectedProfitPln / (maxLossPln || 1)).toFixed(1)) || 2.8
    };
  }, [accountCapital, riskPercent, useKellyModel, entryPrice, stopLossPrice]);

  const handleAddToPortfolio = () => {
    if (!selectedStock) return;
    const res = PortfolioService.addManualPosition(
      selectedPortfolioId,
      selectedStock,
      calculatedPosition.shares,
      entryPrice,
      stopLossPrice,
      calculatedPosition.tp1,
      calculatedPosition.tp2,
      calculatedPosition.tp3
    );

    if (res.success) {
      setToastMessage(res.message);
      onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage(res.message);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/60 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Kalkulator Wielkości Pozycji w PLN */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black text-white">Kalkulator Wielkości Pozycji & Zarządzania Ryzykiem (PLN)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Wylicz dokładną liczbę akcji, ekspozycję w PLN oraz zyski dla Multi-TP (33/33/34) przy żądanym ryzyku transakcji.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Wybrany walor:</span>
            <span
              title={`Wybrana spółka do kalkulacji: ${selectedStock.name}`}
              className="px-3 py-1 rounded-xl bg-slate-800 text-rose-400 font-bold text-xs border border-slate-700 font-mono"
            >
              {selectedStock.symbol} ({selectedStock.price.toFixed(2)} zł)
            </span>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Kapitał */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" title="Twój całkowity kapitał przeznaczony na inwestycje">
              Kapitał Konta (PLN)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1000"
                step="500"
                value={accountCapital}
                onChange={(e) => setAccountCapital(Math.max(100, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-mono">PLN</span>
            </div>
          </div>

          {/* Model Ryzyka */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300" title="Procent kapitału, który ryzykujesz w przypadku uderzenia w Stop Loss">
                Ryzyko na Transakcję
              </label>
              <button
                type="button"
                onClick={() => setUseKellyModel(!useKellyModel)}
                title="Model Kelly'ego wylicza optymalną frakcję kapitału w oparciu o historyczną skuteczność (78%) i stosunek R:R (2.8)"
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  useKellyModel ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Model Kelly'ego {useKellyModel ? 'ON' : 'OFF'}
              </button>
            </div>
            {useKellyModel ? (
              <div
                title="Konserwatywny fractional Kelly wyliczony algorytmicznie dla silnika StockSignalPl"
                className="bg-slate-950 border border-indigo-800/60 rounded-xl px-3.5 py-2 text-sm text-indigo-300 font-mono"
              >
                Fractional Kelly: {calculatedPosition.effectiveRiskPercent}%
              </div>
            ) : (
              <select
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
              >
                <option value={1.0}>1.0% - Konserwatywne</option>
                <option value={1.5}>1.5% - Umiarkowane</option>
                <option value={2.0}>2.0% - Standard GPW</option>
                <option value={3.0}>3.0% - Agresywne</option>
                <option value={5.0}>5.0% - Wysokie ryzyko</option>
              </select>
            )}
          </div>

          {/* Cena Wejścia */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" title="Planowany kurs zakupu akcji lub kontraktu">
              Cena Wejścia (PLN)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-mono">zł</span>
            </div>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" title="Poziom obrony, po przekroczeniu którego pozycja zostaje natychmiast zamknięta">
              Poziom Stop Loss (PLN)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-rose-800/60 rounded-xl px-3.5 py-2 text-sm text-rose-400 font-mono focus:outline-none focus:border-rose-500"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-rose-500 font-mono">zł</span>
            </div>
          </div>
        </div>

        {/* Calculation Result Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 font-mono">
          <div
            className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5"
            title="Liczba akcji do kupienia wyliczona z relacji dopuszczalnej straty do odległości Stop Loss"
          >
            <span className="text-[11px] text-slate-400 block font-sans">Liczba Akcji do Zakupu</span>
            <span className="text-xl font-black text-white mt-1 block">
              {calculatedPosition.shares} <span className="text-xs text-slate-400 font-normal">szt.</span>
            </span>
            <span className="text-[10px] text-slate-500 font-sans">
              Ekspozycja: {calculatedPosition.totalExposurePln.toLocaleString('pl-PL')} PLN
            </span>
          </div>

          <div
            className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3.5"
            title="Maksymalna kwota w PLN, jaką możesz stracić przy uderzeniu w Stop Loss"
          >
            <span className="text-[11px] text-rose-300 block font-sans">Maksymalna Strata (SL)</span>
            <span className="text-xl font-black text-rose-400 mt-1 block">
              -{calculatedPosition.maxLossPln.toFixed(2)} <span className="text-xs font-normal">PLN</span>
            </span>
            <span className="text-[10px] text-rose-500 font-sans">
              Ryzyko: {calculatedPosition.effectiveRiskPercent}% kapitału
            </span>
          </div>

          <div
            className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5"
            title="Średni zysk ważony z trzystopniowej realizacji Take Profit (TP1: 33%, TP2: 33%, TP3: 34%)"
          >
            <span className="text-[11px] text-emerald-300 block font-sans">Oczekiwany Zysk (Multi-TP)</span>
            <span className="text-xl font-black text-emerald-400 mt-1 block">
              +{calculatedPosition.totalExpectedProfitPln.toFixed(2)} <span className="text-xs font-normal">PLN</span>
            </span>
            <span className="text-[10px] text-emerald-500 font-sans">
              Średnia ważona z TP1/TP2/TP3
            </span>
          </div>

          <div
            className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5"
            title="Stosunek zysku do ryzyka: ile złotych zysku przypada na każdą ryzykowną złotówkę"
          >
            <span className="text-[11px] text-slate-400 block font-sans">Stosunek Zysku do Ryzyka (R:R)</span>
            <span className="text-xl font-black text-indigo-400 mt-1 block">
              1 : {calculatedPosition.riskRewardRatio}
            </span>
            <span className="text-[10px] text-slate-500 font-sans">
              Multi-TP 33/33/34
            </span>
          </div>
        </div>

        {/* Add to Portfolio bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Docelowy Portfel:</span>
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.currentBalance.toLocaleString('pl-PL')} PLN)</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleAddToPortfolio}
            title="Dodaj skalkulowaną transakcję bezpośrednio do wybranego portfela GPW"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Dodaj Pozycję do Portfela</span>
          </button>
        </div>
      </div>

      {/* Tabela Rankingu Spółek GPW (Sticky First Column + Header Sorting) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Ranking & Notowania Spółek GPW i Surowców (Stooq Data Feed)</span>
              <span className="text-xs font-normal text-slate-400">({filteredStocks.length} walorów)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Pierwsza kolumna (Walor) jest nieruchoma. Kliknij nagłówek, aby posortować rosnąco lub malejąco.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Add New Stock Button */}
            <button
              onClick={() => setIsAddStockOpen(true)}
              title="Dodaj nową spółkę lub surowiec do analizy w systemie (+)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/30 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Dodaj Walor</span>
            </button>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Szukaj waloru / surowca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-40 sm:w-52"
              />
            </div>

            {/* Market Tabs with scroll arrows */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollMarkets('left')}
                title="Przewiń segmenty w lewo (<)"
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div
                ref={marketFilterBarRef}
                className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs overflow-x-auto no-scrollbar scroll-smooth max-w-[360px]"
              >
                {(['ALL', 'WIG20', 'mWIG40', 'sWIG80', 'NewConnect', 'FW20', 'Surowce'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMarketFilter(m)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
                      marketFilter === m ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'ALL' ? 'Wszystkie' : m}
                  </button>
                ))}
              </div>

              <button
                onClick={() => scrollMarkets('right')}
                title="Przewiń segmenty w prawo (>)"
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold select-none">
                {/* Sticky Column 1: Walor */}
                <th
                  onClick={() => toggleSort('cleanSymbol')}
                  className="pb-3 sticky left-0 z-20 bg-slate-900 px-3 cursor-pointer hover:text-white min-w-[150px]"
                  title="Kliknij, aby posortować po nazwie spółki"
                >
                  <div className="flex items-center gap-1">
                    <span>Walor (Stooq Ticker)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('market')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po rynku"
                >
                  <div className="flex items-center gap-1">
                    <span>Rynek</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('trendScore')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po sile i kierunku trendu technicznego (0-100 pkt)"
                >
                  <div className="flex items-center gap-1">
                    <span>Ocena Trendu</span>
                    <ArrowUpDown className="w-3 h-3 text-rose-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('analystRecommendation')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po konsensusie rekomendacji biur maklerskich"
                >
                  <div className="flex items-center gap-1">
                    <span>Rekomendacja BM</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('candlestickPattern')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po wykrytych formacjach świecowych (Młot, Wisielec, Spadająca Gwiazda itp.)"
                >
                  <div className="flex items-center gap-1">
                    <span>Formacja Świecowa</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('price')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po kursie"
                >
                  <div className="flex items-center gap-1">
                    <span>Kurs (PLN)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('changePercent')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po sesyjnej zmianie procentowej"
                >
                  <div className="flex items-center gap-1">
                    <span>Zmiana %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('turnoverPln')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po wolumenie obrotu w PLN"
                >
                  <div className="flex items-center gap-1">
                    <span>Obrót (PLN)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('peRatio')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po wskaźniku Cena/Zysk (P/E)"
                >
                  <div className="flex items-center gap-1">
                    <span>C/Z (P/E)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('dividendYield')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po stopie dywidendy"
                >
                  <div className="flex items-center gap-1">
                    <span>Dywidenda %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="pb-3 px-3 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredStocks.map(stock => {
                const isSelected = stock.symbol.toLowerCase() === selectedSymbol.toLowerCase();

                const getTrendColor = (score: number = 50) => {
                  if (score >= 75) return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
                  if (score >= 55) return 'text-lime-400 bg-lime-950/60 border-lime-500/40';
                  if (score >= 45) return 'text-slate-300 bg-slate-800/60 border-slate-700';
                  if (score >= 30) return 'text-orange-400 bg-orange-950/60 border-orange-500/40';
                  return 'text-rose-400 bg-rose-950/60 border-rose-500/40';
                };

                const getRecomBadge = (rec?: string) => {
                  if (!rec) return 'bg-slate-800 text-slate-400 border-slate-700';
                  if (rec.includes('KUPUJ')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60';
                  if (rec.includes('AKUMULUJ')) return 'bg-lime-950/60 text-lime-300 border-lime-500/40';
                  if (rec.includes('TRZYMAJ')) return 'bg-slate-800 text-slate-300 border-slate-700';
                  if (rec.includes('REDUKUJ')) return 'bg-orange-950/60 text-orange-300 border-orange-500/40';
                  return 'bg-rose-950/80 text-rose-300 border-rose-500/60';
                };

                const getPatternBadge = (pattern: string, type?: string) => {
                  if (type === 'BYCZA (HOSSA)') {
                    return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
                  }
                  if (type === 'NIEDŹWIEDZIA (BESSA)') {
                    return 'bg-rose-950/60 text-rose-300 border-rose-500/40';
                  }
                  return 'bg-slate-800 text-slate-300 border-slate-700';
                };

                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => onSelectSymbol(stock.symbol)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-rose-950/40' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Sticky Column 1: Walor */}
                    <td className="py-3 sticky left-0 z-10 bg-slate-900 px-3 font-sans shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{stock.cleanSymbol}</span>
                        <span className="text-[10px] font-mono text-slate-500">{stock.symbol}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[140px]">{stock.name}</span>
                    </td>

                    <td className="py-3 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {stock.market}
                      </span>
                    </td>

                    {/* Trend Rating & Score */}
                    <td className="py-3 px-3 font-sans" title={`Wynik siły trendu: ${stock.trendScore ?? 50}/100 punktów`}>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getTrendColor(stock.trendScore)}`}>
                        <span>{stock.trendRating || 'WZROSTOWY'}</span>
                        <span className="font-mono opacity-80">({stock.trendScore ?? 65}p)</span>
                      </span>
                    </td>

                    {/* Analyst Recommendation */}
                    <td className="py-3 px-3 font-sans" title={`Cena docelowa analityków: ${stock.analystTargetPrice ? `${stock.analystTargetPrice} PLN` : 'Wycena rynkowa'}`}>
                      <div className="flex flex-col gap-0.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border max-w-fit ${getRecomBadge(stock.analystRecommendation)}`}>
                          {stock.analystRecommendation || 'KUPUJ (BUY)'}
                        </span>
                        {stock.analystTargetPrice && (
                          <span className="text-[10px] text-slate-400">Cel: {stock.analystTargetPrice.toFixed(2)} zł</span>
                        )}
                      </div>
                    </td>

                    {/* Candlestick Pattern */}
                    <td className="py-3 px-3 font-sans" title={`Formacja świecowa: ${stock.candlestickPattern} (${stock.candlestickSignalType || 'Hossa/Bessa'})`}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${getPatternBadge(stock.candlestickPattern, stock.candlestickSignalType)}`}>
                        {stock.candlestickPattern}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-bold text-white">
                      {stock.price.toFixed(2)} zł
                    </td>

                    <td className="py-3 px-3">
                      <span className={`font-bold ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      {stock.turnoverPln >= 1000000
                        ? `${(stock.turnoverPln / 1000000).toFixed(1)} mln zł`
                        : `${(stock.turnoverPln / 1000).toFixed(0)} tys zł`}
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : '—'}
                    </td>

                    <td className="py-3 px-3">
                      {stock.dividendYield > 0 ? (
                        <span className="text-emerald-400 font-semibold">{stock.dividendYield.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-500">0.0%</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwitchToConsensus(stock.symbol);
                        }}
                        title="Przejdź do pełnej analizy konsensusu 10 źródeł dla tego waloru"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-semibold transition-all cursor-pointer"
                      >
                        Konsensus →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal to add new stock */}
      <AddNewStockModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        onStockAdded={(newStock) => {
          onStockAdded(newStock);
          setToastMessage(`Spółka ${newStock.symbol} została pomyślnie dodana i wybrana do kalkulacji!`);
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
};
