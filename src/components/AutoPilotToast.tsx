import React, { useEffect } from 'react';
import { AutoPilotNotification } from '../types/stock';
import { Bot, CheckCircle2, AlertTriangle, TrendingUp, X } from 'lucide-react';

interface AutoPilotToastProps {
  notifications: AutoPilotNotification[];
  onDismiss: (id: string) => void;
}

export const AutoPilotToast: React.FC<AutoPilotToastProps> = ({ notifications, onDismiss }) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none select-none">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ notification: AutoPilotNotification; onDismiss: (id: string) => void }> = ({
  notification,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 10000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const isBuy = notification.type === 'BUY';
  const isTp = notification.type === 'SELL_TP';
  const isServerDaemon = notification.source === 'SERVER_DAEMON';

  return (
    <div className="pointer-events-auto bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-slide-in relative overflow-hidden text-xs">
      {/* Top Accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isBuy ? 'bg-emerald-500' : isTp ? 'bg-sky-500' : 'bg-rose-500'
        }`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold border shadow-sm ${
              isBuy
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                : isTp
                ? 'bg-sky-950/80 text-sky-400 border-sky-500/50'
                : 'bg-rose-950/80 text-rose-400 border-rose-500/50'
            }`}
          >
            <Bot className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-white text-sm">{notification.title}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isBuy
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : isTp
                    ? 'bg-sky-950 text-sky-300 border-sky-700'
                    : 'bg-rose-950 text-rose-300 border-rose-700'
                }`}
              >
                {isBuy ? 'KUPNO GPW' : isTp ? 'ZYSK (TP)' : 'STOP LOSS'}
              </span>
              {isServerDaemon && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-600/50">
                  SERWER 24/7 (W TLE)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 font-medium">
              📅 Transakcja: <span className="font-mono text-emerald-300">{notification.timestamp}</span>
            </p>
            <p className="text-[10px] text-slate-400">
              {notification.portfolioName}
              {notification.deliveredAt ? ` • Odebrano w przeglądarce: ${notification.deliveredAt}` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => onDismiss(notification.id)}
          className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-slate-200 font-mono text-[11px] space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-sans text-slate-400">Walor / Wolumen:</span>
          <span className="font-bold text-white">{notification.ticker} ({notification.shares} szt.)</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-sans text-slate-400">Kurs / Wartość:</span>
          <span className="font-bold text-slate-200">{notification.pricePln.toFixed(2)} zł ({notification.totalPln.toLocaleString('pl-PL')} PLN)</span>
        </div>
        {notification.resultPln !== undefined && (
          <div className="flex justify-between items-center pt-1 border-t border-slate-800/60 font-sans">
            <span className="text-slate-400">Wynik PnL:</span>
            <span className={`font-bold font-mono ${notification.resultPln >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {notification.resultPln >= 0 ? '+' : ''}{notification.resultPln.toLocaleString('pl-PL')} PLN
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
