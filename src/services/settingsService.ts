import { AppSettings, AppTheme } from '../types/stock';

const SETTINGS_STORAGE_KEY = 'stocksignalpl_settings_v1_1';

export class SettingsService {
  private static settings: AppSettings = {
    theme: 'dark',
    customBgUrl: '',
    refreshIntervalSec: 4,
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
}
