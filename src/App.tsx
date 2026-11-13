import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserAccount,
  StockQuote,
  SignalSource,
  PortfolioStrategy,
  TradeRecord,
  TelegramSettings,
  FearGreedData,
  AppSettings,
  AppCurrency,
  AutoPilotNotification
} from './types/stock';
import { AuthService } from './services/authService';
import { StooqService } from './services/stooqService';
import { PortfolioService } from './services/portfolioService';
import { TelegramService } from './services/telegramService';
import { SettingsService } from './services/settingsService';
import { AudioService } from './services/audioService';
import { MarketSessionService, MarketSessionInfo } from './services/marketSessionService';
import { formatWarsawTime } from './utils/dateTime';
import { INITIAL_FEAR_GREED } from './data/initialData';

import { Navbar } from './components/Navbar';
import { AuthGuard } from './components/AuthGuard';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ProgramInfoModal } from './components/ProgramInfoModal';
import { SettingsModal } from './components/SettingsModal';
import { AutoPilotToast } from './components/AutoPilotToast';
import { TabPortfolios } from './components/TabPortfolios';
import { TabAudit } from './components/TabAudit';
import { TabConsensus } from './components/TabConsensus';
import { TabRankingCalculator } from './components/TabRankingCalculator';
import { TabAdminSettings } from './components/TabAdminSettings';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolios' | 'audit' | 'consensus' | 'ranking' | 'admin'>('portfolios');
  const [autoPilotNotifications, setAutoPilotNotifications] = useState<AutoPilotNotification[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<AutoPilotNotification[]>([]);

  // Data states
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioStrategy[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>(TelegramService.getSettings());
  const [appSettings, setAppSettings] = useState<AppSettings>(SettingsService.getSettings());
  const [fearGreed, setFearGreed] = useState<FearGreedData>(INITIAL_FEAR_GREED);

  // Refs for fresh closures inside background intervals
  const currentUserRef = useRef<UserAccount | null>(null);
  currentUserRef.current = currentUser;
  const hasInitialServerSyncRef = useRef<boolean>(false);
  const shownToastIdsRef = useRef<Set<string>>(new Set());

  // Custom analyst reports state managed across Admin & Audit
  const [customReports, setCustomReports] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('stocksignal_custom_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleReportsUpdate = (newReports: any[]) => {
    setCustomReports(newReports);
    try {
      localStorage.setItem('stocksignal_custom_reports', JSON.stringify(newReports));
    } catch {}
  };

  // Active selected stock symbol
  const [selectedSymbol, setSelectedSymbol] = useState<string>('PKN.PL');
  const selectedSymbolRef = useRef<string>(selectedSymbol);
  selectedSymbolRef.current = selectedSymbol;

  // Modals state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);

  // Countdown timer for next quotes refresh
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(appSettings.refreshIntervalSec || 4);

  // Initial local hydration
  useEffect(() => {
    AuthService.initialize();
    StooqService.initialize();
    PortfolioService.initialize();
    TelegramService.initialize();
    const loadedSettings = SettingsService.initialize();
    setAppSettings(loadedSettings);
    setSecondsUntilRefresh(loadedSettings.refreshIntervalSec || 4);

    const user = AuthService.getCurrentUser();
    setCurrentUser(user);
    setStocks(StooqService.getStocks());
    setSources(StooqService.getSources());
    setPortfolios(PortfolioService.getPortfolios());
    setTrades(PortfolioService.getTrades());
    setUsers(AuthService.getUsers());
  }, []);

  const syncWithServer = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const [serverPortfolios, serverTrades, serverNotifications] = await Promise.all([
        PortfolioService.fetchPortfoliosFromServer(userId),
        PortfolioService.fetchTradesFromServer(userId),
        PortfolioService.fetchNotificationsFromServer(userId)
      ]);

      if (serverPortfolios && serverPortfolios.length > 0) {
        setPortfolios([...serverPortfolios]);
      }
      if (serverTrades) {
        setTrades([...serverTrades]);
      }
      if (Array.isArray(serverNotifications)) {
        setNotificationHistory(serverNotifications);

        // Show unseen unread background notifications ONCE upon browser open / sync
        const unseen = serverNotifications.filter(
          n => !n.read && n.id && !shownToastIdsRef.current.has(n.id)
        );
        if (unseen.length > 0) {
          const deliveredAt = formatWarsawTime();
          unseen.forEach(n => shownToastIdsRef.current.add(n.id));
          try {
            localStorage.setItem(
              `stocksignalpl_seen_toasts_${userId}`,
              JSON.stringify(Array.from(shownToastIdsRef.current).slice(-250))
            );
          } catch {}

          const toastsWithDelivery = unseen.slice(0, 4).map(n => ({
            ...n,
            deliveredAt
          }));
          setAutoPilotNotifications(prev => [...toastsWithDelivery, ...prev].slice(0, 5));

          const newest = unseen[0];
          if (newest.type === 'BUY') AudioService.playBuyChime();
          else if (newest.type === 'SELL_TP') AudioService.playTpChime();
          else AudioService.playSlChime();
        }
      }
      hasInitialServerSyncRef.current = true;
    } catch {}
  }, []);

  const handleMarkNotificationsRead = useCallback(async (ids?: string[]) => {
    const userId = currentUserRef.current?.id;
    setNotificationHistory(prev =>
      prev.map(n => (!ids || ids.includes(n.id) ? { ...n, read: true } : n))
    );
    if (userId) {
      await PortfolioService.markNotificationsReadOnServer(userId, ids);
    }
  }, []);

  // GPW Warsaw Market Session status
  const [marketSession, setMarketSession] = useState<MarketSessionInfo>(() => {
    const status = MarketSessionService.getGpwStatus();
    if (appSettings.forceSessionOpenTest) {
      return {
        ...status,
        isOpen: true,
        statusLabel: 'GPW: Sesja Otwarta (Test)',
        details: 'Wymuszono tryb aktywnej sesji dla celów testowych.'
      };
    }
    return status;
  });

  const handleAutoTick = useCallback(async () => {
    setIsLiveUpdating(true);
    try {
      await StooqService.fetchRealMarketData();
      const freshStocks = [...StooqService.getStocks()];
      setStocks(freshStocks);

      const liveFx = StooqService.getUsdPlnRate();
      if (liveFx > 0) {
        setAppSettings(prev => (
          Math.abs((prev.usdPlnRate || 0) - liveFx) >= 0.0001
            ? { ...prev, usdPlnRate: Number(liveFx.toFixed(4)) }
            : prev
        ));
      }

      const userId = currentUserRef.current?.id;
      // Do NOT overwrite portfolios with stale localStorage before initial server sync finishes;
      // and NEVER run competing client-side Auto-Pilot buys/sells (ServerAutoPilotDaemon runs 24/7 on server).
      if (!userId || hasInitialServerSyncRef.current) {
        PortfolioService.updateLiveMarketPricesOnly(freshStocks);
        setPortfolios([...PortfolioService.getPortfolios()]);
      }

      if (userId && hasInitialServerSyncRef.current) {
        await syncWithServer(userId);
      }

      const wig20Stock = freshStocks.find(
        s =>
          s.symbol.toUpperCase().includes('WIG20') ||
          s.cleanSymbol.toUpperCase().includes('WIG20') ||
          s.cleanSymbol.toUpperCase().includes('FW20')
      );
      const advancing = freshStocks.filter(s => s.changePercent > 0).length;
      const declining = freshStocks.filter(s => s.changePercent < 0).length;
      const total = advancing + declining || 1;
      const realOptimism = Math.min(95, Math.max(15, Math.round((advancing / total) * 70 + 20)));

      const getSentimentLabel = (val: number): 'Ekstremalny strach' | 'Strach' | 'Neutralnie' | 'Chciwość' | 'Ekstremalna chciwość' => {
        if (val >= 75) return 'Ekstremalna chciwość';
        if (val >= 55) return 'Chciwość';
        if (val >= 45) return 'Neutralnie';
        if (val >= 25) return 'Strach';
        return 'Ekstremalny strach';
      };

      setFearGreed(prev => ({
        ...prev,
        wig20Value: wig20Stock ? wig20Stock.price : prev.wig20Value,
        wig20Change: wig20Stock ? wig20Stock.changePercent : prev.wig20Change,
        score: realOptimism,
        label: getSentimentLabel(realOptimism),
        updatedAt: formatWarsawTime()
      }));
    } finally {
      setTimeout(() => setIsLiveUpdating(false), 500);
    }
  }, [syncWithServer]);

  const handleAutoTickRef = useRef(handleAutoTick);
  handleAutoTickRef.current = handleAutoTick;

  // Transparent server fetch on login, visibility restore, and background synchronization
  useEffect(() => {
    if (!currentUser?.id) {
      hasInitialServerSyncRef.current = false;
      return;
    }

    hasInitialServerSyncRef.current = false;
    try {
      const savedSeen = localStorage.getItem(`stocksignalpl_seen_toasts_${currentUser.id}`);
      shownToastIdsRef.current = savedSeen ? new Set(JSON.parse(savedSeen)) : new Set();
    } catch {
      shownToastIdsRef.current = new Set();
    }

    // Sync daemon test-session toggle from server so UI reflects 24/7 daemon mode
    fetch('/api/admin/daemon-settings')
      .then(r => r.json())
      .then(data => {
        if (data?.success && typeof data.forceSessionOpenTest === 'boolean') {
          setAppSettings(prev => {
            if (prev.forceSessionOpenTest === data.forceSessionOpenTest) return prev;
            const next = { ...prev, forceSessionOpenTest: data.forceSessionOpenTest };
            try {
              localStorage.setItem('stocksignalpl_settings_v1_1', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      })
      .catch(() => {});

    // First sync authoritative server portfolios/trades/notifications, then layer fresh market prices
    syncWithServer(currentUser.id).then(() => {
      handleAutoTickRef.current();
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUserRef.current?.id) {
        syncWithServer(currentUserRef.current.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic background sync every 10 seconds to receive server daemon trades & notifications promptly
    const syncTimer = setInterval(() => {
      if (currentUserRef.current?.id) {
        syncWithServer(currentUserRef.current.id);
      }
    }, 10000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(syncTimer);
    };
  }, [currentUser?.id, syncWithServer]);

  // Initial fetch for unauthenticated view only; logged-in flow waits for initial server sync
  useEffect(() => {
    if (!AuthService.getCurrentUser()?.id) {
      handleAutoTickRef.current();
    }
  }, []);

  // Countdown and Auto-Refresh Timer (Aktywny podczas sesji GPW dla wszystkich walorów oraz 24/7 dla Surowców)
  useEffect(() => {
    const timer = setInterval(() => {
      let currentStatus = MarketSessionService.getGpwStatus();
      if (appSettings.forceSessionOpenTest) {
        currentStatus = {
          ...currentStatus,
          isOpen: true,
          statusLabel: 'GPW: Sesja Otwarta (Test)',
          details: 'Wymuszono tryb aktywnej sesji dla celów testowych.'
        };
      }
      setMarketSession(currentStatus);

      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          handleAutoTickRef.current();
          return appSettings.refreshIntervalSec || 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [appSettings.refreshIntervalSec, appSettings.forceSessionOpenTest]);

  const handleManualRefresh = async () => {
    setIsLiveUpdating(true);
    setSecondsUntilRefresh(appSettings.refreshIntervalSec || 4);
    try {
      if (selectedSymbolRef.current) {
        await StooqService.fetchStooqQuote(selectedSymbolRef.current);
      }
      await StooqService.fetchRealMarketData();
      const freshStocks = [...StooqService.getStocks()];
      setStocks(freshStocks);

      const liveFx = StooqService.getUsdPlnRate();
      if (liveFx > 0) {
        setAppSettings(prev => (
          Math.abs((prev.usdPlnRate || 0) - liveFx) >= 0.0001
            ? { ...prev, usdPlnRate: Number(liveFx.toFixed(4)) }
            : prev
        ));
      }

      const userId = currentUserRef.current?.id;
      if (userId) {
        // Trigger server daemon evaluation cycle with fresh prices and pull latest trades/notifications
        await fetch('/api/admin/daemon-run', { method: 'POST' }).catch(() => {});
        await syncWithServer(userId);
      }

      PortfolioService.updateLiveMarketPricesOnly(freshStocks);
      setPortfolios([...PortfolioService.getPortfolios()]);

      const wig20Stock = freshStocks.find(
        s =>
          s.symbol.toUpperCase().includes('WIG20') ||
          s.cleanSymbol.toUpperCase().includes('WIG20') ||
          s.cleanSymbol.toUpperCase().includes('FW20')
      );
      const advancing = freshStocks.filter(s => s.changePercent > 0).length;
      const declining = freshStocks.filter(s => s.changePercent < 0).length;
      const total = advancing + declining || 1;
      const realOptimism = Math.min(95, Math.max(15, Math.round((advancing / total) * 70 + 20)));

      const getSentimentLabel = (val: number): 'Ekstremalny strach' | 'Strach' | 'Neutralnie' | 'Chciwość' | 'Ekstremalna chciwość' => {
        if (val >= 75) return 'Ekstremalna chciwość';
        if (val >= 55) return 'Chciwość';
        if (val >= 45) return 'Neutralnie';
        if (val >= 25) return 'Strach';
        return 'Ekstremalny strach';
      };

      setFearGreed(prev => ({
        ...prev,
        wig20Value: wig20Stock ? wig20Stock.price : prev.wig20Value,
        wig20Change: wig20Stock ? wig20Stock.changePercent : prev.wig20Change,
        score: realOptimism,
        label: getSentimentLabel(realOptimism),
        updatedAt: formatWarsawTime()
      }));
    } finally {
      setTimeout(() => setIsLiveUpdating(false), 700);
    }
  };

  const handlePortfoliosUpdate = (newPortfolios: PortfolioStrategy[]) => {
    setPortfolios(newPortfolios);
    PortfolioService.setPortfolios(newPortfolios);
    if (currentUser?.id) {
      newPortfolios.forEach(p => {
        PortfolioService.syncPortfolioToServer(currentUser.id, p);
      });
    }
  };

  const handleTradesUpdate = (newTrades: TradeRecord[]) => {
    setTrades(newTrades);
    PortfolioService.setTrades(newTrades);
    if (currentUser?.id && newTrades.length > 0) {
      PortfolioService.syncTradeToServer(currentUser.id, newTrades[0]);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
  };

  const handleSwitchToConsensus = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('consensus');
  };

  const handleNavigateToCalculator = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('ranking');
  };

  const handleStockAdded = (newStock: StockQuote) => {
    setStocks([...StooqService.getStocks()]);
    setSelectedSymbol(newStock.symbol);
  };

  const handleUpdateAppSettings = (newSettings: AppSettings) => {
    const saved = SettingsService.saveSettings(newSettings);
    setAppSettings({ ...saved });
    setSecondsUntilRefresh(saved.refreshIntervalSec);
  };

  const handleToggleCurrency = () => {
    const nextCurrency: AppCurrency = appSettings.currency === 'USD' ? 'PLN' : 'USD';
    const saved = SettingsService.saveSettings({ currency: nextCurrency });
    setAppSettings({ ...saved });
  };

  const currency: AppCurrency = (appSettings.currency || 'PLN') as AppCurrency;
  const usdPlnRate: number = appSettings.usdPlnRate || StooqService.getUsdPlnRate() || 3.97;

  return (
    <AuthGuard currentUser={currentUser} onLoginSuccess={(u) => setCurrentUser(u)}>
      <div
        className="min-h-screen flex flex-col font-sans selection:bg-rose-600 selection:text-white relative transition-colors duration-300"
        style={{
          backgroundColor: 'var(--color-bg-base)',
          color: 'var(--color-text-main)',
          backgroundImage: appSettings.customBgUrl ? `url("${appSettings.customBgUrl}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          filter: undefined
        }}
      >
        {/* Configurable background overlay: controls darkness/opacity and blur */}
        {appSettings.customBgUrl && (
          <div
            className="absolute inset-0 pointer-events-none z-0 transition-all duration-300"
            style={{
              backgroundColor: `rgba(2, 6, 23, ${(100 - (appSettings.bgOpacity ?? 80)) / 100})`,
              backdropFilter: appSettings.bgBlur ? `blur(${appSettings.bgBlur}px)` : undefined,
              WebkitBackdropFilter: appSettings.bgBlur ? `blur(${appSettings.bgBlur}px)` : undefined
            }}
          ></div>
        )}

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Navigation Bar */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            onLogout={handleLogout}
            onChangePasswordClick={() => setIsPasswordModalOpen(true)}
            fearGreed={fearGreed}
            isLiveUpdating={isLiveUpdating}
            onRefreshQuotes={handleManualRefresh}
            secondsUntilRefresh={secondsUntilRefresh}
            onOpenInfoModal={() => setIsInfoModalOpen(true)}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            marketSessionInfo={marketSession}
            stocks={stocks}
            portfolios={portfolios}
            onSelectTicker={(sym) => handleSwitchToConsensus(sym)}
            notifications={notificationHistory}
            onMarkNotificationsRead={handleMarkNotificationsRead}
            currency={currency}
            usdPlnRate={usdPlnRate}
            onToggleCurrency={handleToggleCurrency}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {activeTab === 'portfolios' && (
              <TabPortfolios
                portfolios={portfolios}
                onPortfoliosUpdate={handlePortfoliosUpdate}
                trades={trades}
                onTradesUpdate={handleTradesUpdate}
                stocks={stocks}
                currency={currency}
                usdPlnRate={usdPlnRate}
              />
            )}

            {activeTab === 'audit' && (
              <TabAudit
                sources={sources}
                onSourcesUpdate={setSources}
                onSwitchToConsensus={() => setActiveTab('consensus')}
                customReports={customReports}
                currency={currency}
                usdPlnRate={usdPlnRate}
              />
            )}

            {activeTab === 'consensus' && (
              <TabConsensus
                stocks={stocks}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                portfolios={portfolios}
                onPortfoliosUpdate={handlePortfoliosUpdate}
                trades={trades}
                onTradesUpdate={handleTradesUpdate}
                onNavigateToCalculator={handleNavigateToCalculator}
                onSwitchToPortfolios={() => setActiveTab('portfolios')}
                onStockAdded={handleStockAdded}
                currency={currency}
                usdPlnRate={usdPlnRate}
              />
            )}

            {activeTab === 'ranking' && (
              <TabRankingCalculator
                stocks={stocks}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                onSwitchToConsensus={handleSwitchToConsensus}
                portfolios={portfolios}
                onPortfoliosUpdate={handlePortfoliosUpdate}
                onStockAdded={handleStockAdded}
                currency={currency}
                usdPlnRate={usdPlnRate}
              />
            )}

            {activeTab === 'admin' && (
              <TabAdminSettings
                currentUser={currentUser}
                users={users}
                onUsersUpdate={setUsers}
                telegramSettings={telegramSettings}
                onTelegramSettingsUpdate={setTelegramSettings}
                customReports={customReports}
                onReportsUpdate={handleReportsUpdate}
              />
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-900 bg-slate-950/85 py-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p>
                StockSignalPl v2.4.5 • Polski Rynek Giełdowy (GPW Warszawa: WIG20, mWIG40, sWIG80, NewConnect, FW20).
              </p>
              <p className="font-mono text-[11px] text-slate-400" title="Aktywna waluta prezentacji, oficjalny kurs NBP oraz interwał odświeżania">
                Waluta: {currency === 'USD' ? `USD ($ • 1$ = ${usdPlnRate.toFixed(2)} zł)` : `PLN (zł • 1$ = ${usdPlnRate.toFixed(2)} zł)`} • Benchmark: WIG20 • Odświeżanie: {appSettings.refreshIntervalSec}s
              </p>
            </div>
          </footer>
        </div>

        {/* Floating Auto-Pilot Toast Notifications */}
        <AutoPilotToast
          notifications={autoPilotNotifications}
          onDismiss={(id) => setAutoPilotNotifications(prev => prev.filter(n => n.id !== id))}
          currency={currency}
          usdPlnRate={usdPlnRate}
        />

        {/* Modals */}
        {currentUser && (
          <ChangePasswordModal
            username={currentUser.username}
            isOpen={isPasswordModalOpen}
            onClose={() => setIsPasswordModalOpen(false)}
          />
        )}

        <ProgramInfoModal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          appSettings={appSettings}
          onUpdateAppSettings={handleUpdateAppSettings}
          telegramSettings={telegramSettings}
          onUpdateTelegramSettings={setTelegramSettings}
        />
      </div>
    </AuthGuard>
  );
}
