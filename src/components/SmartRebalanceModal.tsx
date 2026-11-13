import React, { useState } from 'react';
import { PortfolioStrategy, StockQuote, AppCurrency } from '../types/stock';
import { PortfolioService } from '../services/portfolioService';
import { SettingsService } from '../services/settingsService';
import { RefreshCw, X, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react';

interface SmartRebalanceModalProps {
  portfolio: PortfolioStrategy | null;
  stockQuotes: StockQuote[];
  isOpen: boolean;
  onClose: () => void;
  onRebalanceComplete: (updatedPortfolio: PortfolioStrategy) => void;
  currency?: AppCurrency;
  usdPlnRate?: number;
}

export const SmartRebalanceModal: React.FC<SmartRebalanceModalProps> = ({
  portfolio,
  stockQuotes,
  isOpen,
  onClose,
  onRebalanceComplete,
  currency = 'PLN',
  usdPlnRate = 3.97
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !portfolio) return null;

  const fmtMoney = (val: number, decimals: number = 2) =>
    SettingsService.formatMoney(val, currency, usdPlnRate, decimals);
  const fmtSignedMoney = (val: number, decimals: number = 2) =>
    SettingsService.formatSignedMoney(val, currency, usdPlnRate, decimals);

  // Identify weak positions (PnL < 0 or low trend score < 52)
  const weakPositions = portfolio.activePositions.filter(pos => {
    const stock = stockQuotes.find(s => s.symbol === pos.ticker || s.cleanSymbol === pos.ticker);
    return pos.pnlPercent < -2 || (stock && (stock.trendScore || 50) < 52);
  });

  // Identify top buy candidates matching portfolio market filter
  const candidateStocks = stockQuotes.filter(stock => {
    const alreadyHolds = portfolio.activePositions.some(p => p.ticker === stock.symbol || p.ticker === stock.cleanSymbol);
    if (alreadyHolds) return false;
    if (!PortfolioService.isStockMarketAllowed(portfolio, stock.market)) return false;
    return (stock.trendScore && stock.trendScore >= 78) || stock.analystRecommendation === 'KUPUJ (BUY)';
  }).sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0)).slice(0, 3);

  const handleExecuteRebalance = () => {
    setIsProcessing(true);
    setSuccessMsg(null);

    setTimeout(() => {
      // 1. Close weak positions
      weakPositions.forEach(pos => {
        PortfolioService.closePosition(portfolio.id, pos.id);
      });

      // 2. Buy top candidate stocks
      const refreshedPortfolio = PortfolioService.getPortfolio(portfolio.id);
      if (refreshedPortfolio) {
        candidateStocks.forEach(stock => {
          PortfolioService.executeAutoPilotSignal(stock, stock.trendScore || 82, stock.price, portfolio.id, undefined, 'LONG');
        });
      }

      // 3. Trigger balance rebalancing
      const result = PortfolioService.triggerSmartRebalance(portfolio.id);
      const finalPort = PortfolioService.getPortfolio(portfolio.id);

      setIsProcessing(false);
      if (finalPort) {
        setSuccessMsg(result.message);
        onRebalanceComplete(finalPort);
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          title="Zamknij okno Smart Rebalance"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Smart Rebalance Algorytmiczny</h3>
            <p className="text-xs text-slate-400">Optymalizacja wag portfela "{portfolio.name}", obcięcie strat i reinwestycja kapitału</p>
          </div>
        </div>

        {successMsg ? (
          <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Smart Rebalance Wykonany Pomyślnie!</span>
            </div>
            <p>{successMsg}</p>
            <button
              onClick={onClose}
              title="Zamknij podsumowanie rebalancingu"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
            {/* Status overview */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center font-mono">
              <div title="Aktualna całkowita wycena portfela">
                <span className="text-[10px] text-slate-400 block font-sans">Wycena Portfela:</span>
                <span className="text-white font-bold">{fmtMoney(portfolio.currentBalance, 0)}</span>
              </div>
              <div title="Liczba aktualnie otwartych pozycji">
                <span className="text-[10px] text-slate-400 block font-sans">Alokowane Pozycje:</span>
                <span className="text-amber-300 font-bold">{portfolio.activePositions.length} szt.</span>
              </div>
              <div title="Dostępna wolna gotówka">
                <span className="text-[10px] text-slate-400 block font-sans">Wolna Gotówka:</span>
                <span className="text-emerald-400 font-bold">{fmtMoney(portfolio.cashPln, 0)}</span>
              </div>
            </div>

            {/* Weak positions to cut */}
            <div>
              <h4 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Wykryte Pozycje do Zamknięcia / Redukcji ({weakPositions.length}):</span>
              </h4>
              {weakPositions.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[11px]">
                  ✓ Wszystkie aktywne pozycje zachowują wysoki optymizm konsensusu i dodatnią rentowność.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {weakPositions.map(pos => (
                    <div key={pos.id} className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-bold text-white">{pos.ticker}</span>
                        <span className="text-slate-400 ml-2">{pos.name} ({pos.shares} szt.)</span>
                      </div>
                      <span className="font-mono text-rose-400 font-bold">{pos.pnlPercent.toFixed(2)}% ({fmtSignedMoney(pos.pnlPln)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Buy Replacements */}
            <div>
              <h4 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rekomendowane Aktywa Zastępcze z Wyższym Konsensusem:</span>
              </h4>
              <div className="space-y-1.5">
                {candidateStocks.map(stock => (
                  <div key={stock.symbol} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400">{stock.symbol}</span>
                      <span className="text-slate-300">{stock.name}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400">{fmtMoney(stock.price)}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                        Konsensus: {stock.trendScore || 85}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteRebalance}
                title="Zamknij słabe pozycje, dokup liderów konsensusu i zoptymalizuj proporcje wag"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Przetwarzanie Rebalancingu...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Wykonaj Smart Rebalance (Algorytmiczne Przesunięcie Kapitału)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
