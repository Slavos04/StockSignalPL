import { AppSettings, AppTheme, AppCurrency } from '../types/stock';

const SETTINGS_STORAGE_KEY = 'stocksignalpl_settings_v1_1';

export class SettingsService {
  private static settings: AppSettings = {
    theme: 'dark',
    customBgUrl: '',
    refreshIntervalSec: 4,
    currency: 'PLN',
    usdPlnRate: 4.02,
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

  public static saveSettings(settings: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.getSettings(), ...settings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    if (settings.theme) {
      this.applyTheme(settings.theme);
    }
    return this.settings;
  }

  public static applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
    }
  }

  public static formatMoney(plnValue: number, settings?: AppSettings): string {
    const currentSettings = settings || this.getSettings();
    const curr = currentSettings.currency || 'PLN';
    const rate = currentSettings.usdPlnRate || 4.02;

    if (curr === 'USD') {
      const usd = plnValue / rate;
      return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${plnValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
  }
}

