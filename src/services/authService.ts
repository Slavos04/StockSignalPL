import { UserAccount } from '../types/stock';
import { INITIAL_USERS } from '../data/initialData';

const USERS_STORAGE_KEY = 'stocksignalpl_users_v1';
const CURRENT_USER_KEY = 'stocksignalpl_current_user_v1';
const PASSWORDS_STORAGE_KEY = 'stocksignalpl_passwords_v1';

export class AuthService {
  private static users: UserAccount[] = [];
  private static passwords: Record<string, string> = {
    'admin': 'Admin123!',
    'trader_gpw': 'gpw2026!',
    'analityk_maklerski': 'gpw2026!'
  };

  public static initialize(): void {
    const savedUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (savedUsers) {
      try {
        this.users = JSON.parse(savedUsers);
      } catch {
        this.users = [...INITIAL_USERS];
      }
    } else {
      this.users = [...INITIAL_USERS];
      this.saveUsers();
    }

    const savedPasswords = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (savedPasswords) {
      try {
        this.passwords = JSON.parse(savedPasswords);
      } catch {
        // default passwords
      }
    } else {
      this.savePasswords();
    }
  }

  public static getUsers(): UserAccount[] {
    if (this.users.length === 0) {
      this.initialize();
    }
    return this.users;
  }

  public static getCurrentUser(): UserAccount | null {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static setCurrentUser(user: UserAccount | null): void {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  public static async loginAsync(usernameOrEmail: string, passwordAttempt: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password: passwordAttempt })
      });
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        this.setCurrentUser(data.user);
        return { success: true, user: data.user };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    } catch (e) {
      // Fallback to local
    }
    return this.login(usernameOrEmail, passwordAttempt);
  }

  public static async registerAsync(username: string, email: string, fullName: string, passwordAttempt: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, fullName, password: passwordAttempt })
      });
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        this.setCurrentUser(data.user);
        return { success: true, user: data.user };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    } catch (e) {
      // Fallback to local
    }
    return this.register(username, email, fullName, passwordAttempt);
  }

  public static login(usernameOrEmail: string, passwordAttempt: string): { success: boolean; user?: UserAccount; error?: string } {
    this.getUsers();
    const cleanLogin = usernameOrEmail.trim().toLowerCase();
    const user = this.users.find(u => u.username.toLowerCase() === cleanLogin || u.email.toLowerCase() === cleanLogin);

    if (!user) {
      return { success: false, error: 'Nie znaleziono użytkownika o podanym loginie lub adresie e-mail.' };
    }

    if (user.status === 'blocked') {
      return { success: false, error: 'To konto zostało zablokowane przez Administratora. Skontaktuj się z biurem GPW.' };
    }

    const storedPass = this.passwords[user.username] || (user.username === 'admin' ? 'Admin123!' : 'gpw2026!');
    if (passwordAttempt !== storedPass) {
      return { success: false, error: 'Nieprawidłowe hasło. Wskazówka dla admina: Admin123!' };
    }

    // Update last login
    user.lastLogin = new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    this.saveUsers();
    this.setCurrentUser(user);

    return { success: true, user };
  }

  public static register(username: string, email: string, fullName: string, passwordAttempt: string): { success: boolean; user?: UserAccount; error?: string } {
    this.getUsers();
    const cleanUser = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (this.users.some(u => u.username.toLowerCase() === cleanUser)) {
      return { success: false, error: 'Podany login jest już zajęty.' };
    }

    if (this.users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Konto z tym adresem e-mail już istnieje.' };
    }

    if (passwordAttempt.length < 6) {
      return { success: false, error: 'Hasło musi zawierać co najmniej 6 znaków.' };
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      username: username.trim(),
      email: cleanEmail,
      fullName: fullName.trim() || username.trim(),
      role: 'trader',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
    };

    this.users.push(newUser);
    this.passwords[newUser.username] = passwordAttempt;

    this.saveUsers();
    this.savePasswords();
    this.setCurrentUser(newUser);

    return { success: true, user: newUser };
  }

  public static changePassword(username: string, oldPass: string, newPass: string): { success: boolean; error?: string } {
    this.getUsers();
    const stored = this.passwords[username] || (username === 'admin' ? 'Admin123!' : 'gpw2026!');
    if (oldPass !== stored) {
      return { success: false, error: 'Aktualne hasło jest niepoprawne.' };
    }
    if (newPass.length < 6) {
      return { success: false, error: 'Nowe hasło musi zawierać co najmniej 6 znaków.' };
    }

    this.passwords[username] = newPass;
    this.savePasswords();
    return { success: true };
  }

  public static deleteAccount(userId: string): boolean {
    this.getUsers();
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    if (user.username === 'admin') return false; // Nie można usunąć głównego administratora

    delete this.passwords[user.username];
    this.users = this.users.filter(u => u.id !== userId);
    this.saveUsers();
    this.savePasswords();

    const curr = this.getCurrentUser();
    if (curr?.id === userId) {
      this.setCurrentUser(null);
    }
    return true;
  }

  public static updateUserByAdmin(updatedUser: UserAccount): boolean {
    this.getUsers();
    const idx = this.users.findIndex(u => u.id === updatedUser.id);
    if (idx === -1) return false;

    this.users[idx] = { ...updatedUser };
    this.saveUsers();

    // Jeśli edytowano aktualnie zalogowanego, zaktualizuj sesję
    const curr = this.getCurrentUser();
    if (curr?.id === updatedUser.id) {
      this.setCurrentUser(updatedUser);
    }
    return true;
  }

  public static resetUserPasswordByAdmin(username: string, newPass: string = 'StockGPW2026!'): boolean {
    this.getUsers();
    this.passwords[username] = newPass;
    this.savePasswords();
    return true;
  }

  public static logout(): void {
    this.setCurrentUser(null);
  }

  private static saveUsers(): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
  }

  private static savePasswords(): void {
    localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(this.passwords));
  }
}
