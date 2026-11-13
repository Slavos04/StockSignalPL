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
          title="Zamknij dziennik audytowy Auto-Pilota"
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
        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl mb-3 text-xs flex-wrap">
          <span className="text-slate-400 font-medium flex items-center gap-1.5" title="Filtruj wpisy dziennika według rodzaju decyzji bota">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtruj Akcje Bota:</span>
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'Wszystkie', tip: 'Pokaż wszystkie akcje zapisane przez Auto-Pilota' },
              { id: 'KUPNO_LONG', label: 'KUPNO_LONG', tip: 'Zlecenia zakupu (gra na wzrosty)' },
              { id: 'KUPNO_SHORT', label: 'KUPNO_SHORT', tip: 'Zlecenia krótkiej sprzedaży (gra na spadki)' },
              { id: 'SPRZEDAŻ_TP', label: 'SPRZEDAŻ_TP', tip: 'Realizacje zysków na poziomach Take Profit (TP1/TP2/TP3)' },
              { id: 'SPRZEDAŻ_SL', label: 'SPRZEDAŻ_SL', tip: 'Zamknięcia ochronne na poziomie Stop Loss' },
              { id: 'AUTO_CUT', label: 'AUTO_CUT', tip: 'Automatyczne ucięcie pozycji po spadku konsensusu <45%' },
              { id: 'POMINIĘTO', label: 'POMINIĘTO', tip: 'Zdarzenia wstrzymane przez blokadę ryzyka lub limit pozycji' }
            ].map(act => (
              <button
                key={act.id}
                onClick={() => setFilterAction(act.id)}
                title={act.tip}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  filterAction === act.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>

        {/* Log items */}
        <div className="overflow-y-auto space-y-2 pr-1 flex-1 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <Bot className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>Brak zapisanych logów w dzienniku audytowym dla wybranego filtra w tym portfelu.</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isBuy = log.action === 'KUPNO_LONG' || log.action === 'KUPNO_SHORT';
              const isTp = log.action === 'SPRZEDAŻ_TP';
              const isCutOrSl = log.action === 'AUTO_CUT' || log.action === 'SPRZEDAŻ_SL';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${
                    isBuy
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                      : isTp
                      ? 'bg-sky-950/30 border-sky-800/50 text-sky-200'
                      : isCutOrSl
                      ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] flex-wrap gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        title="Dokładna data i godzina decyzji Auto-Pilota (CET/CEST)"
                        className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-slate-300"
                      >
                        📅 {log.timestamp}
                      </span>
                      <span className="font-bold text-white text-xs">{log.ticker}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBuy ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60' :
                          isTp ? 'bg-sky-900/60 text-sky-300 border border-sky-700/60' :
                          isCutOrSl ? 'bg-rose-900/60 text-rose-300 border border-rose-700/60' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    {log.confidence > 0 && (
                      <span className="text-slate-400 font-sans" title="Poziom konsensusu rynkowego w momencie decyzji">
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
            title="Zamknij okno dziennika audytowego"
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer"
          >
            Zamknij Dziennik
          </button>
        </div>
      </div>
    </div>
  );
};
