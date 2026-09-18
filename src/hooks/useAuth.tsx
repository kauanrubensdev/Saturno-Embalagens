import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser, getProfile, signIn, signOut, signUp, resetPassword, updateProfile } from '@/lib/auth';
import type { AuthUser, Profile, LoginData, RegisterData } from '@/types/auth';
import type { User } from '@supabase/supabase-js';

// ============================================================
// useAuth — hook principal de autenticação
// ============================================================
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const loadUser = useCallback(async () => {
    const authUser = await getCurrentUser();
    setUser(authUser);
    const profileData = await getProfile();
    setProfile(profileData);
  }, []);

  useEffect(() => {
    if (initialized) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser();
      }
      setLoading(false);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, [initialized, loadUser]);

  const login = useCallback(async (data: LoginData) => {
    const result = await signIn(data);
    if (!result.error) await loadUser();
    return result;
  }, [loadUser]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    return await signUp(data);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    return await resetPassword(email);
  }, []);

  const refreshProfile = useCallback(async () => {
    console.info('[ACCOUNT-REFRESH] refreshProfile chamado');
    const authUser = await getCurrentUser();
    setUser(authUser);
    const profileData = await getProfile();
    console.info('[ACCOUNT-REFRESH] profile carregado', profileData?.id ?? null);
    setProfile(profileData);
  }, []);

  const isAdmin = user?.role === 'admin';

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    login,
    logout,
    register,
    forgotPassword,
    refreshProfile,
    updateProfile,
  };
}

// ============================================================
// useAuthCallback — autentica componente antes de renderizar
// ============================================================
export function useAuthCallback() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((user) => {
      setAuthUser(user);
      setLoading(false);
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
