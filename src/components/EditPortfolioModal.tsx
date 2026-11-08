import React, { useState, useEffect } from 'react';
import { PortfolioStrategy, MarketSegment } from '../types/stock';
import { PortfolioService } from '../services/portfolioService';
import {
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  Layers,
  Zap,
  Send,
  PlusCircle,
  RotateCcw,
  Trash2,
  Shield,
  Cpu,
  TrendingUp,
  Sliders,
  HelpCircle
} from 'lucide-react';

interface EditPortfolioModalProps {
  portfolio: PortfolioStrategy | null;
  isOpen: boolean;
  onClose: () => void;
  onPortfolioUpdated: (updatedPortfolio: PortfolioStrategy) => void;
}

const MARKET_OPTIONS: { id: MarketSegment; label: string; sub: string; icon: string }[] = [
  { id: 'GPW', label: 'Akcje GPW', sub: 'WIG20, mWIG40, sWIG80', icon: '📈' },
  { id: 'Surowce', label: 'Surowce i Towary', sub: 'Złoto, Ropa, Srebro, Miedź, Gaz', icon: '🛢️' },
  { id: 'NewConnect', label: 'NewConnect', sub: 'Spółki Wzrostowe NC', icon: '🚀' },
  { id: 'FW20', label: 'Kontrakty FW20', sub: 'Futures & Arbitraż', icon: '⚡' },
];

