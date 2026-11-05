import React, { useState } from 'react';
import { PortfolioStrategy } from '../types/stock';
import { PortfolioService } from '../services/portfolioService';
import { PlusCircle, X, CheckCircle2, AlertCircle, Layers, Zap, Send } from 'lucide-react';

interface CreatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPortfolioCreated: (newPortfolio: PortfolioStrategy) => void;
}

export const CreatePortfolioModal: React.FC<CreatePortfolioModalProps> = ({
  isOpen,
  onClose,
  onPortfolioCreated
}) => {
  const [name, setName] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [riskLevel, setRiskLevel] = useState<'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż'>('Umiarkowane');
  const [initialCapital, setInitialCapital] = useState<number>(50000);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState<boolean>(true);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Wprowadź nazwę nowego portfela.');
      return;
    }

    if (initialCapital <= 0) {
      setError('Kapitał początkowy musi być większy od zera.');
      return;
    }

    const newPort = PortfolioService.createPortfolio(
      name.trim(),
      shortDesc.trim(),
      riskLevel,
      initialCapital,
      autoPilotEnabled,
      telegramEnabled
    );

    onPortfolioCreated(newPort);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Utwórz Nowy Portfel Strategii GPW</h3>
            <p className="text-xs text-slate-400">Zdefiniuj kapitał początkowy w PLN, profil ryzyka i reguły egzekucji</p>
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
              placeholder="np. Portfel Wzrostowy NewConnect 2026"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Krótki Opis Strategii</label>
            <input
              type="text"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="np. Agresywna alokacja w małe innowacyjne spółki z wysokim momentum"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Profil Ryzyka</label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Niskie">Niskie (Defensywne)</option>
                <option value="Umiarkowane">Umiarkowane (Growth)</option>
                <option value="Wysokie">Wysokie (Agresywne)</option>
                <option value="Arbitraż">Arbitraż (Market Neutral)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Kapitał Początkowy (PLN) *</label>
              <input
                type="number"
                step="500"
                min="1000"
                required
                value={initialCapital}
                onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <label className="flex items-center justify-between text-slate-300 cursor-pointer">
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

            <label className="flex items-center justify-between text-slate-300 cursor-pointer">
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
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
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
