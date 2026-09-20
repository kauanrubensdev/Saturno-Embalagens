import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { CartBadge } from '@/components/customer/CartBadge';
import { ThemeToggle } from '@/components/customer/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/checkout')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) {
      return;
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const { authReady, user } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="animate-pulse text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: 'var(--foreground)' }}>
            Faça login para acessar o checkout
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full border-b shadow-sm"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
              SaturnoEmbalagens
            </span>
          </Link>
          <CartBadge />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <svg
              className="w-10 h-10"
              style={{ color: 'var(--primary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>
            Checkout em desenvolvimento
          </h1>

          <p className="text-base mb-8" style={{ color: 'var(--muted-foreground)' }}>
            A funcionalidade de checkout será implementada na próxima fase.
            <br />
            Você poderá finalizar suas compras com segurança e praticidade.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/cart"
              className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar ao carrinho
            </Link>

            <Link
              to="/catalog"
              className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              Continuar comprando
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            © 2025 SaturnoEmbalagens. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
