import React, { useState, useEffect, useRef } from 'react';
import { PortfolioStrategy, MarketSegment, AppCurrency } from '../types/stock';
import { PortfolioService } from '../services/portfolioService';
import { SettingsService } from '../services/settingsService';
import { X, AlertCircle, Layers, Zap, Send } from 'lucide-react';

interface CreatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPortfolioCreated: (newPortfolio: PortfolioStrategy) => void;
  currency?: AppCurrency;
  usdPlnRate?: number;
}

const MARKET_OPTIONS: { id: MarketSegment; label: string; sub: string; icon: string }[] = [
  { id: 'GPW', label: 'Akcje GPW', sub: 'WIG20, mWIG40, sWIG80', icon: '📈' },
  { id: 'Surowce', label: 'Surowce i Towary', sub: 'Złoto, Ropa, Srebro, Miedź, Gaz', icon: '🛢️' },
  { id: 'NewConnect', label: 'NewConnect', sub: 'Spółki Wzrostowe NC', icon: '🚀' },
  { id: 'FW20', label: 'Kontrakty FW20', sub: 'Futures & Arbitraż', icon: '⚡' },
];

export const CreatePortfolioModal: React.FC<CreatePortfolioModalProps> = ({
  isOpen,
  onClose,
  onPortfolioCreated,
  currency = 'PLN',
  usdPlnRate = 3.97
}) => {
  const [name, setName] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [riskLevel, setRiskLevel] = useState<'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż'>('Umiarkowane');
  const [allowedMarkets, setAllowedMarkets] = useState<MarketSegment[]>(['GPW', 'Surowce', 'NewConnect', 'FW20']);
  const [initialCapital, setInitialCapital] = useState<number>(() =>
    Math.round(SettingsService.convertFromPln(50000, currency, usdPlnRate))
  );
  const [autoPilotEnabled, setAutoPilotEnabled] = useState<boolean>(true);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const prevCurrencyRef = useRef<AppCurrency>(currency);

  useEffect(() => {
    if (prevCurrencyRef.current !== currency) {
      const asPln = SettingsService.convertToPln(initialCapital, prevCurrencyRef.current, usdPlnRate);
      setInitialCapital(Math.max(100, Math.round(SettingsService.convertFromPln(asPln, currency, usdPlnRate))));
      prevCurrencyRef.current = currency;
    }
  }, [currency, usdPlnRate, initialCapital]);

  if (!isOpen) return null;

  const currCode = SettingsService.getCurrencyCode(currency);

  const toggleMarket = (marketId: MarketSegment) => {
    if (allowedMarkets.includes(marketId)) {
      setAllowedMarkets(allowedMarkets.filter(m => m !== marketId));
    } else {
      setAllowedMarkets([...allowedMarkets, marketId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Wprowadź nazwę nowego portfela.');
      return;
    }

    const capitalInPln = Math.round(SettingsService.convertToPln(initialCapital, currency, usdPlnRate));
    if (capitalInPln <= 0) {
      setError('Kapitał początkowy musi być większy od zera.');
      return;
    }

    const newPort = PortfolioService.createPortfolio(
      name.trim(),
      shortDesc.trim(),
      riskLevel,
      capitalInPln,
      autoPilotEnabled,
      telegramEnabled,
      allowedMarkets.length > 0 ? allowedMarkets : ['GPW', 'Surowce', 'NewConnect', 'FW20']
    );

    onPortfolioCreated(newPort);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          title="Zamknij okno tworzenia portfela"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Utwórz Nowy Portfel Strategii</h3>
            <p className="text-xs text-slate-400">Zdefiniuj kapitał początkowy w {currCode}, profil ryzyka i rynki dla Auto-Pilota</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Nazwa Portfela *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Portfel Wzrostowy Surowce & GPW 2026"
              title="Wprowadź unikalną nazwę tworzonego portfela"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Krótki Opis Strategii</label>
            <input
              type="text"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="np. Alokacja w surowce i spółki dywidendowe z wysokim wskaźnikiem Konsensusu"
              title="Opcjonalny opis zasad strategii portfela"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Profil Ryzyka</label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as any)}
                title="Wybierz docelowy profil ryzyka strategii"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Niskie">Niskie (Defensywne)</option>
                <option value="Umiarkowane">Umiarkowane (Growth)</option>
                <option value="Wysokie">Wysokie (Agresywne)</option>
                <option value="Arbitraż">Arbitraż (Market Neutral)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Kapitał Początkowy ({currCode}) *</label>
              <input
                type="number"
                step="100"
                min="250"
                required
                value={initialCapital}
                onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                title={`Kwota startowa portfela w ${currCode}`}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Market Checkboxes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-medium">
                Dopuszczalne Rynki dla Auto-Pilota (Checkboxy):
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAllowedMarkets(['GPW', 'Surowce', 'NewConnect', 'FW20'])}
                  title="Zaznacz wszystkie dostępne segmenty rynku"
                  className="text-emerald-400 hover:underline cursor-pointer font-medium"
                >
                  Wszystkie
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setAllowedMarkets([])}
                  title="Odznacz wszystkie rynki"
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  Odznacz wszystkie
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              {MARKET_OPTIONS.map((opt) => {
                const isChecked = allowedMarkets.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    onClick={() => toggleMarket(opt.id)}
                    title={`Zezwól lub zablokuj handel w segmencie: ${opt.label} (${opt.sub})`}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-emerald-950/50 border-emerald-600/70 text-emerald-200 shadow-sm'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-[11px] truncate">{opt.icon} {opt.label}</span>
                      <span className="text-[9px] text-slate-400 truncate">{opt.sub}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <label className="flex items-center justify-between text-slate-300 cursor-pointer" title="Automatyczne otwieranie i zamykanie pozycji po osiągnięciu progu pewności">
              <span className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Włącz Auto-Pilot dla tego portfela (&gt;= 76%)</span>
              </span>
              <input
                type="checkbox"
                checked={autoPilotEnabled}
                onChange={(e) => setAutoPilotEnabled(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between text-slate-300 cursor-pointer" title="Wysyłanie natychmiastowych alertów o transakcjach do Telegrama">
              <span className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>Wysyłaj powiadomienia Telegram z tego portfela</span>
              </span>
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              title="Anuluj i zamknij okno"
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              title="Utwórz portfel i zapisz go na serwerze"
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              Utwórz Portfel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
