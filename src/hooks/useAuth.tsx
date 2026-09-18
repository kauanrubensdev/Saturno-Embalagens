import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getProfile, signIn, signOut, signUp, resetPassword, updateProfile } from '@/lib/auth';
import type { AuthUser, Profile, LoginData, RegisterData } from '@/types/auth';
import type { User } from '@supabase/supabase-js';

// ============================================================
// AuthState — tipo do estado central de autenticação
// ============================================================
interface AuthState {
  authReady: boolean;   // true quando a sessão inicial foi verificada
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  login: (data: LoginData) => Promise<{ error: string | null; user: User | null; session: unknown }>;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega user + profile uma única vez
  const loadUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setAuthReady(true);
      setLoading(false);
      return;
    }

    const authUser = session.user;
    const profileData = await getProfile();

    if (profileData) {
      setUser({
        id: authUser.id,
        email: authUser.email ?? '',
        name: profileData.name,
        role: profileData.role as 'customer' | 'admin',
        ...(profileData.phone ? { phone: profileData.phone } : {}),
      });
      setProfile(profileData);
    } else {
      setUser(null);
      setProfile(null);
    }

    setAuthReady(true);
    setLoading(false);
  }, []);

  // Inicialização — executa uma única vez
  useEffect(() => {
    loadUser();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        await loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  // Login — atualiza estado central
  const login = useCallback(async (data: LoginData) => {
    const result = await signIn(data);
    if (!result.error) {
      await loadUser();
    }
    return result;
  }, [loadUser]);

  // Logout — limpa estado central
  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setProfile(null);
  }, []);

  // Refresh do profile
  const refreshProfile = useCallback(async () => {
    const profileData = await getProfile();
    setProfile(profileData);
    if (profileData) {
      setUser((prev) => prev ? { ...prev, name: profileData.name, role: profileData.role as 'customer' | 'admin' } : prev);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    return await signUp(data);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    return await resetPassword(email);
  }, []);

  const isAdmin = user?.role === 'admin';

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
// useAuthCallback — autentica componente antes de renderizar
// ============================================================
export function useAuthCallback() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        getProfile().then((profile) => {
          if (profile) {
            setAuthUser({
              id: session.user.id,
              email: session.user.email ?? '',
              name: profile.name,
              role: profile.role as 'customer' | 'admin',
            });
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  return { authUser, loading };
}

// ============================================================
// useAdminGuard — proteção da área administrativa
// ============================================================
export function useAdminGuard() {
  const { user, loading, isAdmin } = useAuth();
  return { user, loading, isAdmin, hasAccess: isAdmin };
}
