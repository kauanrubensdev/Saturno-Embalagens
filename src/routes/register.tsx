import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { getAuthRedirectUrl, extractAuthErrorFromUrl, clearAuthUrlParams } from '@/lib/auth';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/register')({
  beforeLoad: async ({ context }) => {
    if (context.auth?.authReady && context.auth?.user) {
      if (context.auth?.profile?.role === 'admin') {
        throw redirect({ to: '/admin' });
      } else {
        throw redirect({ to: '/' });
      }
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  const { register, loginWithGoogle, authReady, user, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Trata erros de OAuth ou cancelamentos retornados na URL
  useEffect(() => {
    const errorMsg = extractAuthErrorFromUrl();
    if (errorMsg) {
      toast.error(errorMsg);
      clearAuthUrlParams();
    }
  }, []);

  // Redireciona usuário autenticado (incluindo retorno do OAuth)
  useEffect(() => {
    if (authReady && user) {
      const pendingBuyNow = typeof window !== 'undefined' ? sessionStorage.getItem('saturno_buy_now') : null;
      if (pendingBuyNow) {
        void navigate({ to: '/checkout', replace: true });
      } else if (profile?.role === 'admin') {
        void navigate({ to: '/admin', replace: true });
      } else {
        void navigate({ to: '/', replace: true });
      }
    }
  }, [authReady, user, profile?.role, navigate]);

  const handleGoogleLogin = async () => {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle(getAuthRedirectUrl('/login'));
      if (result.error) {
        toast.error(result.error);
        setGoogleLoading(false);
      }
      // Se não houver erro, a Supabase redireciona o browser para o Google
    } catch {
      toast.error('Não foi possível conectar ao Google. Tente novamente.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading) return;
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
    const result = await register({ name, email, phone, password, passwordConfirm });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/favicon.png"
            alt="Saturno Embalagens"
            className="w-16 h-16 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Crie sua conta</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>Saturno Embalagens</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl shadow-lg p-6 sm:p-8" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          {success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--muted)' }}>
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Conta criada!</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
                Verifique seu e-mail para confirmar sua conta.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg py-2.5 px-6 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Fazer login
              </Link>
            </div>
          ) : (
            <>
              {/* Botão Google */}
              <GoogleButton
                onClick={handleGoogleLogin}
                loading={googleLoading}
                disabled={loading || googleLoading}
              />

              {/* Divisor visual */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: 'var(--border)' }} />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="px-3 text-xs" style={{ backgroundColor: 'var(--card)', color: 'var(--muted-foreground)' }}>
                    ou preencha seus dados
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)', border: '1px solid var(--destructive)' }}>
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    placeholder="Seu nome"
                    className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    placeholder="(31) 99999-9999"
                    className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading || googleLoading}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading || googleLoading}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-10 transition-opacity hover:opacity-70 disabled:opacity-50"
                      style={{ color: 'var(--muted-foreground)' }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      disabled={loading || googleLoading}
                      placeholder="Repita a senha"
                      className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm((v) => !v)}
                      disabled={loading || googleLoading}
                      aria-label={showPasswordConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                      title={showPasswordConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-10 transition-opacity hover:opacity-70 disabled:opacity-50"
                      style={{ color: 'var(--muted-foreground)' }}
                      tabIndex={-1}
                    >
                      {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 mt-2 cursor-pointer disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {loading ? 'Criando conta...' : 'Criar conta'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--muted-foreground)' }}>
          Já tem uma conta?{' '}
          <Link to="/login" className="font-semibold transition-colors hover:underline" style={{ color: 'var(--primary)' }}>
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
}