export const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({
  portfolio,
  isOpen,
  onClose,
  onPortfolioUpdated
}) => {
  // 1. Podstawowe
  const [name, setName] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [riskLevel, setRiskLevel] = useState<'Niskie' | 'Umiarkowane' | 'Wysokie' | 'Arbitraż'>('Umiarkowane');
  const [allowedMarkets, setAllowedMarkets] = useState<MarketSegment[]>(['GPW', 'Surowce', 'NewConnect', 'FW20']);
  const [addCashPln, setAddCashPln] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // 2. Silnik Operacyjny i Sposób Realizacji Zleceń
  const [orderExecutionType, setOrderExecutionType] = useState<'MARKET' | 'LIMIT_ZONE'>('MARKET');
  const [positionSizingModel, setPositionSizingModel] = useState<'FIXED_PERCENT' | 'KELLY' | 'VOLATILITY_ATR'>('FIXED_PERCENT');
  const [stopLossTrailingMode, setStopLossTrailingMode] = useState<'BREAK_EVEN_TP1' | 'TRAILING_ATR' | 'SWING_LOW'>('BREAK_EVEN_TP1');
  const [categoryAllocationLimit, setCategoryAllocationLimit] = useState<number>(40);

  // 3. Ochrona Kapitału i Progi Bezpieczeństwa
  const [drawdownLockCap, setDrawdownLockCap] = useState<number>(-15);
  const [autoCutWeakConsensus, setAutoCutWeakConsensus] = useState<boolean>(true);
  const [allowPyramiding, setAllowPyramiding] = useState<boolean>(false);

  // 4. Zasady i Progi Auto-Pilota
  const [autoPilotEnabled, setAutoPilotEnabled] = useState<boolean>(true);
  const [autoPilotMinConfidence, setAutoPilotMinConfidence] = useState<number>(75);
  const [autoPilotMinRiskReward, setAutoPilotMinRiskReward] = useState<number>(2.2);
  const [autoPilotMaxPositions, setAutoPilotMaxPositions] = useState<number>(4);
  const [autoPilotAllocationPercent, setAutoPilotAllocationPercent] = useState<number>(10);

  // 5. Podział Zysków Multi-TP i Alerty
  const [multiTpBreakEvenEnabled, setMultiTpBreakEvenEnabled] = useState<boolean>(true);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(true);

  // 6. Śledzenie Waloru Wiodącego (Benchmark Leader Tracking & Lag)
  const [anchorLeaderTracking, setAnchorLeaderTracking] = useState<boolean>(false);
  const [anchorLeaderTicker, setAnchorLeaderTicker] = useState<string>('WIG20');
  const [anchorLeaderTrendMode, setAnchorLeaderTrendMode] = useState<'STRICT_SAME_DIRECTION' | 'MOMENTUM_CONFIRMATION' | 'CONTRARIAN_HEDGE'>('STRICT_SAME_DIRECTION');
  const [anchorLeaderCorrelation, setAnchorLeaderCorrelation] = useState<number>(75);
  const [anchorLeaderLagMinutes, setAnchorLeaderLagMinutes] = useState<number>(15);

  useEffect(() => {
    if (portfolio) {
      setName(portfolio.name);
      setShortDesc(portfolio.shortDesc || '');
      setRiskLevel(portfolio.riskLevel);
      if (portfolio.allowedMarkets && portfolio.allowedMarkets.length > 0) {
        setAllowedMarkets(portfolio.allowedMarkets);
      } else if (portfolio.allowedMarket && portfolio.allowedMarket !== 'ALL') {
        setAllowedMarkets([portfolio.allowedMarket as MarketSegment]);
      } else {
        setAllowedMarkets(['GPW', 'Surowce', 'NewConnect', 'FW20']);
      }

      setOrderExecutionType(portfolio.orderExecutionType || 'MARKET');
      setPositionSizingModel(portfolio.positionSizingModel || 'FIXED_PERCENT');
      setStopLossTrailingMode(portfolio.stopLossTrailingMode || 'BREAK_EVEN_TP1');
      setCategoryAllocationLimit(portfolio.categoryAllocationLimit ?? 40);

      setDrawdownLockCap(portfolio.drawdownLockCap ?? -15);
      setAutoCutWeakConsensus(portfolio.autoCutWeakConsensus !== false);
      setAllowPyramiding(Boolean(portfolio.allowPyramiding));

      setAutoPilotEnabled(portfolio.autoPilotEnabled !== false);
      setAutoPilotMinConfidence(portfolio.autoPilotMinConfidence ?? 75);
      setAutoPilotMinRiskReward(portfolio.autoPilotMinRiskReward ?? 2.2);
      setAutoPilotMaxPositions(portfolio.autoPilotMaxPositions ?? 4);
      setAutoPilotAllocationPercent(portfolio.autoPilotAllocationPercent ?? 10);

      setMultiTpBreakEvenEnabled(portfolio.multiTpBreakEvenEnabled !== false);
      setTelegramEnabled(portfolio.telegramEnabled !== false);

      setAnchorLeaderTracking(Boolean(portfolio.anchorLeaderTracking));
      setAnchorLeaderTicker(portfolio.anchorLeaderTicker || 'WIG20');
      setAnchorLeaderTrendMode(portfolio.anchorLeaderTrendMode || 'STRICT_SAME_DIRECTION');
      setAnchorLeaderCorrelation(portfolio.anchorLeaderCorrelation ?? 75);
      setAnchorLeaderLagMinutes(portfolio.anchorLeaderLagMinutes ?? 15);

      setAddCashPln(0);
      setError(null);
    }
  }, [portfolio]);

  if (!isOpen || !portfolio) return null;

  const toggleMarket = (marketId: MarketSegment) => {
    if (allowedMarkets.includes(marketId)) {
      setAllowedMarkets(allowedMarkets.filter(m => m !== marketId));
    } else {
      setAllowedMarkets([...allowedMarkets, marketId]);
    }
  };

  const handleReset = () => {
    if (window.confirm(`Czy na pewno chcesz zresetować portfel "${portfolio.name}" do kapitału początkowego ${portfolio.initialCapital.toLocaleString('pl-PL')} PLN? Otwarte pozycje zostaną usunięte.`)) {
      const res = PortfolioService.resetPortfolio(portfolio.id);
      if (res.success && res.portfolio) {
        onPortfolioUpdated(res.portfolio);
        onClose();
      }
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Czy na pewno chcesz BEZPOWROTNIE usunąć portfel "${portfolio.name}"?`)) {
      const res = PortfolioService.deletePortfolio(portfolio.id);
      if (res.success) {
        const remaining = PortfolioService.getPortfolios();
        if (remaining.length > 0) {
          onPortfolioUpdated(remaining[0]);
        }
        onClose();
      } else {
        setError(res.message);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Wprowadź nazwę portfela.');
      return;
    }

    const res = PortfolioService.updatePortfolioStrategy(portfolio.id, {
      name: name.trim(),
      shortDesc: shortDesc.trim(),
      riskLevel,
      allowedMarkets: allowedMarkets.length > 0 ? allowedMarkets : ['GPW', 'Surowce', 'NewConnect', 'FW20'],
      allowedMarket: allowedMarkets.length === 4 ? 'ALL' : (allowedMarkets[0] as any || 'ALL'),

      orderExecutionType,
      positionSizingModel,
      stopLossTrailingMode,
      categoryAllocationLimit,

      drawdownLockCap,
      autoCutWeakConsensus,
      allowPyramiding,

      autoPilotEnabled,
      autoPilotMinConfidence,
      autoPilotMinRiskReward,
      autoPilotMaxPositions,
      autoPilotAllocationPercent,

      multiTpBreakEvenEnabled,
      telegramEnabled,

      anchorLeaderTracking,
      anchorLeaderTicker,
      anchorLeaderTrendMode,
      anchorLeaderCorrelation,
      anchorLeaderLagMinutes,

      addCashPln: addCashPln > 0 ? addCashPln : undefined
    });

    if (res.success && res.portfolio) {
      onPortfolioUpdated(res.portfolio);
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Zamknij Modal */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Nagłówek Modala */}
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Konfiguracja Strategii & Silnika Portfela</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                {portfolio.name}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Pełny zestaw mechanizmów algorytmicznych, ochrony kapitału, śledzenia lidera i reguł Auto-Pilota
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1.5 text-xs flex-1 custom-scrollbar">
          
          {/* SEKCJA 1: Podstawowe Parametry & Dopuszczalne Rynki */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nazwa Portfela</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Profil Ryzyka Strategii</label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  <option value="Niskie">Niskie (Defensywne)</option>
                  <option value="Umiarkowane">Umiarkowane (Growth)</option>
                  <option value="Wysokie">Wysokie (Agresywne)</option>
                  <option value="Arbitraż">Arbitraż (Market Neutral)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Opis Strategii / Reguły</label>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="np. Portfel skoncentrowany na spółkach dywidendowych i surowcach z wysoką alfą..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Checkboxy Rynków */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold">
                  Dopuszczalne Rynki dla Auto-Pilota:
                </label>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAllowedMarkets(['GPW', 'Surowce', 'NewConnect', 'FW20'])}
                    className="text-cyan-400 hover:underline cursor-pointer font-medium"
                  >
                    Zaznacz wszystkie
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setAllowedMarkets([])}
                    className="text-slate-400 hover:underline cursor-pointer"
                  >
                    Odznacz
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MARKET_OPTIONS.map((opt) => {
                  const isChecked = allowedMarkets.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      onClick={() => toggleMarket(opt.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-cyan-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0"
                      />
                      <div className="truncate">
                        <span className="font-semibold text-[11px] block truncate">{opt.icon} {opt.label}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SEKCJA 2: Silnik Operacyjny i Sposób Realizacji Zleceń */}
          <div className="p-3.5 bg-slate-950/80 border border-cyan-900/50 rounded-xl space-y-3">
            <h4 className="font-bold text-cyan-400 flex items-center gap-2 text-xs">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>2. Silnik Operacyjny i Sposób Realizacji Zleceń</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1 flex items-center gap-1">
                  <span>Typ Egzekucji Zleceń</span>
                  <span title="Market: wejście po aktualnym kursie; Limit: polowanie na optymalną strefę cenową">
                    <HelpCircle className="w-3 h-3 text-slate-500" />
                  </span>
                </label>
                <select
                  value={orderExecutionType}
                  onChange={(e) => setOrderExecutionType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  <option value="MARKET">⚡ Market (Natychmiastowe wejście)</option>
                  <option value="LIMIT_ZONE">🎯 Limit Entry Zone (Strefa Wsparcia)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1 flex items-center gap-1">
                  <span>Model Wielkości Pozycji</span>
                  <span title="Stały % kapitału, formuła Kelly'ego lub zmienność ATR 14">
                    <HelpCircle className="w-3 h-3 text-slate-500" />
                  </span>
                </label>
                <select
                  value={positionSizingModel}
                  onChange={(e) => setPositionSizingModel(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  <option value="FIXED_PERCENT">📊 Stały Procent Wolnej Gotówki</option>
                  <option value="KELLY">🧮 Kelly Criterion (Optymalizacja zysku)</option>
                  <option value="VOLATILITY_ATR">📉 ATR Volatility Sizing (Zmienność)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1 flex items-center gap-1">
                  <span>Prowadzenie Zlecenia Stop Loss</span>
                  <span title="Po osiągnięciu TP1 zlecenie SL chroni zysk lub podąża krokowo za kursem">
                    <HelpCircle className="w-3 h-3 text-slate-500" />
                  </span>
                </label>
                <select
                  value={stopLossTrailingMode}
                  onChange={(e) => setStopLossTrailingMode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  <option value="BREAK_EVEN_TP1">🛡️ Break-Even po osiągnięciu TP1</option>
                  <option value="TRAILING_ATR">📈 Krokowy Trailing ATR (0.8x ATR)</option>
                  <option value="SWING_LOW">🧱 Podążanie za podłogą Swing Low</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium flex items-center gap-1">
                    <span>Limit Alokacji per Kategoria</span>
                    <span title="Maksymalny udział pojedynczego sektora lub typu aktywów w portfelu">
                      <HelpCircle className="w-3 h-3 text-slate-500" />
                    </span>
                  </label>
                  <span className="font-mono font-bold text-cyan-400">{categoryAllocationLimit}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={categoryAllocationLimit}
                  onChange={(e) => setCategoryAllocationLimit(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SEKCJA 3: Ochrona Kapitału i Progi Bezpieczeństwa */}
          <div className="p-3.5 bg-slate-950/80 border border-amber-900/40 rounded-xl space-y-3">
            <h4 className="font-bold text-amber-400 flex items-center gap-2 text-xs">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>3. Ochrona Kapitału i Progi Bezpieczeństwa</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium flex items-center gap-1">
                    <span>Limit Max Osuwiska (Drawdown Lock)</span>
                    <span title="Blokada otwierania nowych pozycji w przypadku spadku wartości portfela poniżej progu">
                      <HelpCircle className="w-3 h-3 text-slate-500" />
                    </span>
                  </label>
                  <span className="font-mono font-bold text-amber-400">{drawdownLockCap}%</span>
                </div>
                <input
                  type="range"
                  min="-35"
                  max="-5"
                  step="1"
                  value={drawdownLockCap}
                  onChange={(e) => setDrawdownLockCap(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>-5% (Super bezpiecznie)</span>
                  <span>-35% (Szeroka tolerancja)</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCutWeakConsensus}
                    onChange={(e) => setAutoCutWeakConsensus(e.target.checked)}
                    className="accent-amber-500 w-4 h-4 rounded cursor-pointer mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-200 block text-xs">Auto-Cięcie Stratnych Pozycji</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Zamykaj pozycje gdy pewność sygnału spadnie &lt; 45%</span>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPyramiding}
                    onChange={(e) => setAllowPyramiding(e.target.checked)}
                    className="accent-amber-500 w-4 h-4 rounded cursor-pointer mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-200 block text-xs">Zezwól na Piramidowanie (Scaling-In)</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Dokupuj kolejne partie po osiągnięciu TP1</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SEKCJA 4: Zasady i Progi Auto-Pilota */}
          <div className="p-3.5 bg-slate-950/80 border border-emerald-900/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-xs">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>4. Zasady i Progi Auto-Pilota</span>
              </h4>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 cursor-pointer">
                <span>Auto-Pilot Aktywny:</span>
                <input
                  type="checkbox"
                  checked={autoPilotEnabled}
                  onChange={(e) => setAutoPilotEnabled(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Min. Pewność Sygnału</label>
                  <span className="font-mono font-bold text-emerald-400">{autoPilotMinConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="90"
                  step="1"
                  value={autoPilotMinConfidence}
                  onChange={(e) => setAutoPilotMinConfidence(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Min. Stosunek Zysk/Ryzyko</label>
                  <span className="font-mono font-bold text-emerald-400">{autoPilotMinRiskReward.toFixed(1)}:1</span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="4.0"
                  step="0.1"
                  value={autoPilotMinRiskReward}
                  onChange={(e) => setAutoPilotMinRiskReward(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Max Pozycji Jednocześnie</label>
                  <span className="font-mono font-bold text-cyan-400">{autoPilotMaxPositions}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={autoPilotMaxPositions}
                  onChange={(e) => setAutoPilotMaxPositions(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Alokacja na 1 Pozycję (% Gotówki)</label>
                  <span className="font-mono font-bold text-cyan-400">{autoPilotAllocationPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="40"
                  step="1"
                  value={autoPilotAllocationPercent}
                  onChange={(e) => setAutoPilotAllocationPercent(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SEKCJA 5: Podział Zysków Multi-TP i Alerty */}
          <div className="p-3.5 bg-slate-950/80 border border-teal-900/40 rounded-xl space-y-2.5">
            <h4 className="font-bold text-teal-400 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>5. Podział Zysków Multi-TP i Alerty</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-start gap-2 p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiTpBreakEvenEnabled}
                  onChange={(e) => setMultiTpBreakEvenEnabled(e.target.checked)}
                  className="accent-teal-500 w-4 h-4 rounded cursor-pointer mt-0.5 shrink-0"
                />
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Tryb Multi-Take-Profit (33/33/34%) + SL Break-Even</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Realizuj zysk częściowo na TP1 (33%) i natychmiast przestawiaj zlecenia na Break-Even.</span>
                </div>
              </label>

              <label className="flex items-start gap-2 p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="accent-teal-500 w-4 h-4 rounded cursor-pointer mt-0.5 shrink-0"
                />
                <div>
                  <span className="font-semibold text-slate-200 block text-xs">Alerty Telegram Bot API</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Wysyłaj natychmiastowe powiadomienia o zleceniach Auto-Pilota i TP/SL.</span>
                </div>
              </label>
            </div>
          </div>

          {/* SEKCJA 6: Śledzenie Waloru Wiodącego (Benchmark Leader Tracking & Lag) */}
          <div className="p-3.5 bg-slate-950/80 border border-indigo-900/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-indigo-400 flex items-center gap-2 text-xs">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>6. Śledzenie Waloru Wiodącego (Benchmark Leader Tracking & Lag)</span>
              </h4>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 cursor-pointer">
                <span>Śledzenie Aktywne:</span>
                <input
                  type="checkbox"
                  checked={anchorLeaderTracking}
                  onChange={(e) => setAnchorLeaderTracking(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Walor Wiodący (Anchor Leader)</label>
                <select
                  value={anchorLeaderTicker}
                  onChange={(e) => setAnchorLeaderTicker(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="WIG20">WIG20 - Główny Indeks GPW (Benchmark)</option>
                  <option value="FW2020.PL">FW2020.PL - Kontrakt Futures FW20 (Pęd)</option>
                  <option value="CB.F">CB.F - Ropa Naftowa Brent (Makro)</option>
                  <option value="XAUUSD">XAUUSD - Złoto Spot (Safe Haven)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Tryb Filtracji Trendu Lidera</label>
                <select
                  value={anchorLeaderTrendMode}
                  onChange={(e) => setAnchorLeaderTrendMode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="STRICT_SAME_DIRECTION">🎯 Ścisła Zgodność Kierunku (Same Direction)</option>
                  <option value="MOMENTUM_CONFIRMATION">📈 Potwierdzenie Pędu 24h (Momentum)</option>
                  <option value="CONTRARIAN_HEDGE">🛡️ Zabezpieczenie Kontrariańskie (Hedge)</option>
                </select>
              </div>

              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Procentowa Czułość Korelacji</label>
                  <span className="font-mono font-bold text-amber-400">{anchorLeaderCorrelation}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={anchorLeaderCorrelation}
                  onChange={(e) => setAnchorLeaderCorrelation(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>50% (Słaba korelacja)</span>
                  <span>95% (Ścisły wymóg)</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Opóźnienie Weryfikacji (Lag)</label>
                  <span className="font-mono font-bold text-indigo-400">{anchorLeaderLagMinutes} min</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="240"
                  step="15"
                  value={anchorLeaderLagMinutes}
                  onChange={(e) => setAnchorLeaderLagMinutes(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>0 min (Reakcja instant)</span>
                  <span>4 godziny (Potwierdzony trend)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SEKCJA 7: Zasilenie Gotówką & Akcje Administracyjne */}
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-emerald-300 font-semibold flex items-center gap-1.5 text-xs">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zasilanie Portfela (Dopłata Gotówki PLN):</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Wolna gotówka: <strong className="text-white">{portfolio.cashPln.toLocaleString('pl-PL')} PLN</strong>
              </span>
            </div>
            <input
              type="number"
              min="0"
              step="500"
              value={addCashPln}
              onChange={(e) => setAddCashPln(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0 (wpisz kwotę dopłaty w PLN)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Reset i Usuwanie Portfela */}
          <div className="flex gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-semibold cursor-pointer flex items-center justify-center gap-1.5 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Resetuj Portfel</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-semibold cursor-pointer flex items-center justify-center gap-1.5 text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Usuń Portfel</span>
            </button>
          </div>

          {/* Przyciski Akcji */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-slate-900/95 py-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer text-xs transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold transition-all shadow-md shadow-cyan-950/40 cursor-pointer text-xs"
            >
              Zapisz Zmiany Strategii
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
