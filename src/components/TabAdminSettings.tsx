import React, { useState, useMemo } from 'react';
import { UserAccount, TelegramSettings, AnalystReportItem } from '../types/stock';
import { AuthService } from '../services/authService';
import { TelegramService } from '../services/telegramService';
import { StooqService } from '../services/stooqService';
import { INITIAL_ANALYST_REPORTS } from '../data/initialData';
import {
  Users,
  Send,
  Key,
  Trash2,
  Ban,
  CheckCircle,
  Plus,
  Shield,
  Sliders,
  AlertCircle,
  ArrowUpDown,
  HelpCircle,
  Bot,
  RotateCcw,
  X,
  Info,
  Rss,
  Globe
} from 'lucide-react';

interface TabAdminSettingsProps {
  currentUser: UserAccount | null;
  users: UserAccount[];
  onUsersUpdate: (users: UserAccount[]) => void;
  telegramSettings: TelegramSettings;
  onTelegramSettingsUpdate: (settings: TelegramSettings) => void;
  customReports: AnalystReportItem[];
  onReportsUpdate: (reports: AnalystReportItem[]) => void;
}

export const TabAdminSettings: React.FC<TabAdminSettingsProps> = ({
  currentUser,
  users,
  onUsersUpdate,
  telegramSettings,
  onTelegramSettingsUpdate,
  customReports,
  onReportsUpdate
}) => {
  // User editing states
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'trader' | 'viewer'>('trader');

  // Manual recommendation feed management states (Tylko Administrator)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'single' | 'bulk'>('bulk');
  const [isFetchingApi, setIsFetchingApi] = useState(false);
  const [isFetchingHistorical, setIsFetchingHistorical] = useState(false);

  // Server AutoPilot Daemon interval state (Tylko Administrator)
  const [daemonIntervalMs, setDaemonIntervalMs] = useState<number>(15000);
  const [isSavingDaemonInterval, setIsSavingDaemonInterval] = useState<boolean>(false);
  const [isTriggeringDaemon, setIsTriggeringDaemon] = useState<boolean>(false);
  const [daemonMessage, setDaemonMessage] = useState<string | null>(null);
  const [daemonSummary, setDaemonSummary] = useState<string>('Silnik gotowy');
  const [monitoredCount, setMonitoredCount] = useState<number>(0);
  const [daemonForceSession, setDaemonForceSession] = useState<boolean>(false);

  // Fetch daemon status on load and periodically
  React.useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/admin/daemon-settings')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            if (data.intervalMs) setDaemonIntervalMs(data.intervalMs);
            if (data.lastExecutionSummary) setDaemonSummary(data.lastExecutionSummary);
            if (data.monitoredPortfoliosCount !== undefined) setMonitoredCount(data.monitoredPortfoliosCount);
            if (data.forceSessionOpenTest !== undefined) setDaemonForceSession(data.forceSessionOpenTest);
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateDaemonInterval = async (newMs: number) => {
    setIsSavingDaemonInterval(true);
    setDaemonIntervalMs(newMs);
    try {
      const res = await fetch('/api/admin/daemon-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: newMs })
      });
      const data = await res.json();
      if (data.success) {
        setDaemonMessage(data.message || 'Pomyślnie zaktualizowano interwał silnika serwera.');
        if (data.lastExecutionSummary) setDaemonSummary(data.lastExecutionSummary);
        if (data.monitoredPortfoliosCount !== undefined) setMonitoredCount(data.monitoredPortfoliosCount);
        setTimeout(() => setDaemonMessage(null), 4000);
      }
    } catch {
      setDaemonMessage('Błąd podczas zapisywania interwału silnika serwera.');
      setTimeout(() => setDaemonMessage(null), 4000);
    } finally {
      setIsSavingDaemonInterval(false);
    }
  };

  const handleToggleForceSession = async () => {
    const nextVal = !daemonForceSession;
    setDaemonForceSession(nextVal);
    try {
      const res = await fetch('/api/admin/daemon-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSessionOpenTest: nextVal })
      });
      const data = await res.json();
      if (data.success) {
        setDaemonMessage(`Zmieniono tryb testu sesji na: ${nextVal ? 'Wymuszony 24/7' : 'Standardowy (kalendarz GPW)'}`);
        setTimeout(() => setDaemonMessage(null), 4000);
      }
    } catch {
      setDaemonMessage('Błąd zmiany trybu sesji demona.');
      setTimeout(() => setDaemonMessage(null), 4000);
    }
  };

  const handleTriggerDaemonNow = async () => {
    setIsTriggeringDaemon(true);
    try {
      const res = await fetch('/api/admin/daemon-run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.lastExecutionSummary) setDaemonSummary(data.lastExecutionSummary);
        if (data.monitoredPortfoliosCount !== undefined) setMonitoredCount(data.monitoredPortfoliosCount);
        setDaemonMessage('Wykonano natychmiastowy cykl silnika Auto-Pilota na serwerze.');
      } else {
        setDaemonMessage(data.error || 'Nie udało się uruchomić cyklu silnika.');
      }
      setTimeout(() => setDaemonMessage(null), 4000);
    } catch {
      setDaemonMessage('Błąd połączenia z demonem serwerowym.');
      setTimeout(() => setDaemonMessage(null), 4000);
    } finally {
      setIsTriggeringDaemon(false);
    }
  };

  // Single report form state
  const [newBroker, setNewBroker] = useState('Telegram: GPW Signals');
  const [newTicker, setNewTicker] = useState('CDR.PL');
  const [newCompanyName, setNewCompanyName] = useState('CD Projekt S.A.');
  const [newRating, setNewRating] = useState<'KUPUJ' | 'AKUMULUJ' | 'TRZYMAJ' | 'REDUKUJ' | 'SPRZEDAJ'>('KUPUJ');
  const [newPriceAtReport, setNewPriceAtReport] = useState<number>(165.00);
  const [newTargetPrice, setNewTargetPrice] = useState<number>(210.00);
  const [newReportTitle, setNewReportTitle] = useState('Sygnał z grupy Telegram: Wzrost pod nową grę');
  const [newSummary, setNewSummary] = useState('Analiza techniczna i sentyment społeczności oparty o wyłamanie z oporu.');

  // Bulk import states
  const [bulkSource, setBulkSource] = useState('Telegram: GPW Institutional Feed');
  const [bulkText, setBulkText] = useState(
    `PKN KUPUJ Cena: 140.60 Target: 180.00
KGH KUPUJ Cena: 288.50 Target: 340.00
CDR KUPUJ Cena: 165.00 Target: 210.00
ALE KUPUJ Cena: 34.50 Target: 45.00
PKO KUPUJ Cena: 62.00 Target: 75.00
LPP KUPUJ Cena: 27340.00 Target: 32000.00
XTB KUPUJ Cena: 78.00 Target: 98.00
XAU KUPUJ Cena: 16133.00 Target: 18500.00`
  );

  const handleAutoFetchFromApi = async () => {
    setIsFetchingApi(true);
    try {
      const allExisting = [...customReports, ...INITIAL_ANALYST_REPORTS];
      const existingKeys = allExisting.map(r => `${r.broker.toUpperCase().trim()}_${r.ticker.toUpperCase().trim()}_${r.date}`).join(',');
      const res = await fetch(`/api/auto-fetch-recommendations?existingKeys=${encodeURIComponent(existingKeys)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.reports) && data.reports.length > 0) {
        const stocks = StooqService.getStocks();
        const freshWithPrices = data.reports.map((rep: any) => {
          const match = stocks.find(s => s.symbol.toLowerCase() === rep.ticker.toLowerCase() || s.cleanSymbol.toLowerCase() === rep.ticker.replace('.PL', '').toLowerCase());
          const currentPrice = match ? match.price : rep.priceAtReport;
          const returnPct = Number((((currentPrice - rep.priceAtReport) / rep.priceAtReport) * 100).toFixed(2));
          const status = currentPrice >= rep.targetPrice ? 'TARGET OSIĄGNIĘTY' : (returnPct >= 0 ? 'ZYSK W TRAKCIE' : 'STRATA (SL)');
          return {
            ...rep,
            currentPrice,
            returnPct,
            status
          };
        });

        const updated = [...freshWithPrices, ...customReports];
        onReportsUpdate(updated);

        setToastMessage(`Pobrano ${freshWithPrices.length} nowych unikalnych rekomendacji! Widoczne w Audycie dla wszystkich.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage('Wszystkie pobrane rekomendacje znajdują się już w bazie (brak nowych duplikatów).');
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (e: any) {
      setErrorMessage('Błąd pobierania automatycznego feedu API: ' + e.message);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsFetchingApi(false);
    }
  };

  const handleFetchHistorical30Days = async () => {
    setIsFetchingHistorical(true);
    try {
      const allExisting = [...customReports, ...INITIAL_ANALYST_REPORTS];
      const existingKeys = allExisting.map(r => `${r.broker.toUpperCase().trim()}_${r.ticker.toUpperCase().trim()}_${r.date}`).join(',');
      const res = await fetch(`/api/fetch-historical-recommendations?existingKeys=${encodeURIComponent(existingKeys)}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.reports) && data.reports.length > 0) {
        const stocks = StooqService.getStocks();
        const freshWithPrices = data.reports.map((rep: any) => {
          const match = stocks.find(s => s.symbol.toLowerCase() === rep.ticker.toLowerCase() || s.cleanSymbol.toLowerCase() === rep.ticker.replace('.PL', '').toLowerCase());
          const currentPrice = match ? match.price : rep.priceAtReport;
          const returnPct = Number((((currentPrice - rep.priceAtReport) / rep.priceAtReport) * 100).toFixed(2));
          const status = currentPrice >= rep.targetPrice ? 'TARGET OSIĄGNIĘTY' : (returnPct >= 0 ? 'ZYSK W TRAKCIE' : 'STRATA (SL)');
          return {
            ...rep,
            currentPrice,
            returnPct,
            status
          };
        });

        const updated = [...freshWithPrices, ...customReports];
        onReportsUpdate(updated);

        setToastMessage(`Jednorazowo zaimportowano ${freshWithPrices.length} rekomendacji z ostatnich 30 dni!`);
        setTimeout(() => setToastMessage(null), 4500);
      } else {
        setToastMessage('Rekomendacje z ostatnich 30 dni są już w pełni zaimportowane w aplikacji.');
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (e: any) {
      setErrorMessage('Błąd pobierania danych z ostatnich 30 dni: ' + e.message);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsFetchingHistorical(false);
    }
  };

  const handleAddCustomReport = (e: React.FormEvent) => {
    e.preventDefault();
    const stocks = StooqService.getStocks();
    const match = stocks.find(s => s.symbol.toLowerCase() === newTicker.toLowerCase() || s.cleanSymbol.toLowerCase() === newTicker.replace('.PL', '').toLowerCase());
    const currentPrice = match ? match.price : newPriceAtReport;

    const created: AnalystReportItem = {
      id: `rep_usr_${Date.now()}`,
      broker: newBroker.trim() || 'Zewnętrzny Analityk',
      date: new Date().toISOString().split('T')[0],
      ticker: newTicker.trim().toUpperCase(),
      companyName: newCompanyName.trim() || newTicker.trim().toUpperCase(),
      rating: newRating,
      priceAtReport: Number(newPriceAtReport),
      targetPrice: Number(newTargetPrice),
      currentPrice,
      returnPct: Number((((currentPrice - newPriceAtReport) / newPriceAtReport) * 100).toFixed(2)),
      status: currentPrice >= newTargetPrice ? 'TARGET OSIĄGNIĘTY' : (currentPrice >= newPriceAtReport ? 'ZYSK W TRAKCIE' : 'STRATA (SL)'),
      reportTitle: newReportTitle.trim() || 'Importowana Rekomendacja Zewnętrzna',
      summary: newSummary.trim() || 'Rekomendacja dodana przez Administratora.'
    };

    const updated = [created, ...customReports];
    onReportsUpdate(updated);

    setIsAddModalOpen(false);
    setToastMessage(`Dodano nową rekomendację ${created.broker} dla ${created.ticker}! Widoczna dla wszystkich użytkowników.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleBulkImport = (e: React.FormEvent) => {
    e.preventDefault();
    const stocks = StooqService.getStocks();
    const lines = bulkText.split('\n').filter(l => l.trim().length > 0);
    const newItems: AnalystReportItem[] = [];

    lines.forEach((line, idx) => {
      const tickerMatch = line.match(/\b([A-Z0-9]{2,6}(\.PL)?)\b/i);
      const numbers = line.match(/\b\d+([.,]\d+)?\b/g);

      if (tickerMatch && numbers && numbers.length >= 1) {
        const rawSymbol = tickerMatch[1].toUpperCase().replace('.PL', '');
        const fullSymbol = rawSymbol + '.PL';
        const parsedNums = numbers.map(n => parseFloat(n.replace(',', '.')));
        const priceAtReport = parsedNums[0];
        const targetPrice = parsedNums[1] || Number((priceAtReport * 1.25).toFixed(2));

        const match = stocks.find(s => s.symbol.toUpperCase().includes(rawSymbol) || s.cleanSymbol.toUpperCase() === rawSymbol);
        const currentPrice = match ? match.price : priceAtReport;
        const returnPct = Number((((currentPrice - priceAtReport) / priceAtReport) * 100).toFixed(2));
        const status = currentPrice >= targetPrice ? 'TARGET OSIĄGNIĘTY' : (returnPct >= 0 ? 'ZYSK W TRAKCIE' : 'STRATA (SL)');

        newItems.push({
          id: `rep_usr_bulk_${Date.now()}_${idx}`,
          broker: bulkSource.trim() || 'Kanał Telegram/Discord',
          date: new Date().toISOString().split('T')[0],
          ticker: fullSymbol,
          companyName: match ? match.name : rawSymbol,
          rating: line.toLowerCase().includes('sell') || line.toLowerCase().includes('sprzedaj') ? 'SPRZEDAJ' : 'KUPUJ',
          priceAtReport: Number(priceAtReport.toFixed(2)),
          targetPrice: Number(targetPrice.toFixed(2)),
          currentPrice,
          returnPct,
          status: status as any,
          reportTitle: `Masowa Rekomendacja z ${bulkSource}`,
          summary: `Przetworzono z wiersza feedu: "${line.trim().slice(0, 70)}"`
        });
      }
    });

    if (newItems.length === 0) {
      setErrorMessage('Nie wykryto poprawnych wierszy z symbolami i cenami w podanym tekście.');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const updated = [...newItems, ...customReports];
    onReportsUpdate(updated);

    setIsAddModalOpen(false);
    setToastMessage(`Zaimportowano masowo ${newItems.length} rekomendacji dla wszystkich inwestorów!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sorting state for Users table
  const [userSortField, setUserSortField] = useState<'username' | 'email' | 'fullName' | 'role' | 'status' | 'lastLogin'>('username');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const handleBlockToggle = (u: UserAccount) => {
    if (u.username === 'admin') {
      setErrorMessage('Nie można zablokować głównego administratora.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const updated: UserAccount = {
      ...u,
      status: u.status === 'active' ? 'blocked' : 'active'
    };
    AuthService.updateUserByAdmin(updated);
    onUsersUpdate([...AuthService.getUsers()]);
    setToastMessage(`Status użytkownika ${u.username} zmieniony na: ${updated.status === 'active' ? 'Aktywny' : 'Zablokowany'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResetPassword = (u: UserAccount) => {
    const newPass = 'StockGPW2026!';
    AuthService.resetUserPasswordByAdmin(u.username, newPass);
    setToastMessage(`Hasło użytkownika ${u.username} zresetowane do: ${newPass}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDeleteUser = (u: UserAccount) => {
    if (u.username === 'admin') {
      setErrorMessage('Nie można usunąć głównego konta administratora.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (window.confirm(`Czy na pewno chcesz bezpowrotnie usunąć konto użytkownika "${u.username}"?`)) {
      AuthService.deleteAccount(u.id);
      onUsersUpdate([...AuthService.getUsers()]);
      setToastMessage(`Konto "${u.username}" zostało pomyślnie usunięte.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    AuthService.updateUserByAdmin(editingUser);
    onUsersUpdate([...AuthService.getUsers()]);
    setEditingUser(null);
    setToastMessage(`Dane użytkownika ${editingUser.username} zostały zaktualizowane.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setErrorMessage('Wypełnij wszystkie wymagane pola.');
      return;
    }
    const res = AuthService.register(newUsername, newEmail, newFullName, newPassword);
    if (res.success && res.user) {
      if (newRole !== 'trader') {
        res.user.role = newRole;
        AuthService.updateUserByAdmin(res.user);
      }
      onUsersUpdate([...AuthService.getUsers()]);
      setShowAddUserModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setToastMessage(`Pomyślnie utworzono nowe konto: ${newUsername}`);
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setErrorMessage(res.error || 'Błąd tworzenia konta.');
    }
  };

  const toggleUserSort = (field: typeof userSortField) => {
    if (userSortField === field) {
      setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortField(field);
      setUserSortOrder('asc');
    }
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let valA = a[userSortField] || '';
      let valB = b[userSortField] || '';
      if (userSortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [users, userSortField, userSortOrder]);

  return (
    <div className="space-y-6">
      {/* Toast and Error notifications */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/60 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-rose-500/60 text-rose-300 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Admin Panel: User Accounts Management (Sticky First Column + Header Sorting) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black text-white">Panel Administratora: Zarządzanie Użytkownikami</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pierwsza kolumna (Login) jest zablokowana podczas przewijania. Kliknij nagłówek, aby posortować listę kont.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddUserModal(true)}
              title="Utwórz nowe konto użytkownika dla analityka lub tradera"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dodaj Nowego Inwestora</span>
            </button>
          )}
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold select-none">
                {/* Sticky Column 1: Użytkownik / Login */}
                <th
                  onClick={() => toggleUserSort('username')}
                  className="pb-3 sticky left-0 z-20 bg-slate-900 px-3 cursor-pointer hover:text-white min-w-[150px]"
                  title="Kliknij, aby posortować po loginie"
                >
                  <div className="flex items-center gap-1">
                    <span>Użytkownik / Login</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleUserSort('email')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po e-mailu"
                >
                  <div className="flex items-center gap-1">
                    <span>Adres E-mail</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleUserSort('fullName')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po nazwisku"
                >
                  <div className="flex items-center gap-1">
                    <span>Imię i Nazwisko</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleUserSort('role')}
                  className="pb-3 px-3 text-center cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po roli"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Rola</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleUserSort('status')}
                  className="pb-3 px-3 text-center cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po statusie"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleUserSort('lastLogin')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po dacie ostatniego logowania"
                >
                  <div className="flex items-center gap-1">
                    <span>Ostatnie Logowanie</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="pb-3 px-3 text-right">Akcje Administratora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {sortedUsers.map(u => {
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Sticky Column 1: Login */}
                    <td className="py-3.5 sticky left-0 z-10 bg-slate-900 px-3 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      <span className="font-bold text-white block">{u.username}</span>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {u.id}</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-300 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3.5 px-3 text-slate-200">{u.fullName}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : u.role === 'trader'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'active'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-700/50'
                      }`}>
                        {u.status === 'active' ? 'Aktywny' : 'Zablokowany'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 font-mono text-[11px]">{u.lastLogin || u.createdAt}</td>
                    <td className="py-3.5 px-3 text-right font-sans">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit button */}
                          <button
                            onClick={() => setEditingUser({ ...u })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Edytuj dane i uprawnienia użytkownika"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Block/Unblock */}
                          <button
                            onClick={() => handleBlockToggle(u)}
                            disabled={u.username === 'admin'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              u.status === 'active'
                                ? 'bg-slate-800 hover:bg-amber-950/60 text-slate-300 hover:text-amber-400'
                                : 'bg-amber-950/60 text-amber-300 hover:bg-emerald-950'
                            }`}
                            title={u.status === 'active' ? 'Zablokuj konto użytkownika' : 'Odblokuj konto użytkownika'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors cursor-pointer"
                            title="Resetuj hasło użytkownika do wartości domyślnej"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete account */}
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.username === 'admin'}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-rose-400 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Bezpowrotnie usuń konto użytkownika"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">Tylko Admin</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Panel: Feed Ingestion & Manual Triggers (Tylko Administrator) */}
      {isAdmin && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-600/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-white">Zarządzanie Feedami Rekomendacji (Tylko Administrator)</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automatyczny pobór 24/7 (09:00 & 18:30 GPW) działa w tle bez ingerencji. Tutaj możesz ręcznie wymusić aktualizację lub masowo zaimportować nowe sygnały dla wszystkich użytkowników.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAutoFetchFromApi}
                disabled={isFetchingApi}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                title="Wymuś natychmiastowe sprawdzanie i pobranie nowych rekomendacji z feedu API"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isFetchingApi ? 'animate-spin' : ''}`} />
                <span>{isFetchingApi ? 'Pobieranie...' : 'Pobierz Automatycznie z API Feedu'}</span>
              </button>

              <button
                onClick={handleFetchHistorical30Days}
                disabled={isFetchingHistorical}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                title="Pobierz oficjalne rekomendacje i wyceny z ostatnich 30 dni"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isFetchingHistorical ? 'animate-spin' : ''}`} />
                <span>{isFetchingHistorical ? 'Pobieranie 30 dni...' : 'Pobierz z Ostatnich 30 Dni'}</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                title="Otwórz okno masowego importu sygnałów z Telegrama, Discorda lub StockWatch"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Dodaj / Masowy Import Feedu</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
              <p className="text-slate-400 font-medium">Baza Zewnętrznych Rekomendacji:</p>
              <p className="text-lg font-mono font-bold text-teal-400 mt-1">
                {customReports.length} <span className="text-xs text-slate-500 font-normal">custom + {INITIAL_ANALYST_REPORTS.length} domyślnych</span>
              </p>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
              <p className="text-slate-400 font-medium">Harmonogram Pobierania (Cron):</p>
              <p className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                2 razy dziennie (09:00 & 18:30 GPW)
              </p>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
              <p className="text-slate-400 font-medium">Widoczność w Aplikacji:</p>
              <p className="text-xs text-slate-300 mt-1">
                Pobrane rekomendacje natychmiast trafiają do <strong className="text-emerald-400">Etap 1: Audyt Trafności</strong> dla wszystkich inwestorów.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel: Serwerowy Silnik Auto-Pilota 24/7 (Częstotliwość Pracy) */}
      {isAdmin && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-white">Silnik Serwerowy Auto-Pilota 24/7 (Częstotliwość Pracy Bota)</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ustal jak często autonomiczny demon serwerowy sprawdza kursy rynkowe, weryfikuje zlecenia TP1/TP2/TP3/SL oraz wyszukuje nowe okazje dla włączonych portfeli bez obecności użytkownika.
              </p>
            </div>

            {daemonMessage && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-1.5 animate-fade-in font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{daemonMessage}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-2">
                <span>Interwał sprawdzania rynku i egzekucji w tle:</span>
                <span className="font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                  {(() => {
                    const sec = daemonIntervalMs / 1000;
                    if (sec < 60) return `${sec} sekund`;
                    if (sec < 3600) return `${sec / 60} minut`;
                    return `${sec / 3600} godzin`;
                  })()}
                </span>
              </span>
              <span className="text-[11px] text-slate-400">
                {isSavingDaemonInterval ? 'Zapisywanie na serwerze...' : 'Kliknij interwał, aby natychmiast przestawić silnik'}
              </span>
            </div>

            {/* Grid przycisków interwałów */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-14 gap-1.5">
              {[
                { label: '15s', ms: 15000, desc: '15 sekund (szybki)' },
                { label: '30s', ms: 30000, desc: '30 sekund' },
                { label: '1m', ms: 60000, desc: '1 minuta' },
                { label: '2m', ms: 120000, desc: '2 minuty' },
                { label: '3m', ms: 180000, desc: '3 minuty' },
                { label: '5m', ms: 300000, desc: '5 minut' },
                { label: '10m', ms: 600000, desc: '10 minut' },
                { label: '15m', ms: 900000, desc: '15 minut' },
                { label: '30m', ms: 1800000, desc: '30 minut' },
                { label: '45m', ms: 2700000, desc: '45 minut' },
                { label: '1g', ms: 3600000, desc: '1 godzina' },
                { label: '2g', ms: 7200000, desc: '2 godziny' },
                { label: '3g', ms: 10800000, desc: '3 godziny' },
                { label: '4g', ms: 14400000, desc: '4 godziny' },
              ].map((item) => {
                const isSelected = daemonIntervalMs === item.ms;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleUpdateDaemonInterval(item.ms)}
                    disabled={isSavingDaemonInterval}
                    title={`Ustaw interwał sprawdzania zleceń w tle na ${item.desc}`}
                    className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-cyan-600 to-teal-600 text-white border-cyan-400 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-xs font-mono">{item.label}</div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-bold text-white">Status Autonomicznego Silnika Bota:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-500/40 text-[11px]">
                    AKTYWNY 24/7 (Serwer Node.js)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
                  <span>Monitorowane portfele: <strong className="text-white">{monitoredCount}</strong></span>
                  <span>•</span>
                  <span>Ostatni cykl: <strong className="text-cyan-400 font-sans">{daemonSummary}</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px]">
                <div className="text-slate-400">
                  Transakcje TP/SL i zakupy Auto-Pilota są egzekwowane bezpośrednio na serwerze niezależnie od tego, czy użytkownik jest zalogowany i czy okno przeglądarki jest włączone.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleTriggerDaemonNow}
                    disabled={isTriggeringDaemon}
                    className="px-3 py-1 rounded-xl text-xs font-bold border bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border-cyan-500/50 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    title="Uruchom natychmiastowy cykl sprawdzania rynku i zleceń na serwerze"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isTriggeringDaemon ? 'animate-spin' : ''}`} />
                    <span>{isTriggeringDaemon ? 'Wykonywanie...' : 'Wymuś cykl teraz'}</span>
                  </button>
                  <button
                    onClick={handleToggleForceSession}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      daemonForceSession
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                    title="Wymuś aktywność silnika transakcyjnego 24/7 również poza godzinami sesji GPW do celów testowych"
                  >
                    <span>Tryb 24/7 Sesji (Testy poza GPW):</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${daemonForceSession ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {daemonForceSession ? 'WŁĄCZONY' : 'WYŁĄCZONY'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importu Rekomendacji Zewnętrznych (Tylko Admin) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Importuj Rekomendacje Zewnętrzne (Panel Admina)</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Zamknij okno"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs: Masowy Feed vs Pojedyncza Spółka */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0 text-xs">
              <span className="text-slate-400 font-semibold">Tryb importu:</span>
              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setImportMode('bulk')}
                  title="Wklej feed z wieloma rekomendacjami naraz (StockWatch, Telegram)"
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    importMode === 'bulk'
                      ? 'bg-teal-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Masowy Pobór (Wszystkie Spółki)
                </button>
                <button
                  onClick={() => setImportMode('single')}
                  title="Wprowadź ręcznie pojedynczą rekomendację analityczną"
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    importMode === 'single'
                      ? 'bg-teal-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pojedyncza Spółka
                </button>
              </div>
            </div>

            {/* Form Scroll Area */}
            {importMode === 'bulk' ? (
              <form onSubmit={handleBulkImport} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Źródło Feedu / Kanału Telegram / Discord:</label>
                  <input
                    type="text"
                    value={bulkSource}
                    onChange={(e) => setBulkSource(e.target.value)}
                    placeholder="np. Telegram: GPW Institutional Signals Feed"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500 font-semibold"
                    required
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <label className="block text-slate-300 font-semibold">
                      Wklej treść feedu / postu z StockWatch Forum / Telegrama dla wielu spółek:
                    </label>
                    <span className="text-[11px] text-teal-400 font-mono">Format: Ticker KUPUJ Cena Target</span>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      title="Wstaw przykładowy feed z forum StockWatch.pl"
                      onClick={() => {
                        setBulkSource('StockWatch.pl Forum - Wyceny Społeczności');
                        setBulkText(
                          `CDR KUPUJ Cena: 165.00 Target: 220.00 (StockWatch Forum: Omówienie wyników Q3)
PKN KUPUJ Cena: 140.60 Target: 185.00 (StockWatch Forum: Wycena DCF analityka)
KGH KUPUJ Cena: 288.50 Target: 345.00 (StockWatch Forum: Analiza miedzi i dywidendy)
LPP KUPUJ Cena: 27340.00 Target: 33000.00 (StockWatch Forum: Trend sprzedaży zagranicznej)
DNP KUPUJ Cena: 412.00 Target: 490.00 (StockWatch Forum: Ekspansja sieci sklepów)
XTB KUPUJ Cena: 78.00 Target: 105.00 (StockWatch Forum: Rekordowe przyrosty klientów)`
                        );
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      + Przykładowy Feed StockWatch Forum
                    </button>
                    <button
                      type="button"
                      title="Wstaw przykładowe sygnały z kanału Telegram GPW & Surowce"
                      onClick={() => {
                        setBulkSource('Telegram: GPW Signals Institutional');
                        setBulkText(
                          `PKO KUPUJ Cena: 62.00 Target: 76.00
PEO KUPUJ Cena: 172.00 Target: 210.00
PZU KUPUJ Cena: 51.50 Target: 63.00
KRU KUPUJ Cena: 480.00 Target: 570.00
XAU KUPUJ Cena: 16133.00 Target: 18500.00
BRENT KUPUJ Cena: 378.00 Target: 440.00`
                        );
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      + Sygnały Telegram GPW & Surowce
                    </button>
                  </div>

                  <textarea
                    rows={7}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Wklej cały post z forum lub kanału Telegram..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-teal-500 leading-relaxed"
                    required
                  ></textarea>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="text-teal-400 font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Automatyczny Parser Masowy:
                  </p>
                  <p className="text-slate-300">
                    Parser wykrywa wiersze zawierające dowolny ticker GPW/Surowców (`PKN`, `CDR`, `KGH`, `XAU`, itp.) oraz podane poziomy cen wejścia i Target Price (TP) / Stop Loss (SL).
                  </p>
                </div>

                {/* Footer inside form container */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    title="Anuluj i zamknij okno importu"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                  >
                    Zamknij
                  </button>
                  <button
                    type="submit"
                    title="Przetwórz wklejony tekst i dodaj wykryte rekomendacje do audytu"
                    className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Zaimportuj i Udostępnij Wszystkim</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddCustomReport} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Źródło / Kanał / Analityk:</label>
                    <input
                      type="text"
                      value={newBroker}
                      onChange={(e) => setNewBroker(e.target.value)}
                      placeholder="np. Telegram: GPW Signals, Discord: TraderX"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Ticker Spółki / Surowca:</label>
                    <input
                      type="text"
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value)}
                      placeholder="np. CDR.PL, PKN.PL, XAU.PL"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 uppercase font-mono focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Nazwa Aktywa / Spółki:</label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="np. CD Projekt S.A."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Typ Rekomendacji:</label>
                    <select
                      value={newRating}
                      onChange={(e) => setNewRating(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500 font-bold"
                    >
                      <option value="KUPUJ">KUPUJ</option>
                      <option value="AKUMULUJ">AKUMULUJ</option>
                      <option value="TRZYMAJ">TRZYMAJ</option>
                      <option value="REDUKUJ">REDUKUJ</option>
                      <option value="SPRZEDAJ">SPRZEDAJ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Cena w Dniu Wydania (zł):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newPriceAtReport}
                      onChange={(e) => setNewPriceAtReport(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Cena Docelowa Target Price (zł):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newTargetPrice}
                      onChange={(e) => setNewTargetPrice(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold font-mono focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tytuł Rekomendacji / Sygnału:</label>
                  <input
                    type="text"
                    value={newReportTitle}
                    onChange={(e) => setNewReportTitle(e.target.value)}
                    placeholder="np. Sygnał z grupy Telegram: Wyłamanie z oporu"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Opis / Uzasadnienie:</label>
                  <textarea
                    rows={2}
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    placeholder="Krótki opis argumentów analitycznych..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  ></textarea>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    title="Anuluj dodawanie rekomendacji"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    title="Dodaj pojedynczą rekomendację do systemu"
                    className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Zaimportuj i Udostępnij Wszystkim</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100">
            <h3 className="text-base font-bold text-white mb-4">Edycja Użytkownika: {editingUser.username}</h3>
            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Login</label>
                <input
                  type="text"
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  disabled={editingUser.username === 'admin'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Adres E-mail</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Imię i Nazwisko</label>
                <input
                  type="text"
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Rola Systemowa</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    disabled={editingUser.username === 'admin'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="trader">Trader</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Status Konta</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    disabled={editingUser.username === 'admin'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="active">Aktywny</option>
                    <option value="blocked">Zablokowany</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  title="Anuluj edycję użytkownika"
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  title="Zapisz zmienione dane użytkownika"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer transition-colors"
                >
                  Zapisz Zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100">
            <h3 className="text-base font-bold text-white mb-4">Utwórz Nowe Konto Inwestora</h3>
            <form onSubmit={handleCreateNewUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Login *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="np. makler_gpw"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="makler@gpw.pl"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Imię i Nazwisko</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="np. Piotr Wiśniewski"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Hasło początkowe *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Rola</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  title="Wybierz poziom uprawnień nowego użytkownika"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="trader">Trader</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  title="Anuluj tworzenie nowego konta"
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  title="Utwórz nowe konto inwestora"
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold cursor-pointer transition-all shadow-md shadow-emerald-950/40"
                >
                  Utwórz Konto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
