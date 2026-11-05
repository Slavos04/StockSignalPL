import { TelegramSettings, StockConsensus, StockQuote } from '../types/stock';

const TELEGRAM_STORAGE_KEY = 'stocksignalpl_telegram_v1';

export class TelegramService {
  private static settings: TelegramSettings = {
    botToken: '',
    chatId: '',
    alertsEnabled: true
  };

  public static initialize(): TelegramSettings {
    const raw = localStorage.getItem(TELEGRAM_STORAGE_KEY);
    if (raw) {
      try {
        this.settings = JSON.parse(raw);
      } catch {
        // default settings
      }
    }
    return this.settings;
  }

  public static getSettings(): TelegramSettings {
    return this.initialize();
  }

  public static saveSettings(settings: Partial<TelegramSettings>): TelegramSettings {
    this.settings = { ...this.getSettings(), ...settings };
    localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(this.settings));
    return this.settings;
  }

  public static async sendAlert(message: string): Promise<{ success: boolean; message: string }> {
    const s = this.getSettings();
    if (!s.botToken || !s.chatId) {
      return {
        success: false,
        message: 'Brak skonfigurowanego tokena bota Telegram lub Chat ID w Ustawieniach.'
      };
    }

    try {
      const res = await fetch('/api/telegram-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: s.botToken.trim(),
          chatId: s.chatId.trim(),
          message
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        this.saveSettings({ lastSentAt: new Date().toLocaleTimeString('pl-PL') });
        return { success: true, message: 'Alert został pomyślnie wysłany na Twój kanał Telegram!' };
      } else {
        return { success: false, message: `Błąd Telegram API: ${data.description || data.error || 'Nieznany błąd'}` };
      }
    } catch (err: any) {
      return { success: false, message: `Błąd połączenia: ${err.message}` };
    }
  }

  public static async sendStockSignal(stock: StockQuote, consensus: StockConsensus): Promise<{ success: boolean; message: string }> {
    const text = `🇵🇱 <b>StockSignalPl v1.0 - NOWY SYGNAŁ GPW</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏛️ <b>Walor:</b> <code>${stock.symbol}</code> (${stock.name})\n` +
      `📊 <b>Rynek:</b> ${stock.market} | <b>Sektor:</b> ${stock.sector}\n` +
      `⭐ <b>Konsensus AI:</b> <b>${consensus.overallScore}%</b> [${consensus.verdict}]\n` +
      `🤖 <b>Auto-Pilot:</b> ${consensus.autoPilotActive ? '✅ AKTYWNY (>=76%)' : '⚪ WYŁĄCZONY'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>Cena Wejścia:</b> ${consensus.entryPrice.toFixed(2)} PLN\n` +
      `🛑 <b>Stop Loss:</b> ${consensus.stopLoss.toFixed(2)} PLN (-${consensus.stopLossPercent}%)\n` +
      `🎯 <b>TP1 (33% wolumenu):</b> ${consensus.tp1.toFixed(2)} PLN (+${consensus.tp1Percent}%)\n` +
      `🎯 <b>TP2 (33% wolumenu):</b> ${consensus.tp2.toFixed(2)} PLN (+${consensus.tp2Percent}%)\n` +
      `🎯 <b>TP3 (34% wolumenu):</b> ${consensus.tp3.toFixed(2)} PLN (+${consensus.tp3Percent}%)\n` +
      `⚖️ <b>Risk / Reward Ratio:</b> 1 : ${consensus.riskRewardRatio}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 <i>Wygenerowano automatycznie przez silnik GPW StockSignalPl v1.0</i>`;

    return this.sendAlert(text);
  }

  public static async sendTestAlert(): Promise<{ success: boolean; message: string }> {
    const testMessage = `🇵🇱 <b>StockSignalPl v1.0 - TEST POWIADOMIEŃ TELEGRAM</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ Połączenie z botem zostało pomyślnie nawiązane!\n` +
      `🏛️ Silnik giełdowy GPW Warszawa jest aktywny.\n` +
      `📡 Nasłuch 10 źródeł sygnałów i Auto-Pilot (>=76%) działają poprawnie.\n` +
      `⏰ Czas testu: <code>${new Date().toLocaleString('pl-PL')}</code>`;

    return this.sendAlert(testMessage);
  }
}
