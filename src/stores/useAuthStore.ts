import { create } from 'zustand';
import { authService, type AuthCredentials, type AuthUser } from '../services/authService';

type AuthAction = 'refresh' | 'login' | 'register' | 'logout';

interface AuthState {
  user: AuthUser | null;
  pending: AuthAction | null;
  error: string | null;
  refreshUser: () => Promise<boolean>;
  login: (credentials: AuthCredentials) => Promise<boolean>;
  register: (credentials: AuthCredentials) => Promise<boolean>;
  logout: () => Promise<boolean>;
  clearError: () => void;
}

// Session credentials stay in the server's HttpOnly cookie, never browser storage.
export const useAuthStore = create<AuthState>((set, get) => {
  const run = async (action: AuthAction, request: () => Promise<AuthUser | null>) => {
    if (get().pending) return false;
    set({ pending: action, error: null });
    try {
      const user = await request();
      set({ user, pending: null, error: null });
      return true;
    } catch (error) {
      set({
        ...(action === 'refresh' && { user: null }),
        pending: null,
        error: error instanceof Error ? error.message : '账户操作失败，请重试',
      });
      return false;
    }
  };

  return {
    user: null,
    pending: null,
    error: null,
    refreshUser: () => run('refresh', () => authService.me()),
    login: (credentials) => run('login', () => authService.login(credentials)),
    register: (credentials) => run('register', () => authService.register(credentials)),
    logout: () => run('logout', async () => {
      await authService.logout();
      return null;
    }),
    clearError: () => set({ error: null }),
  };
});
