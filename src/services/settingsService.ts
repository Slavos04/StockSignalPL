import { AppSettings, AppTheme, AppCurrency } from '../types/stock';

const SETTINGS_STORAGE_KEY = 'stocksignalpl_settings_v1_1';

export class SettingsService {
  private static settings: AppSettings = {
    theme: 'dark',
    customBgUrl: '',
    refreshIntervalSec: 4,
    currency: 'PLN',
    usdPlnRate: 3.97,
    bgOpacity: 80,
    bgBlur: 0,
    forceSessionOpenTest: false
  };

  public static initialize(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      } catch {
        // default settings
      }
    }
    this.applyTheme(this.settings.theme);
    return this.settings;
  }

  public static getSettings(): AppSettings {
    return this.initialize();
  }

  public static updateUsdPlnRate(rate: number): number {
    if (!rate || !isFinite(rate) || rate <= 0) return this.getUsdPlnRate();
    const rounded = Number(rate.toFixed(4));
    const current = this.getSettings();
    if (Math.abs((current.usdPlnRate || 0) - rounded) >= 0.0001) {
      this.settings = { ...current, usdPlnRate: rounded };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      } catch {}
    }
    return rounded;
  }

  public static getCurrency(settings?: AppSettings): AppCurrency {
    return (settings?.currency || this.getSettings().currency || 'PLN') as AppCurrency;
  }

  public static getUsdPlnRate(settings?: AppSettings): number {
    const r = settings?.usdPlnRate || this.getSettings().usdPlnRate || 3.97;
    return r > 0 ? r : 3.97;
  }

  public static getCurrencySymbol(currency?: AppCurrency): string {
    const curr = currency || this.getCurrency();
    return curr === 'USD' ? '$' : 'zł';
  }

  public static getCurrencyCode(currency?: AppCurrency): string {
    const curr = currency || this.getCurrency();
    return curr === 'USD' ? 'USD' : 'PLN';
  }

  public static convertFromPln(plnValue: number, currency?: AppCurrency, rate?: number): number {
    const curr = currency || this.getCurrency();
    const fx = rate && rate > 0 ? rate : this.getUsdPlnRate();
    if (!isFinite(plnValue)) return 0;
    return curr === 'USD' ? plnValue / fx : plnValue;
  }

  public static convertToPln(valueInDisplayCurrency: number, currency?: AppCurrency, rate?: number): number {
    const curr = currency || this.getCurrency();
    const fx = rate && rate > 0 ? rate : this.getUsdPlnRate();
    if (!isFinite(valueInDisplayCurrency)) return 0;
    return curr === 'USD' ? valueInDisplayCurrency * fx : valueInDisplayCurrency;
  }

  public static saveSettings(settings: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.getSettings(), ...settings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    if (settings.theme) {
      this.applyTheme(settings.theme);
    }

    // Sync settings to server
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: this.settings.theme,
        refresh_interval_sec: this.settings.refreshIntervalSec,
        custom_bg_url: this.settings.customBgUrl,
        bg_opacity: this.settings.bgOpacity,
        bg_blur: this.settings.bgBlur
      })
    }).catch(() => {});

    // Sync test session mode to server daemon if specified
    if (settings.forceSessionOpenTest !== undefined) {
      fetch('/api/admin/daemon-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSessionOpenTest: settings.forceSessionOpenTest })
      }).catch(() => {});
    }

    return this.settings;
  }

  public static applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
    }
  }

  public static formatMoney(
    plnValue: number,
    settingsOrCurrency?: AppSettings | AppCurrency,
    rateOverride?: number,
    decimals: number = 2
  ): string {
    const isString = typeof settingsOrCurrency === 'string';
    const currentSettings = !isString && settingsOrCurrency ? settingsOrCurrency : this.getSettings();
    const curr: AppCurrency = isString ? (settingsOrCurrency as AppCurrency) : (currentSettings.currency || 'PLN');
    const rate = rateOverride && rateOverride > 0 ? rateOverride : (currentSettings.usdPlnRate || 3.97);
    const val = Number.isFinite(plnValue) ? plnValue : 0;

    if (curr === 'USD') {
      const usd = val / rate;
      const absStr = Math.abs(usd).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      return `${usd < 0 ? '-' : ''}$${absStr}`;
    }
    return `${val.toLocaleString('pl-PL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} zł`;
  }

  public static formatSignedMoney(
    plnValue: number,
    currency?: AppCurrency,
    rate?: number,
    decimals: number = 2
  ): string {
    const val = Number.isFinite(plnValue) ? plnValue : 0;
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${this.formatMoney(val, currency || this.getCurrency(), rate, decimals)}`;
  }

  public static formatCompactMoney(
    plnValue: number,
    currency?: AppCurrency,
    rate?: number
  ): string {
    const curr = currency || this.getCurrency();
    const val = this.convertFromPln(Number.isFinite(plnValue) ? plnValue : 0, curr, rate);
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      const str = (abs / 1_000_000).toFixed(2);
      return curr === 'USD' ? `${sign}$${str}M` : `${sign}${str}M zł`;
    }
    if (abs >= 1_000) {
      const str = (abs / 1_000).toFixed(1);
      return curr === 'USD' ? `${sign}$${str}k` : `${sign}${str}k zł`;
    }
    const str = abs.toFixed(0);
    return curr === 'USD' ? `${sign}$${str}` : `${sign}${str} zł`;
  }
}
