import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getProfile, signIn, signOut, signUp, resetPassword, updateProfile } from '@/lib/auth';
import type { Profile, LoginData, RegisterData } from '@/types/auth';
import type { Session, User } from '@supabase/supabase-js';

// ============================================================
// AuthState — tipo do estado central de autenticação
// ============================================================
export interface AuthState {
  authReady: boolean;   // true quando a sessão inicial foi verificada
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (data: LoginData) => Promise<{ error: string | null; user: User | null; session: Session | null }>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<{ error: string | null }>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: typeof updateProfile;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

// ============================================================
// AuthContext — fonte única de verdade para toda a aplicação
// ============================================================
const AuthContext = createContext<AuthState | null>(null);

// ============================================================
// AuthProvider — envolve a aplicação
// ============================================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const activeSync = useRef(0);

  const applySession = useCallback(async (session: Session | null) => {
    const syncId = ++activeSync.current;
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setAuthReady(true);
      setLoading(false);
      return;
    }

    const authUser = session.user;
    setUser(authUser);
    const profileData = await getProfile(authUser.id);
    if (syncId !== activeSync.current) return;

    setProfile(profileData);

    setAuthReady(true);
    setLoading(false);
  }, []);

  // Inicialização — executa uma única vez
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void applySession(session);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  // Login — atualiza estado central
  const login = useCallback(async (data: LoginData) => {
    const result = await signIn(data);
    if (!result.error && result.session) {
      await applySession(result.session);
    }
    return result;
  }, [applySession]);

  // Logout — limpa estado central
  const logout = useCallback(async () => {
    await signOut();
    activeSync.current += 1;
    setUser(null);
    setProfile(null);
    setAuthReady(true);
    setLoading(false);
  }, []);

  // Refresh do profile
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await getProfile(user.id);
    setProfile(profileData);
  }, [user]);

  const register = useCallback(async (data: RegisterData) => {
    return await signUp(data);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    return await resetPassword(email);
  }, []);

  const isAdmin = profile?.role === 'admin';

  const state: AuthState = {
    authReady,
    user,
    profile,
    loading,
    login,
    logout,
    register,
    forgotPassword,
    refreshProfile,
    updateProfile,
    isAdmin,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// useAuth — hook usado por TODOS os componentes e rotas
// ============================================================
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

// ============================================================
// useAdminGuard — proteção da área administrativa
// ============================================================
export function useAdminGuard() {
  const { user, loading, isAdmin } = useAuth();
  return { user, loading, isAdmin, hasAccess: isAdmin };
}
