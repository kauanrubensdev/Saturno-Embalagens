import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { signIn } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidateRouter } from '@/router';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (context.user) {
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
    console.info('[AUTH-1] handleSubmit iniciado');
    setLoading(true);
    try {
      const result = await signIn({ email, password });
      console.info('[AUTH-4] user existe?', Boolean(result.user));
      console.info('[AUTH-5] session existe?', Boolean(result.session));
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.info('[AUTH-DIAG] getSession', {
        'getSession error': sessionError?.message ?? null,
        'getSession session': Boolean(sessionData.session),
        'getSession user': sessionData.session?.user.id ?? null,
      });

      console.info('[AUTH-6] refreshProfile iniciado');
      await refreshProfile();
      console.info('[AUTH-7] refreshProfile terminou');

      const authenticatedUserId = result.user?.id;
      const profileResult = authenticatedUserId
        ? await supabase
            .from('profiles')
            .select('*')
            .eq('id', authenticatedUserId)
            .single()
        : { data: null, error: null };

      console.info('[AUTH-8] profile existe?', Boolean(profileResult.data));
      console.info('[AUTH-9] role', profileResult.data?.role ?? null);
      console.info('[AUTH-DIAG] profile', {
        'profile encontrado': Boolean(profileResult.data),
        'profile id': profileResult.data?.id ?? null,
        'profile role': profileResult.data?.role ?? null,
        'profile error': profileResult.error?.message ?? null,
      });

      // Invalida o router para forçar re-execução do beforeLoad do root,
      // que vai popular context.user com a sessão recém-criada.
      console.info('[AUTH-INVALIDATE] invalidateRouter');
      invalidateRouter();

      const destination = profileResult.data?.role === 'admin' ? '/admin' : '/account';
      console.info('[AUTH-10] navegação para /account iniciada', { destination });
      await navigate({
        to: destination,
        replace: true,
      });
      console.info('[AUTH-14] navegação concluída', { destination: window.location.pathname });
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
