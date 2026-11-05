import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { UserAccount } from '../types/stock';
import {
  ShieldCheck,
  Lock,
  User,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AuthGuardProps {
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount) => void;
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ currentUser, onLoginSuccess, children }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (currentUser) {
    return <>{children}</>;
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!loginInput.trim() || !passwordInput.trim()) {
      setErrorMessage('Wprowadź login oraz hasło.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.loginAsync(loginInput, passwordInput);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Błąd logowania do bazy danych.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regUsername.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMessage('Wypełnij wszystkie wymagane pola.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.registerAsync(regUsername, regEmail, regFullName, regPassword);
      if (res.success && res.user) {
        setSuccessMessage('Konto utworzone w bazie danych! Logowanie...');
        setTimeout(() => {
          if (res.user) onLoginSuccess(res.user);
        }, 700);
      } else {
        setErrorMessage(res.error || 'Błąd rejestracji konta.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setLoginInput('admin');
    setPasswordInput('Admin123!');
    setIsLoading(true);
    try {
      const res = await AuthService.loginAsync('admin', 'Admin123!');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Polish Warsaw Stock Exchange graphic elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.18),rgba(255,255,255,0))]"></div>
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-900/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8">
        {/* Header Branding */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-950/80 border border-emerald-500/40 shadow-lg shadow-emerald-950/50 mb-3 overflow-hidden p-1">
            <img src="/logo.png" alt="StockSignalPL Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">
              <span className="text-emerald-400">Stock</span>
              <span className="text-yellow-400">Signal</span>
              <span className="text-emerald-400 font-extrabold">PL</span>
            </h1>
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">v1.7</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Giełda Papierów Wartościowych w Warszawie (GPW)</p>
        </div>

        {/* Tab switcher: Logowanie / Rejestracja */}
        <div className="flex rounded-xl bg-slate-950 p-1 mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Logowanie do Konta
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMessage(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'register' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rejestracja Konta
          </button>
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Login lub E-mail inwestora</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="np. admin lub trader_gpw"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Hasło dostępowe</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Wpisz hasło..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Zaloguj do Terminala GPW</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nazwa Użytkownika (Login) *</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="np. jan_inwestor"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Imię i Nazwisko / Pseudonim</label>
              <input
                type="text"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="np. Jan Kowalski"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Adres E-mail *</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="jan@dommaklerski.pl"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Hasło (min. 6 znaków) *</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
            >
              <span>Utwórz Nowe Konto Inwestora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Quick Admin Helper Button */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 mb-2">Szybkie logowanie testowe:</p>
          <button
            type="button"
            onClick={handleQuickAdminLogin}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Zaloguj jako <b>Administrator</b> (admin / Admin123!)</span>
          </button>
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="mt-8 text-center text-xs text-slate-500 z-10 space-y-1">
        <p>StockSignalPL v1.5 • Polski Rynek Giełdowy GPW • Kontakt: slavosmm@gmail.com</p>
      </footer>
    </div>
  );
};
