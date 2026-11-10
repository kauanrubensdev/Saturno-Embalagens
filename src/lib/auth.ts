import { supabase } from '@/integrations/supabase/client';
import type { Profile, LoginData, RegisterData } from '@/types/auth';
import type { Session, User } from '@supabase/supabase-js';

// ============================================================
// Helper: obtém profile do usuário autenticado
// ============================================================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!error && data) return data as Profile;

  // Se for nulo logo após cadastro ou OAuth, aguarda 500ms e tenta mais uma vez
  // para permitir que o trigger de criação do profile finalize a execução
  await new Promise((resolve) => setTimeout(resolve, 500));
  const retry = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (retry.error || !retry.data) return null;
  return retry.data as Profile;
}

// ============================================================
// Login por e-mail e senha
// ============================================================
export async function signIn({ email, password }: LoginData): Promise<{
  error: string | null;
  user: User | null;
  session: Session | null;
}> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message, user: data.user, session: data.session };
  return { error: null, user: data.user, session: data.session };
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
// Helper: URL de redirecionamento segura para Auth
// ============================================================
export function getAuthRedirectUrl(path: string = '/reset-password'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    // Em desenvolvimento local, preserva o host e porta locais
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return `${origin}${cleanPath}`;
    }
  }

  // Em produção ou SSR, redireciona sempre para o domínio oficial da Vercel
  return `https://saturno-embalagens.vercel.app${cleanPath}`;
}

// ============================================================
// Helper: Formata mensagens de erro de autenticação em português
// ============================================================
export function formatAuthErrorMessage(error: string, errorDescription?: string): string {
  const combined = `${error} ${errorDescription || ''}`.toLowerCase();

  if (
    combined.includes('access_denied') ||
    combined.includes('user denied') ||
    combined.includes('consent') ||
    combined.includes('cancelled') ||
    combined.includes('canceled')
  ) {
    return 'O login com o Google foi cancelado.';
  }

  if (
    combined.includes('identity_already_exists') ||
    combined.includes('user already registered') ||
    combined.includes('email address already in use')
  ) {
    return 'Este e-mail já está cadastrado. Faça login com sua senha ou redefina-a.';
  }

  if (
    combined.includes('exchange_code') ||
    combined.includes('invalid_grant') ||
    combined.includes('pkce') ||
    combined.includes('bad_code_verifier')
  ) {
    return 'A sessão de autenticação expirou. Por favor, tente entrar com o Google novamente.';
  }

  if (combined.includes('popup_closed') || combined.includes('closed by user')) {
    return 'A janela de autenticação foi fechada antes de concluir.';
  }

  if (combined.includes('provider_disabled') || combined.includes('not enabled')) {
    return 'O provedor Google não está habilitado nas configurações do Supabase.';
  }

  if (combined.includes('network') || combined.includes('failed to fetch')) {
    return 'Erro de conexão com os servidores. Verifique sua internet e tente novamente.';
  }

  if (errorDescription && errorDescription.trim() !== '') {
    return errorDescription;
  }

  return error || 'Não foi possível concluir o login com o Google. Tente novamente.';
}

// ============================================================
// Login com Google (OAuth)
// ============================================================
export async function signInWithGoogle(redirectTo?: string): Promise<{ error: string | null }> {
  try {
    const targetRedirectUrl = redirectTo || getAuthRedirectUrl('/login');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: targetRedirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return { error: formatAuthErrorMessage(error.message) };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao conectar com o Google';
    return { error: formatAuthErrorMessage(message) };
  }
}

// ============================================================
// Helper: Extrai erros de OAuth da URL (search e hash)
// ============================================================
export function extractAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashString);

    const error =
      searchParams.get('error') ||
      hashParams.get('error') ||
      searchParams.get('error_code') ||
      hashParams.get('error_code');

    const errorDescription =
      searchParams.get('error_description') ||
      hashParams.get('error_description');

    if (!error && !errorDescription) return null;

    return formatAuthErrorMessage(error || '', errorDescription || '');
  } catch {
    return null;
  }
}

// ============================================================
// Helper: Limpa parâmetros de erro de OAuth da URL sem reload
// ============================================================
export function clearAuthUrlParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    if (url.hash.includes('error')) {
      url.hash = '';
    }
    const cleanSearch = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
    window.history.replaceState({}, document.title, url.pathname + cleanSearch + (url.hash || ''));
  } catch {
    // Silencioso em caso de restrição do navegador
  }
}

// ============================================================
// Recuperação de senha
// ============================================================
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const redirectTo = getAuthRedirectUrl('/reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
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

  const profileUpdates = {
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
  };

  const { error } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', user.id);

  if (error) return { error: error.message };
  return { error: null };
}
