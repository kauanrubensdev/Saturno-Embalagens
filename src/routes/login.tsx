import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (context.auth?.user) {
      throw redirect({ to: context.auth.isAdmin ? '/admin' : '/' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Aguarda o próximo render para que authReady + user + profile
      // estejam atualizados no estado React antes de navegar.
      // O destino é decidido pelo role do profile, não /account por padrão.
      // Pequeno delay para o onAuthStateChange do AuthProvider executar.
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Lê o role atualizado via navigate via state, pois após login
      // o useAuth state já tem user + profile atualizados.
      // Passamos null como destination e deixamos o AuthProvider decidir
      // via redirect no app entry.
      // Para destino correto, navegamos para home (que lê auth e mostra a UI correta).
      await navigate({ to: '/', replace: true });
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Entrar</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
            Não tem conta?{' '}
            <Link to="/register" className="font-medium no-underline transition-colors" style={{ color: 'var(--primary)' }}>
              Cadastre-se
            </Link>
          </p>

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
                placeholder="seu@email.com"
                className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
              />
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
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
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
