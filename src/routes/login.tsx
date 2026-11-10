import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { getAuthRedirectUrl, extractAuthErrorFromUrl, clearAuthUrlParams } from '@/lib/auth';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (context.auth?.authReady && context.auth?.user) {
      if (context.auth?.profile?.role === 'admin') {
        throw redirect({ to: '/admin' });
      } else {
        throw redirect({ to: '/' });
      }
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { login, loginWithGoogle, authReady, user, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Se houver uma compra direta pendente ("Comprar Agora"), redireciona ao checkout
      const pendingBuyNow = typeof window !== 'undefined' ? sessionStorage.getItem('saturno_buy_now') : null;
      if (pendingBuyNow) {
        await navigate({ to: '/checkout', replace: true });
      } else {
        await navigate({ to: '/', replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--background)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10" style={{ backgroundColor: 'var(--background)' }}>
        <div>
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Saturno Embalagens" className="w-10 h-10 object-contain" />
            <span className="font-bold text-xl text-white">SaturnoEmbalagens</span>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Embalagens industriais<br />de alta qualidade</h1>
          <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>Soluções completas para seu negócio</p>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>© 2025 SaturnoEmbalagens</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/favicon.png" alt="Saturno Embalagens" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Entrar</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Não tem conta?{' '}
            <Link to="/register" className="font-medium no-underline transition-colors" style={{ color: 'var(--primary)' }}>
              Cadastre-se
            </Link>
          </p>

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
              <span className="px-3" style={{ backgroundColor: 'var(--background)', color: 'var(--muted-foreground)' }}>
                ou entre com e-mail
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
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
                  placeholder="••••••••"
                  className="w-full h-11 px-4 pr-11 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading || googleLoading}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-11 transition-opacity hover:opacity-70 disabled:opacity-50"
                  style={{ color: 'var(--muted-foreground)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                search={{}}
                className="text-sm font-medium no-underline transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full h-11 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--muted-foreground)' }}>
            Não tem conta?{' '}
            <Link to="/register" className="font-medium no-underline" style={{ color: 'var(--primary)' }}>
              Cadastre-se aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
