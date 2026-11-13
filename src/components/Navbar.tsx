import React from 'react';
import { UserAccount, FearGreedData, StockQuote, PortfolioStrategy, PositionItem, AutoPilotNotification } from '../types/stock';
import { MarketSessionInfo } from '../services/marketSessionService';
import { SettingsService } from '../services/settingsService';
import {
  ShieldCheck,
  User,
  LogOut,
  Key,
  BarChart3,
  TrendingUp,
  Layers,
  Sliders,
  Bell,
  CheckCheck,
  Bot,
  RefreshCw,
  Info,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
  PauseCircle,
  Calendar,
  Cloud
} from 'lucide-react';

import { BullBearLogo } from './BullBearLogo';
import { MarketOptimismTrendModal } from './MarketOptimismTrendModal';

interface NavbarProps {
  activeTab: 'portfolios' | 'audit' | 'consensus' | 'ranking' | 'admin';
  setActiveTab: (tab: 'portfolios' | 'audit' | 'consensus' | 'ranking' | 'admin') => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
  onChangePasswordClick: () => void;
  fearGreed: FearGreedData;
  isLiveUpdating: boolean;
  onRefreshQuotes: () => void;
  secondsUntilRefresh: number;
  onOpenInfoModal: () => void;
  onOpenSettingsModal: () => void;
  marketSessionInfo: MarketSessionInfo;
  stocks?: StockQuote[];
  portfolios?: PortfolioStrategy[];
  onSelectTicker?: (symbol: string) => void;
  notifications?: AutoPilotNotification[];
  onMarkNotificationsRead?: (ids?: string[]) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onChangePasswordClick,
  fearGreed,
  isLiveUpdating,
  onRefreshQuotes,
  secondsUntilRefresh,
  onOpenInfoModal,
  onOpenSettingsModal,
  marketSessionInfo,
  stocks = [],
  portfolios = [],
  onSelectTicker,
  notifications = [],
  onMarkNotificationsRead
}) => {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = React.useState(false);
  const [isOptimismModalOpen, setIsOptimismModalOpen] = React.useState(false);
  const unreadCount = React.useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const getFearColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40 hover:bg-emerald-900/60';
    if (score >= 55) return 'text-lime-400 bg-lime-950/60 border-lime-500/40 hover:bg-lime-900/60';
    if (score >= 45) return 'text-amber-400 bg-amber-950/60 border-amber-500/40 hover:bg-amber-900/60';
    if (score >= 25) return 'text-orange-400 bg-orange-950/60 border-orange-500/40 hover:bg-orange-900/60';
    return 'text-rose-400 bg-rose-950/60 border-rose-500/40 hover:bg-rose-900/60';
  };

  // Zbuduj zbiór notowań: Surowce (dynamicznie z realnych notowań) + Główne Indeksy GPW + Walory z portfeli
  const tickerItems = React.useMemo(() => {
    // 1. Surowce z bazy realnych notowań (WSE / COMEX / NYMEX)
    const findCommodity = (cleanSym: string, label: string) => {
      const match = stocks.find(s => 
        s.cleanSymbol.toUpperCase() === cleanSym.toUpperCase() || 
        s.symbol.toUpperCase().includes(cleanSym.toUpperCase())
      );
      if (match) {
        const usdRate = 3.91; // Oficjalny NBP
        const usdPrice = (match.price / usdRate).toFixed(2);
        return {
          rawSymbol: match.symbol,
          symbol: `${cleanSym} (${label})`,
          price: `$${usdPrice} (${match.price.toFixed(2)} zł)`,
          change: `${match.change >= 0 ? '+' : ''}${match.changePercent.toFixed(2)}%`,
          isUp: match.change >= 0
        };
      }
      return null;
    };

    const commodities = [
      findCommodity('XAU', 'Złoto'),
      findCommodity('XAG', 'Srebro'),
      findCommodity('BRENT', 'Ropa Brent') || findCommodity('CB', 'Ropa Brent'),
      findCommodity('CL', 'Ropa WTI') || findCommodity('WTI', 'Ropa WTI'),
      findCommodity('HG', 'Miedź') || findCommodity('COPPER', 'Miedź'),
      findCommodity('XPT', 'Platyna'),
      findCommodity('NG', 'Gaz') || findCommodity('NATGAS', 'Gaz'),
      findCommodity('W', 'Pszenica') || findCommodity('WHEAT', 'Pszenica')
    ].filter(Boolean) as { rawSymbol: string; symbol: string; price: string; change: string; isUp: boolean }[];

    // 2. Indeksy GPW
    const indices = [
      { rawSymbol: 'WIG20', symbol: 'WIG20', price: `${fearGreed.wig20Value.toFixed(2)} pkt`, change: `${fearGreed.wig20Change >= 0 ? '+' : ''}${fearGreed.wig20Change.toFixed(2)}%`, isUp: fearGreed.wig20Change >= 0 },
      { rawSymbol: 'FW20.PL', symbol: 'FW20 Futures', price: `${fearGreed.wig20Value.toFixed(2)} pkt`, change: `${fearGreed.wig20Change >= 0 ? '+' : ''}${fearGreed.wig20Change.toFixed(2)}%`, isUp: fearGreed.wig20Change >= 0 },
      { rawSymbol: 'PKN.PL', symbol: 'mWIG40', price: '6 180 pkt', change: '+1.14%', isUp: true },
      { rawSymbol: 'KGH.PL', symbol: 'sWIG80', price: '24 310 pkt', change: '+0.68%', isUp: true },
      { rawSymbol: 'PKO.PL', symbol: 'WIG-VIX', price: `${fearGreed.wigVix} pkt`, change: '-2.1%', isUp: false }
    ];

    // 3. Walory z portfeli inwestycyjnych (aktywne pozycje) lub baza akcji
    const portfolioTickers = new Set<string>();
    portfolios.forEach(p => {
      p.activePositions?.forEach((pos: PositionItem) => {
        portfolioTickers.add(pos.ticker.toUpperCase());
      });
    });

    const portfolioStockList: { rawSymbol: string; symbol: string; price: string; change: string; isUp: boolean }[] = [];
    stocks.forEach(s => {
      const symUpper = s.symbol.toUpperCase();
      const cleanUpper = s.cleanSymbol.toUpperCase();
      // Jeśli walor jest w którymś z portfeli lub jest jedną z czołowych spółek
      if (portfolioTickers.has(symUpper) || portfolioTickers.has(cleanUpper) || portfolioTickers.size === 0 || ['PKN', 'KGH', 'PKO', 'CCC', 'CAR', 'DNP', 'LPP', 'PZU'].includes(cleanUpper)) {
        portfolioStockList.push({
          rawSymbol: s.symbol,
          symbol: s.cleanSymbol,
          price: `${s.price.toFixed(2)} zł`,
          change: `${s.change >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`,
          isUp: s.change >= 0
        });
      }
    });

    return [...commodities, ...indices, ...portfolioStockList];
  }, [fearGreed, stocks, portfolios]);

  return (
    <>
      <MarketOptimismTrendModal
        isOpen={isOptimismModalOpen}
        onClose={() => setIsOptimismModalOpen(false)}
        currentOptimism={fearGreed.score}
      />
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl select-none">
        {/* Row 1: Session Status & Refresh (Left) + Market Optimism (Right) */}
        <div className="bg-slate-950 px-3 sm:px-6 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 gap-3">
          {/* Left: GPW Session Status + Stooq live indicator & manual refresh */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* GPW Session Status Indicator */}
            {marketSessionInfo.isOpen ? (
              <div
                title={`${marketSessionInfo.details} Auto-odświeżanie notowań w toku.`}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold select-none cursor-help"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Sesja GPW: Otwarta</span>
                {marketSessionInfo.timeRemainingStr && (
                  <span className="text-[10px] text-emerald-400 font-mono hidden sm:inline">
                    ({marketSessionInfo.timeRemainingStr})
                  </span>
                )}
              </div>
            ) : (
              <div
                title={`${marketSessionInfo.details} ${marketSessionInfo.nextSessionText}. Auto-odświeżanie wstrzymane (poza sesją). Dostępne odświeżanie ręczne.`}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 text-[11px] font-medium select-none cursor-help"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="font-semibold text-amber-300">{marketSessionInfo.statusLabel}</span>
                <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                  • {marketSessionInfo.nextSessionText}
                </span>
              </div>
            )}

            {/* Countdown & Live/Manual refresh button */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-xs">
              {marketSessionInfo.isOpen ? (
                <span
                  title="Czas pozostały do kolejnego automatycznego pobrania danych ze Stooq"
                  className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 cursor-help"
                >
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Auto: {secondsUntilRefresh}s</span>
                </span>
              ) : (
                <span
                  title="Poza sesją notowania są zamrożone. Użyj przycisku obok do odświeżenia ręcznego."
                  className="text-[11px] font-mono text-amber-300 flex items-center gap-1 cursor-help"
                >
                  <PauseCircle className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">Auto: Wstrzymane</span>
                  <span className="sm:hidden">Auto: Wył</span>
                </span>
              )}

              <button
                onClick={onRefreshQuotes}
                title="Wymuś natychmiastowe pobranie aktualnych kursów rynkowych GPW i NBP"
                className="flex items-center gap-1 pl-1.5 border-l border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLiveUpdating ? 'animate-spin text-emerald-400' : marketSessionInfo.isOpen ? 'text-slate-400' : 'text-sky-400'}`} />
                <span className="text-[11px] font-mono font-semibold">
                  {marketSessionInfo.isOpen ? 'GPW Live' : 'GPW (Ręczne)'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Market Optimism (Optymizm rynku %) with interactive trend chart */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOptimismModalOpen(true)}
              title="Wskaźnik: Optymizm Rynku GPW (0% = Skrajna panika, 100% = Skrajna euforia / hossa). Kliknij, aby zobaczyć 14-dniowy wykres trendu i korelacji z WIG-VIX!"
              className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${getFearColor(fearGreed.score)}`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Optymizm rynku:</span>
              <span className="font-mono font-bold text-sm">{fearGreed.score}%</span>
              <span className="hidden md:inline text-[11px] opacity-80">({fearGreed.label})</span>
              <span className="text-[10px] underline ml-1 hidden lg:inline font-normal">📊 Wykres</span>
            </button>
          </div>
        </div>

        {/* Row 2: Full-width continuously auto-scrolling Ticker Tape: "GPW i surowce" */}
        <div className="w-full bg-slate-950/95 border-b border-slate-800/80 py-1.5 px-2 overflow-hidden flex items-center relative text-xs">
          {/* Fixed Badge on the left */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-bold text-white shrink-0 z-10 shadow-md mr-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] tracking-wide text-emerald-400 uppercase font-mono">GPW i surowce:</span>
          </div>

          {/* Infinite Auto-Scrolling Marquee Tape */}
          <div className="overflow-hidden flex-1 relative mask-linear-fade">
            <div className="animate-marquee gap-6 items-center text-xs font-mono">
              {/* Loop 1 */}
              {tickerItems.map((item, idx) => (
                <button
                  key={`t1_${item.symbol}_${idx}`}
                  onClick={() => onSelectTicker && onSelectTicker(item.rawSymbol)}
                  title={`Kliknij, aby otworzyć notowania i analizę Konsensusu dla waloru: ${item.symbol}`}
                  className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded hover:bg-slate-800 hover:border hover:border-emerald-500/50 transition-all cursor-pointer group"
                >
                  <span className="text-slate-400 group-hover:text-emerald-300 font-medium">{item.symbol}:</span>
                  <span className="text-white font-semibold">{item.price}</span>
                  <span className={`font-bold ${item.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.change}
                  </span>
                </button>
              ))}

              {/* Loop 2 (for seamless continuous infinite marquee) */}
              {tickerItems.map((item, idx) => (
                <button
                  key={`t2_${item.symbol}_${idx}`}
                  onClick={() => onSelectTicker && onSelectTicker(item.rawSymbol)}
                  title={`Kliknij, aby otworzyć notowania i analizę Konsensusu dla waloru: ${item.symbol}`}
                  className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded hover:bg-slate-800 hover:border hover:border-emerald-500/50 transition-all cursor-pointer group"
                >
                  <span className="text-slate-400 group-hover:text-emerald-300 font-medium">{item.symbol}:</span>
                  <span className="text-white font-semibold">{item.price}</span>
                  <span className={`font-bold ${item.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.change}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main navigation header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* App Branding with Official Shield Logo */}
            <div
              className="flex items-center gap-3 cursor-pointer select-none group"
              onClick={() => setActiveTab('portfolios')}
              title="StockSignalPL - Przejdź do strony głównej portfeli"
            >
              <img
                src="/logo.png"
                alt="StockSignalPL"
                className="w-11 h-13 object-contain shrink-0 drop-shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-transform group-hover:scale-105"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tight select-none">
                    <span className="text-emerald-400">Stock</span>
                    <span className="text-yellow-400">Signal</span>
                    <span className="text-emerald-400">PL</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded shadow-sm shadow-emerald-950/40">
                    v2.4.5
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 tracking-wider">Silnik Sygnałów Giełdowych GPW, WIG20 & Surowce</p>
              </div>
            </div>

            {/* Navigation Tabs (5 Main Tabs in 1-2-3 Logical Sequence) */}
            <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('audit')}
              title="Etap 1: Zweryfikuj backtest i trafność historyczną 10 źródeł sygnałowych"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Etap 1: Audyt Trafności</span>
            </button>

            <button
              onClick={() => setActiveTab('consensus')}
              title="Etap 2: Konsensus w czasie rzeczywistym z 10 źródeł, poziomy Multi-TP i Auto-Pilot (>=76%)"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer relative ${
                activeTab === 'consensus'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Etap 2: Live Konsensus</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-2 right-1.5 animate-ping"></span>
            </button>

            <button
              onClick={() => setActiveTab('portfolios')}
              title="Etap 3: Zarządzaj 6 portfelami modelowymi (w tym Surowce & Safe Haven) i własnymi strategiami z Multi-TP"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'portfolios'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Etap 3: Portfele Strategii</span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              title="Ranking spółek GPW i zaawansowany kalkulator wielkości pozycji w PLN"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'ranking'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Ranking & Kalkulator</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              title="Panel zarządzania użytkownikami systemu i uprawnieniami kont"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Panel & Użytkownicy</span>
              {currentUser?.role === 'admin' && (
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded font-bold border border-amber-500/40">
                  ADMIN
                </span>
              )}
            </button>
          </nav>

          {/* User profile & actions with Bell notifications, "i" and "gear" buttons */}
          <div className="flex items-center gap-2">
            {/* Notification Center (Bell) */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifMenuOpen(!notifMenuOpen);
                  setUserMenuOpen(false);
                }}
                title="Centrum Powiadomień Auto-Pilota 24/7 — historia transakcji wykonanych w tle z dokładnym czasem"
                className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              >
                <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border border-slate-950 shadow">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 text-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="text-xs font-bold text-white">Powiadomienia Auto-Pilota 24/7</p>
                        <p className="text-[10px] text-slate-400">Czas transakcji na serwerze (Warszawa)</p>
                      </div>
                    </div>
                    {unreadCount > 0 && onMarkNotificationsRead && (
                      <button
                        onClick={() => onMarkNotificationsRead()}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Przeczytane</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/80">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Brak powiadomień o transakcjach w tle. Gdy silnik serwerowy 24/7 otworzy lub zamknie pozycję, pojawi się tutaj z dokładną datą transakcji.
                      </div>
                    ) : (
                      notifications.slice(0, 30).map((n) => {
                        const isBuy = n.type === 'BUY';
                        const isTp = n.type === 'SELL_TP';
                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.read && onMarkNotificationsRead) onMarkNotificationsRead([n.id]);
                            }}
                            className={`p-3 text-xs transition-colors cursor-pointer ${
                              n.read ? 'bg-slate-900/40 hover:bg-slate-800/40' : 'bg-slate-800/70 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {!n.read && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                                <span className="font-bold text-white">{n.title}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    isBuy
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                      : isTp
                                      ? 'bg-sky-950 text-sky-300 border-sky-700'
                                      : 'bg-rose-950 text-rose-300 border-rose-700'
                                  }`}
                                >
                                  {isBuy ? 'KUPNO' : isTp ? 'TP' : 'SL'}
                                </span>
                                {n.source === 'SERVER_DAEMON' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                                    W TLE 24/7
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-[11px] text-emerald-300 font-mono mb-1">
                              📅 Transakcja: {n.timestamp}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                              <span className="font-sans text-slate-400 truncate max-w-[170px]">{n.portfolioName}</span>
                              <span>
                                <b className="text-white">{n.ticker}</b> • {n.shares} szt. @ {Number(n.pricePln).toFixed(2)} zł
                              </span>
                            </div>

                            {n.resultPln !== undefined && (
                              <div className="text-right text-[11px] font-mono mt-0.5">
                                <span className={n.resultPln >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                  PnL: {n.resultPln >= 0 ? '+' : ''}{Number(n.resultPln).toLocaleString('pl-PL')} PLN
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Info Icon Button (i) */}
            <button
              onClick={onOpenInfoModal}
              title="Informacje o programie StockSignalPL, numer wersji (v2.4.5) oraz pełny Changelog"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4 text-sky-400" />
            </button>

            {/* Currency Switcher ($ USD / zł PLN) */}
            <button
              onClick={() => {
                const currentSettings = SettingsService.getSettings();
                const nextCurrency = currentSettings.currency === 'USD' ? 'PLN' : 'USD';
                SettingsService.saveSettings({ currency: nextCurrency });
                if (onOpenSettingsModal) onOpenSettingsModal();
              }}
              title="Przełącznik Waluty Wyświetlania: PLN (zł) / USD ($) po kursie NBP"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="text-yellow-400 font-extrabold">{SettingsService.getSettings().currency === 'USD' ? '$' : 'zł'}</span>
              <span>{SettingsService.getSettings().currency === 'USD' ? 'USD' : 'PLN'}</span>
            </button>

            {/* Settings Gear Button (zębatka) */}
            <button
              onClick={onOpenSettingsModal}
              title="Ustawienia: zmiana motywu (jasny, ciemny, ocean, forrest), waluta ($/zł), własne tło i czas odświeżania"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 text-sky-400" />
            </button>

            {/* User Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setNotifMenuOpen(false);
                  }}
                  title={`Zalogowany: ${currentUser.fullName || currentUser.username} (Rola: ${currentUser.role})`}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/25 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs uppercase">
                    {currentUser.username.substring(0, 2)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-slate-200 leading-tight">{currentUser.fullName || currentUser.username}</p>
                    <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">{currentUser.role}</p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-2 z-50 text-slate-200">
                    <div className="px-4 py-2 border-b border-slate-800">
                      <p className="text-xs font-semibold text-white">{currentUser.fullName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-rose-400 border border-rose-500/30">
                        Rola: {currentUser.role.toUpperCase()}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onChangePasswordClick();
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      <span>Zmień hasło konta</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenSettingsModal();
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-sky-400" />
                      <span>Ustawienia & Motywy</span>
                    </button>

                    <div className="border-t border-slate-800 my-1"></div>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Wyloguj się</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold ${
              activeTab === 'audit' ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Etap 1: Audyt</span>
          </button>
          <button
            onClick={() => setActiveTab('consensus')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold ${
              activeTab === 'consensus' ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Etap 2: Konsensus</span>
          </button>
          <button
            onClick={() => setActiveTab('portfolios')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold ${
              activeTab === 'portfolios' ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Etap 3: Portfele</span>
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold ${
              activeTab === 'ranking' ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Ranking</span>
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold ${
              activeTab === 'admin' ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>
      </div>
    </header>
    </>
  );
};
