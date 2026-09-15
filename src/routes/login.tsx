import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUser, signIn } from '@/lib/auth';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const { user } = context as { user?: { id: string } | null };
    if (user) {
      throw redirect({ to: '/account' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn({ email, password });
      if (result.error) {
        toast.error(result.error);
      } else {
        await refreshProfile();
        const currentUser = await getCurrentUser();
        if (currentUser?.role === 'admin') {
          navigate({ to: '/admin' });
        } else {
          navigate({ to: '/' });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#fcfbf8' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10" style={{ backgroundColor: '#001621' }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FF4103' }}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-xl text-white">SaturnoEmbalagens</span>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Embalagens industriais<br />de alta qualidade</h1>
          <p className="text-lg" style={{ color: '#94a3b8' }}>Soluções completas para seu negócio</p>
        </div>
        <p className="text-sm" style={{ color: '#64748b' }}>© 2025 SaturnoEmbalagens</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FF6B00' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ color: '#1a1a1a' }}>SaturnoEmbalagens</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a1a1a' }}>Entrar</h2>
          <p className="text-sm mb-8" style={{ color: '#666666' }}>
            Não tem conta?{' '}
            <Link to="/register" className="font-medium no-underline transition-colors" style={{ color: '#FF6B00' }}>
              Cadastre-se
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a1a1a' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#1a1a1a' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a1a1a' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#1a1a1a' }}
              />
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                search={{}}
                className="text-sm font-medium no-underline transition-colors"
                style={{ color: '#FF6B00' }}
              >
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#FF6B00' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: '#999999' }}>
            Não tem conta?{' '}
            <Link to="/register" className="font-medium no-underline" style={{ color: '#FF6B00' }}>
              Cadastre-se aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
