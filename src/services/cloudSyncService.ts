import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { PortfolioStrategy, TradeRecord, UserAccount, AppSettings } from '../types/stock';
import { INITIAL_PORTFOLIOS, INITIAL_TRADES } from '../data/initialData';

export class CloudSyncService {
  private static portfolioUnsub: Unsubscribe | null = null;
  private static tradesUnsub: Unsubscribe | null = null;

  /**
   * Zapisuje lub aktualizuje profil użytkownika w Firestore
   */
  public static async saveUserProfile(user: UserAccount): Promise<void> {
    const path = `users/${user.id}`;
    try {
      const sanitized = {
        id: String(user.id).slice(0, 128),
        email: String(user.email).slice(0, 128),
        displayName: String(user.fullName || user.username).slice(0, 128),
        role: user.role || 'trader',
        status: user.status || 'active',
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.id), sanitized, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Pobiera portfele użytkownika z Firestore. Jeśli brak, wgrywa początkowe.
   */
  public static async fetchUserPortfolios(userId: string): Promise<PortfolioStrategy[]> {
    const path = `users/${userId}/portfolios`;
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'portfolios'));
      if (!snap.empty) {
        const list: PortfolioStrategy[] = [];
        snap.forEach(d => {
          list.push(d.data() as PortfolioStrategy);
        });
        return list;
      }

      // Jeśli użytkownik loguje się po raz pierwszy na nowym urządzeniu, zainicjuj jego chmurę
      const initial = [...INITIAL_PORTFOLIOS];
      for (const p of initial) {
        await this.saveUserPortfolio(userId, p);
      }
      return initial;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  /**
   * Zapisuje pojedynczy portfel w chmurze
   */
  public static async saveUserPortfolio(userId: string, portfolio: PortfolioStrategy): Promise<void> {
    const path = `users/${userId}/portfolios/${portfolio.id}`;
    try {
      const cleanPortfolio: any = {
        id: String(portfolio.id).slice(0, 128),
        userId: String(userId).slice(0, 128),
        name: String(portfolio.name).slice(0, 128),
        shortDesc: String(portfolio.shortDesc || '').slice(0, 256),
        riskLevel: portfolio.riskLevel || 'Umiarkowane',
        initialCapital: Number(portfolio.initialCapital) || 100000,
        currentBalance: Number(portfolio.currentBalance) || 100000,
        allocatedPln: Number(portfolio.allocatedPln) || 0,
        cashPln: Number(portfolio.cashPln) || 100000,
        totalProfitPln: Number(portfolio.totalProfitPln) || 0,
        totalProfitPercent: Number(portfolio.totalProfitPercent) || 0,
        benchmarkReturnWig20: Number(portfolio.benchmarkReturnWig20) || 0,
        alpha: Number(portfolio.alpha) || 0,
        tradesCount: Number(portfolio.tradesCount) || 0,
        winRate: Number(portfolio.winRate) || 0,
        autoPilotEnabled: Boolean(portfolio.autoPilotEnabled),
        telegramEnabled: Boolean(portfolio.telegramEnabled),
        isCustom: Boolean((portfolio as any).isCustom),
        activePositions: portfolio.activePositions || [],
        historyData: portfolio.historyData || [],
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', userId, 'portfolios', portfolio.id), cleanPortfolio, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Usuwa portfel z chmury
   */
  public static async deleteUserPortfolio(userId: string, portfolioId: string): Promise<void> {
    const path = `users/${userId}/portfolios/${portfolioId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'portfolios', portfolioId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  /**
   * Pobiera historię zleceń z Dziennika Tradera
   */
  public static async fetchUserTrades(userId: string): Promise<TradeRecord[]> {
    const path = `users/${userId}/trades`;
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'trades'));
      if (!snap.empty) {
        const list: TradeRecord[] = [];
        snap.forEach(d => {
          list.push(d.data() as TradeRecord);
        });
        return list;
      }
      // Wgraj początkowe transakcje do chmury
      const initial = [...INITIAL_TRADES];
      for (const t of initial) {
        await this.saveUserTrade(userId, t);
      }
      return initial;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  /**
   * Zapisuje transakcję w chmurze
   */
  public static async saveUserTrade(userId: string, trade: TradeRecord): Promise<void> {
    const path = `users/${userId}/trades/${trade.id}`;
    try {
      const cleanTrade: any = {
        id: String(trade.id).slice(0, 128),
        userId: String(userId).slice(0, 128),
        portfolioId: String(trade.strategyId || 'p1').slice(0, 128),
        strategyId: String(trade.strategyId || 'p1').slice(0, 128),
        ticker: String(trade.ticker).slice(0, 32),
        name: String(trade.name).slice(0, 128),
        type: trade.type || 'KUPNO',
        pricePln: Number(trade.pricePln) || 0,
        shares: Number(trade.shares) || 1,
        totalPln: Number(trade.totalPln) || 0,
        resultPln: Number(trade.resultPln) || 0,
        resultPercent: Number(trade.resultPercent) || 0,
        reason: String(trade.reason || '').slice(0, 256),
        status: trade.status || 'AUTO-PILOT',
        date: trade.date || new Date().toISOString()
      };
      await setDoc(doc(db, 'users', userId, 'trades', trade.id), cleanTrade, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Zapisuje ustawienia użytkownika w chmurze
   */
  public static async saveUserSettings(userId: string, settings: AppSettings): Promise<void> {
    const path = `users/${userId}/settings/app`;
    try {
      const clean = {
        userId: String(userId).slice(0, 128),
        theme: settings.theme,
        customBgUrl: String(settings.customBgUrl || '').slice(0, 1024),
        refreshIntervalSec: Number(settings.refreshIntervalSec) || 4,
        bgOpacity: Number(settings.bgOpacity) ?? 85,
        bgBlur: Number(settings.bgBlur) ?? 0,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', userId, 'settings', 'app'), clean, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Subskrybuje zmiany w portfelach w czasie rzeczywistym
   */
  public static subscribeToUserPortfolios(userId: string, onUpdate: (portfolios: PortfolioStrategy[]) => void): void {
    if (this.portfolioUnsub) {
      this.portfolioUnsub();
    }
    const path = `users/${userId}/portfolios`;
    this.portfolioUnsub = onSnapshot(
      collection(db, 'users', userId, 'portfolios'),
      (snap) => {
        const list: PortfolioStrategy[] = [];
        snap.forEach(d => list.push(d.data() as PortfolioStrategy));
        if (list.length > 0) {
          onUpdate(list);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }

  /**
   * Zatrzymuje subskrypcje po wylogowaniu
   */
  public static stopSubscriptions(): void {
    if (this.portfolioUnsub) {
      this.portfolioUnsub();
      this.portfolioUnsub = null;
    }
    if (this.tradesUnsub) {
      this.tradesUnsub();
      this.tradesUnsub = null;
    }
  }
}
