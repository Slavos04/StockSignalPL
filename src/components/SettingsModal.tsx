import React, { useState, useEffect } from 'react';
import { AppSettings, AppTheme, TelegramSettings } from '../types/stock';
import { TelegramService } from '../services/telegramService';
import { Settings, X, Palette, Image, Send, Clock, CheckCircle2, RotateCcw, Upload, Link2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (newSettings: AppSettings) => void;
  telegramSettings: TelegramSettings;
  onUpdateTelegramSettings: (newSettings: TelegramSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  appSettings,
  onUpdateAppSettings,
  telegramSettings,
  onUpdateTelegramSettings
}) => {
  // Theme & Background state
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(appSettings.theme);
  const [customBgInput, setCustomBgInput] = useState<string>(appSettings.customBgUrl || '');
  const [bgOpacity, setBgOpacity] = useState<number>(appSettings.bgOpacity ?? 85);
  const [bgBlur, setBgBlur] = useState<number>(appSettings.bgBlur ?? 0);
  const [refreshInterval, setRefreshInterval] = useState<number>(appSettings.refreshIntervalSec || 4);
  const [forceSessionTest, setForceSessionTest] = useState<boolean>(appSettings.forceSessionOpenTest || false);

  // Telegram state
  const [botToken, setBotToken] = useState<string>(telegramSettings.botToken || '');
  const [chatId, setChatId] = useState<string>(telegramSettings.chatId || '');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTheme(appSettings.theme);
      setCustomBgInput(appSettings.customBgUrl || '');
      setBgOpacity(appSettings.bgOpacity ?? 85);
      setBgBlur(appSettings.bgBlur ?? 0);
      setRefreshInterval(appSettings.refreshIntervalSec || 4);
      setForceSessionTest(appSettings.forceSessionOpenTest || false);
      setBotToken(telegramSettings.botToken || '');
      setChatId(telegramSettings.chatId || '');
    }
  }, [isOpen, appSettings, telegramSettings]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const img = document.createElement('img');
          img.onload = () => {
            // Compress image using canvas so it fits cleanly in localStorage without QuotaExceededError
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1080;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
              setCustomBgInput(compressedDataUrl);

              // Apply background immediately so the user sees it in real time
              const updated = {
                ...appSettings,
                theme: selectedTheme,
                customBgUrl: compressedDataUrl,
                refreshIntervalSec: refreshInterval,
                bgOpacity,
                bgBlur
              };
              onUpdateAppSettings(updated);
              setToastMessage('Wczytano i natychmiast zastosowano tło z dysku!');
              setTimeout(() => setToastMessage(null), 3000);
            }
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyBackground = () => {
    const updated = {
      ...appSettings,
      theme: selectedTheme,
      customBgUrl: customBgInput.trim(),
      refreshIntervalSec: refreshInterval,
      bgOpacity,
      bgBlur
    };
    onUpdateAppSettings(updated);
    setToastMessage(customBgInput ? 'Nowe tło zostało pomyślnie zastosowane!' : 'Przywrócono domyślne tło motywu.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpacityChange = (val: number) => {
    setBgOpacity(val);
    onUpdateAppSettings({
      ...appSettings,
      theme: selectedTheme,
      customBgUrl: customBgInput.trim(),
      refreshIntervalSec: refreshInterval,
      bgOpacity: val,
      bgBlur
    });
  };

  const handleBlurChange = (val: number) => {
    setBgBlur(val);
    onUpdateAppSettings({
      ...appSettings,
      theme: selectedTheme,
      customBgUrl: customBgInput.trim(),
      refreshIntervalSec: refreshInterval,
      bgOpacity,
      bgBlur: val
    });
  };

  const handleClearBackground = () => {
    setCustomBgInput('');
    const updated = {
      ...appSettings,
      theme: selectedTheme,
      customBgUrl: '',
      refreshIntervalSec: refreshInterval,
      bgOpacity,
      bgBlur
    };
    onUpdateAppSettings(updated);
    setToastMessage('Własne tło zostało usunięte.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleThemeChange = (theme: AppTheme) => {
    setSelectedTheme(theme);
    const updated = {
      ...appSettings,
      theme,
      customBgUrl: customBgInput.trim(),
      refreshIntervalSec: refreshInterval,
      bgOpacity,
      bgBlur
    };
    onUpdateAppSettings(updated);
  };

  const handleSaveAll = () => {
    // Save App Settings
    const updatedApp = {
      ...appSettings,
      theme: selectedTheme,
      customBgUrl: customBgInput.trim(),
      refreshIntervalSec: refreshInterval,
      bgOpacity,
      bgBlur,
      forceSessionOpenTest: forceSessionTest
    };
    onUpdateAppSettings(updatedApp);

    // Save Telegram Settings
    const updatedTg = TelegramService.saveSettings({
      botToken: botToken.trim(),
      chatId: chatId.trim()
    });
    onUpdateTelegramSettings(updatedTg);

    // Close modal immediately as requested by user
    onClose();
  };

  const handleTestTelegram = async () => {
    if (!botToken || !chatId) {
      setTelegramStatus('Błąd: Wprowadź Bot Token i Chat ID przed wysłaniem testu.');
      return;
    }
    setIsTestingTelegram(true);
    setTelegramStatus('Wysyłanie powiadomienia testowego do Telegrama...');
    
    // Save temporarily so TelegramService has the latest credentials
    TelegramService.saveSettings({ botToken: botToken.trim(), chatId: chatId.trim() });
    const res = await TelegramService.sendTestAlert();
    setIsTestingTelegram(false);
    setTelegramStatus(res.message);
    setTimeout(() => setTelegramStatus(null), 6000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-md">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Ustawienia Systemu & Personalizacja</h3>
              <p className="text-xs text-slate-400">Motywy, tło, notowania Stooq i powiadomienia Telegram</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Toast inside modal */}
          {toastMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Section 1: Themes */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>Motyw Kolorystyczny Platformy</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Dark */}
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTheme === 'dark'
                    ? 'border-emerald-500 bg-slate-800/90 shadow-md ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-700"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div>
                </div>
                <p className="font-bold text-white">Ciemny (Dark)</p>
                <p className="text-[10px] text-slate-400">Domyślny fintech</p>
              </button>

              {/* Light */}
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTheme === 'light'
                    ? 'border-emerald-500 bg-slate-800/90 shadow-md ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-100 border border-slate-300"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div>
                </div>
                <p className="font-bold text-white">Jasny (Light)</p>
                <p className="text-[10px] text-slate-400">Parkiet GPW</p>
              </button>

              {/* Ocean */}
              <button
                type="button"
                onClick={() => handleThemeChange('ocean')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTheme === 'ocean'
                    ? 'border-cyan-500 bg-slate-800/90 shadow-md ring-1 ring-cyan-500'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-sky-950 border border-sky-600"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-cyan-400"></div>
                </div>
                <p className="font-bold text-white">Ocean (Morski)</p>
                <p className="text-[10px] text-slate-400">Głębia błękitu</p>
              </button>

              {/* Forrest */}
              <button
                type="button"
                onClick={() => handleThemeChange('forrest')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTheme === 'forrest'
                    ? 'border-emerald-500 bg-slate-800/90 shadow-md ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-950 border border-emerald-600"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400"></div>
                </div>
                <p className="font-bold text-white">Forrest (Leśny)</p>
                <p className="text-[10px] text-slate-400">Ciemna zieleń</p>
              </button>
            </div>
          </div>

          {/* Section 2: Custom Background */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Image className="w-4 h-4 text-indigo-400" />
              <span>Własne Tło Aplikacji (Link lub Plik z Dysku)</span>
            </h4>

            {/* URL input */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3 text-slate-400" />
                <span>Adres URL grafiki z internetu</span>
              </label>
              <input
                type="text"
                value={customBgInput.startsWith('data:') ? '[Wczytano plik z dysku]' : customBgInput}
                onChange={(e) => setCustomBgInput(e.target.value)}
                placeholder="np. https://images.unsplash.com/photo-..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Local file picker */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <Upload className="w-3 h-3 text-slate-400" />
                <span>LUB załaduj plik graficzny z komputera</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            {/* Sliders for Opacity and Blur */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              {/* Opacity / Przezroczystość i jasność tła */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <span>Widoczność / Jasność Tła (Przezroczystość nakładki):</span>
                  </span>
                  <span className="font-mono text-indigo-400 font-bold">{bgOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={bgOpacity}
                  onChange={(e) => handleOpacityChange(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>Ciemniejsze (20%)</span>
                  <span>Zbalansowane (80%)</span>
                  <span>Pełna jasność zdjęcia (100%)</span>
                </div>
              </div>

              {/* Blur / Rozmycie tła */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <span>Efekt Rozmycia (Blur):</span>
                  </span>
                  <span className="font-mono text-indigo-400 font-bold">{bgBlur} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={bgBlur}
                  onChange={(e) => handleBlurChange(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>Ostre / brak rozmycia (0px)</span>
                  <span>Lekkie (5px)</span>
                  <span>Mocne rozmycie (20px)</span>
                </div>
              </div>
            </div>

            {/* Action buttons for background */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyBackground}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors cursor-pointer"
              >
                Zastosuj Tło & Ustawienia Wizualne
              </button>
              {customBgInput && (
                <button
                  type="button"
                  onClick={handleClearBackground}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Wyczyść Tło
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Stooq Quotes Refresh & GPW Session */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Czas Odświeżania Notowań Stooq & Sesja GPW</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Określ interwał automatycznego odświeżania kursów spółek i pozycji portfeli (aktywne wyłącznie w trakcie trwania sesji):
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-0.5 font-mono">
              {[2, 3, 5, 10, 30, 60].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setRefreshInterval(sec)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    refreshInterval === sec
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            {/* GPW Warsaw Session Notice */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0"></span>
                <div>
                  <p className="text-slate-200 font-semibold">Harmonogram Parkietu GPW Warszawa:</p>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Notowania ciągłe akcji trwają od <strong>poniedziałku do piątku w godzinach 09:00 – 17:00</strong> (z wyłączeniem świąt i dni ustawowo wolnych w Polsce).
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-[10px] pl-4">
                * Poza godzinami sesji automatyczne odświeżanie jest <strong>wstrzymane</strong>, a notowania pozostają stabilne. W dowolnej chwili możesz kliknąć <strong>"Stooq (Ręczne)"</strong> na górnej belce, aby wymusić odświeżenie kursów na żądanie.
              </p>

              {/* Developer / Testing override switch */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-300">Wymuś aktywną sesję GPW (tryb testowy)</p>
                  <p className="text-[10px] text-slate-500">
                    Włącza automatyczne odświeżanie nawet w weekendy i wieczorami w celach prezentacji i testu algorytmu
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForceSessionTest(!forceSessionTest)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    forceSessionTest ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Telegram Settings */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-400" />
                <span>Dane Bota Telegram (Alerty GPW)</span>
              </h4>

              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={isTestingTelegram || !botToken || !chatId}
                className="px-3 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 text-[11px] font-semibold border border-sky-700 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Send className={`w-3 h-3 ${isTestingTelegram ? 'animate-spin' : ''}`} />
                <span>Testuj Bot</span>
              </button>
            </div>

            {telegramStatus && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-sky-800/60 text-sky-300 text-[11px]">
                {telegramStatus}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Telegram Bot Token</label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="np. 7123456789:AAHq_xyz..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Chat ID / ID Kanału</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="np. -1001234567890 lub 987654321"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              * Powiadomienia włącza się i wyłącza indywidualnie na kafelku każdego portfela.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveAll}
            className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            Zapisz Wszystkie Ustawienia
          </button>
        </div>
      </div>
    </div>
  );
};
