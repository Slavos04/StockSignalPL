import React, { useState } from 'react';
import { PortfolioStrategy, AutoPilotLogItem } from '../types/stock';
import { Bot, X, Filter, ShieldAlert, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AutoPilotLogsModalProps {
  portfolio: PortfolioStrategy | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AutoPilotLogsModal: React.FC<AutoPilotLogsModalProps> = ({ portfolio, isOpen, onClose }) => {
  const [filterAction, setFilterAction] = useState<string>('ALL');

  if (!isOpen || !portfolio) return null;

  const logs: AutoPilotLogItem[] = portfolio.autoPilotLogs || [];
  const filteredLogs = logs.filter(log => {
    if (filterAction === 'ALL') return true;
    return log.action === filterAction;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Dziennik Audytowy Auto-Pilota</h3>
            <p className="text-xs text-slate-400">Rejestr decyzji bota z dokładną datą i godziną transakcji (czas warszawski CET/CEST)</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl mb-3 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtruj Akcje Bota:</span>
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {['ALL', 'KUPNO_LONG', 'KUPNO_SHORT', 'AUTO_CUT', 'POMINIĘTO'].map(act => (
              <button
                key={act}
                onClick={() => setFilterAction(act)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  filterAction === act
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {act === 'ALL' ? 'Wszystkie' : act}
              </button>
            ))}
          </div>
        </div>

        {/* Log items */}
        <div className="overflow-y-auto space-y-2 pr-1 flex-1 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <Bot className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>Brak zapisanych logów w dzienniku audytowym dla tego portfela.</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isBuy = log.action === 'KUPNO_LONG' || log.action === 'KUPNO_SHORT';
              const isCut = log.action === 'AUTO_CUT';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${
                    isBuy
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                      : isCut
                      ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] flex-wrap gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-slate-300">
                        📅 {log.timestamp}
                      </span>
                      <span className="font-bold text-white text-xs">{log.ticker}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBuy ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60' :
                          isCut ? 'bg-rose-900/60 text-rose-300 border border-rose-700/60' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    {log.confidence > 0 && (
                      <span className="text-slate-400 font-sans">
                        Konsensus: <b className="text-emerald-400 font-mono">{log.confidence}%</b>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 pl-1">{log.reason}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 mt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer"
          >
            Zamknij Dziennik
          </button>
        </div>
      </div>
    </div>
  );
};
