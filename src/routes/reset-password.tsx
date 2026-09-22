import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
  const [success, setSuccess] = useState(false);

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
        setError(updateError.message);
      } else {
        setSuccess(true);
        toast.success('Senha redefinida com sucesso!');
        setTimeout(() => {
          navigate({ to: '/login' });
        }, 2000);
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: 'var(--primary)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
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
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Senha alterada!</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Sua senha foi redefinida com sucesso. Redirecionando para o login...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg py-2.5 px-6 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)', border: '1px solid var(--destructive)' }}>
                  {error}
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
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
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
                  placeholder="Repita a nova senha"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
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
