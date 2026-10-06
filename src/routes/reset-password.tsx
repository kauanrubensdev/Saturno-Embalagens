import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // 1. Detectar se o Supabase redirecionou com erro de link expirado/inválido
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : '');
      const searchParams = new URLSearchParams(search);

      const errorParam = hashParams.get('error') || searchParams.get('error');
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

      if (errorParam || errorCode || errorDesc) {
        setIsTokenInvalid(true);
        if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
          setError('O link de recuperação expirou ou já foi utilizado. Por favor, solicite um novo link.');
        } else {
          setError('O link de recuperação é inválido. Por favor, solicite um novo link de redefinição.');
        }
        return;
      }
    }

    // 2. Monitorar evento oficial de PASSWORD_RECOVERY do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setError(null);
        setIsTokenInvalid(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        const raw = updateError.message || '';
        const lower = raw.toLowerCase();

        if (lower.includes('session') || lower.includes('auth session missing')) {
          setIsTokenInvalid(true);
          setError('Sessão expirada ou link inválido. Por favor, solicite um novo link de recuperação.');
        } else if (lower.includes('different from the old password')) {
          setError('A nova senha deve ser diferente da senha anterior.');
        } else if (lower.includes('at least 6 characters') || lower.includes('weak_password')) {
          setError('A senha deve ter pelo menos 6 caracteres.');
        } else {
          setError(raw || 'Erro ao redefinir a senha.');
        }
      } else {
        setSuccess(true);
        toast.success('Senha alterada com sucesso!');

        // Encerra a sessão temporária para permitir login limpo com a nova senha
        await supabase.auth.signOut().catch(() => {});

        setTimeout(() => {
          navigate({ to: '/login' });
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/favicon.png"
            alt="Saturno Embalagens"
            className="w-16 h-16 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Redefinir senha</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>Digite sua nova senha de acesso</p>
        </div>

        <div className="rounded-2xl shadow-lg p-6 sm:p-8" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--muted)' }}>
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Senha alterada com sucesso!</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Sua senha foi redefinida com sucesso. Redirecionando para o login...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg py-2.5 px-6 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg p-3 text-sm space-y-2" style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)', border: '1px solid var(--destructive)' }}>
                  <p>{error}</p>
                  {isTokenInvalid && (
                    <div className="pt-1">
                      <Link
                        to="/forgot-password"
                        className="font-medium underline transition-opacity hover:opacity-80 text-xs"
                        style={{ color: 'var(--primary)' }}
                      >
                        Solicitar novo link de recuperação →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Nova senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isTokenInvalid || loading}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  disabled={isTokenInvalid || loading}
                  placeholder="Repita a nova senha"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || isTokenInvalid}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 mt-2"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--muted-foreground)' }}>
          <Link to="/login" className="font-semibold transition-colors hover:underline" style={{ color: 'var(--primary)' }}>
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
