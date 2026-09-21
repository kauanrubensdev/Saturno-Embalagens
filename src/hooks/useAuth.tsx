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

  // ----------------------------------------------------------
  // Carregamento do profile — controlado pelo user atual.
  // Executa sempre que user muda, garantindo que profile e
  // authReady fiquem consistentes com o user.
  // ----------------------------------------------------------
  useEffect(() => {
    const syncId = ++activeSync.current;

    if (!user) {
      setProfile(null);
      setAuthReady(true);
      setLoading(false);
      return;
    }

    // Usuário existe — carrega o profile
    setProfile(null);
    setAuthReady(false);
    setLoading(true);

    getProfile(user.id).then((profileData) => {
      if (syncId !== activeSync.current) return;
      setProfile(profileData);
      setAuthReady(true);
      setLoading(false);
    });
  }, [user]);

  // ----------------------------------------------------------
  // Inicialização — getSession uma única vez + onAuthStateChange
  // O callback onAuthStateChange apenas atualiza user de forma
  // síncrona; o useEffect acima cuida do profile.
  // ----------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      // O useEffect de [user] cuidará de setAuthReady e setProfile
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;

      if (event === 'SIGNED_OUT') {
        // Sinaliza que a sessão foi invalidada; o useEffect de [user]
        // vai detectar user=null e limpar tudo.
        activeSync.current += 1;
        setUser(null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Atualiza apenas o user de forma síncrona.
        // O useEffect de [user] cuidará do profile e authReady.
        setUser(sessionUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login — atualiza estado central via setUser (onAuthStateChange também dispara)
  const login = useCallback(async (data: LoginData) => {
    const result = await signIn(data);
    // Não duplicamos a sincronização da sessão aqui.
    // O onAuthStateChange (SIGNED_IN) já atualiza user via setUser,
    // e o useEffect de [user] carrega o profile.
    return result;
  }, []);

  // Logout — limpa estado central
  const logout = useCallback(async () => {
    await signOut();
    activeSync.current += 1;
    setUser(null);
    // O useEffect de [user] vai detectar user=null e limpar profile/authReady
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
