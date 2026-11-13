import React, { useState } from 'react';
import { StockMarket, StockQuote } from '../types/stock';
import { StooqService } from '../services/stooqService';
import { PlusCircle, X, CheckCircle2, AlertCircle, TrendingUp, Building } from 'lucide-react';

interface AddNewStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStockAdded: (newStock: StockQuote) => void;
}

export const AddNewStockModal: React.FC<AddNewStockModalProps> = ({ isOpen, onClose, onStockAdded }) => {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [market, setMarket] = useState<StockMarket>('mWIG40');
  const [sector, setSector] = useState('');
  const [price, setPrice] = useState<number>(50.0);
  const [peRatio, setPeRatio] = useState<number>(14.5);
  const [dividendYield, setDividendYield] = useState<number>(3.8);
  const [marketCap, setMarketCap] = useState<number>(1200);

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!symbol.trim()) {
      setError('Wprowadź symbol tickera giełdowego.');
      return;
    }

    if (price <= 0) {
      setError('Kurs początkowy musi być większy od zera.');
      return;
    }

    try {
      const newStock = StooqService.addStock({
        symbol: symbol.trim(),
        name: name.trim() || `${symbol.toUpperCase().replace('.PL', '')} S.A.`,
        market,
        sector: sector.trim() || 'Przemysł i Technologie GPW',
        price: Number(price.toFixed(2)),
        peRatio: Number(peRatio) || 12.0,
        dividendYield: Number(dividendYield) || 0.0,
        marketCapMlnPln: Number(marketCap) || Math.round(price * 40)
      });

      onStockAdded(newStock);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas dodawania waloru.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          title="Zamknij okno dodawania nowego waloru"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Dodaj Nowy Walor do Analizy GPW</h3>
            <p className="text-xs text-slate-400">Wprowadź dane spółki giełdowej lub instrumentu z rynku warszawskiego</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Ticker / Symbol *</label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="np. TEN.PL lub LVC"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
              />
              <span className="text-[10px] text-slate-500">Końcówka .PL doda się automatycznie</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Segment Rynku *</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value as StockMarket)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="WIG20">WIG20 (Blue Chips)</option>
                <option value="mWIG40">mWIG40 (Średnie spółki)</option>
                <option value="sWIG80">sWIG80 (Małe spółki)</option>
                <option value="NewConnect">NewConnect (Rynek alternatywny)</option>
                <option value="FW20">FW20 (Kontrakty terminowe)</option>
                <option value="Surowce">Surowce (Złoto, Ropa, Gaz, Metale, Rolne)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Pełna Nazwa Spółki</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Ten Square Games S.A."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Sektor Giełdowy</label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="np. Gry wideo / IT"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Aktualny Kurs Wejścia (PLN) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Cena / Zysk (P/E)</label>
              <input
                type="number"
                step="0.1"
                value={peRatio}
                onChange={(e) => setPeRatio(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Dywidenda (%)</label>
              <input
                type="number"
                step="0.1"
                value={dividendYield}
                onChange={(e) => setDividendYield(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Kapitalizacja (mln zł)</label>
              <input
                type="number"
                step="10"
                value={marketCap}
                onChange={(e) => setMarketCap(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              title="Anuluj dodawanie nowego waloru"
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              title="Dodaj instrument do bazy analizy i oblicz jego konsensus"
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              Dodaj do Bazy i Analizuj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
