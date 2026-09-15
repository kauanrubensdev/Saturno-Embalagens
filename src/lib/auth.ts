import { supabase } from '@/integrations/supabase/client';
import type { AuthUser, Profile, LoginData, RegisterData } from '@/types/auth';

// ============================================================
// Helper: obtém profile do usuário autenticado
// ============================================================
export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

// ============================================================
// Helper: obtém usuário autenticado com profile
// ============================================================
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    phone: profile.phone ?? undefined,
    role: profile.role as 'customer' | 'admin',
  };
}

// ============================================================
// Login por e-mail e senha
// ============================================================
export async function signIn({ email, password }: LoginData): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

// ============================================================
// Cadastro de novo usuário
// ============================================================
export async function signUp({ name, email, phone, password }: RegisterData): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone },
    },
  });

  if (error) return { error: error.message };

  // O trigger handle_new_user() cria o profile automaticamente com role='customer'
  return { error: null };
}

// ============================================================
// Logout
// ============================================================
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ============================================================
// Recuperação de senha
// ============================================================
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// ============================================================
// Atualizar perfil
// ============================================================
export async function updateProfile(updates: { name?: string; phone?: string }): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Usuário não autenticado' };

  const { error } = await supabase
    .from('profiles')
    .update({ name: updates.name, phone: updates.phone })
    .eq('id', user.id);

  if (error) return { error: error.message };
  return { error: null };
}

// ============================================================
// Verificar se o usuário atual é admin (via RLS — server-side)
// ============================================================
export async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === 'admin';
}
