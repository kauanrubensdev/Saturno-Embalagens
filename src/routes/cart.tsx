import { createFileRoute, Link } from '@tanstack/react-router';
import { CartItem } from '@/components/customer/CartItem';
import { CartSummary } from '@/components/customer/CartSummary';
import { Header } from '@/components/customer/Header';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/cart')({
  component: CartPage,
});

function CartPage() {
  const { user, authReady, loading: authLoading } = useAuth();
  const { cart, loading, error, getTotalItems } = useCart();
  const totalItems = getTotalItems();

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <div className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
          <div className="animate-pulse">
            <div className="h-8 w-48 rounded mb-8" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="w-20 h-20 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-3 w-1/4 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated - only show when auth is ready and no user
  if (!user && authReady) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <div className="max-w-5xl mx-auto px-4 py-16 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--primary)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Faça login para ver seu carrinho
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Acesse sua conta para visualizar e gerenciar os itens do seu carrinho.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Entrar
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
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <div className="max-w-5xl mx-auto px-4 py-16 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Erro ao carregar carrinho
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty cart
  if (totalItems === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <div className="max-w-5xl mx-auto px-4 py-16 flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
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
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Seu carrinho está vazio
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Adicione produtos ao carrinho para continuar.
            </p>
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Ver produtos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Cart with items
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          <Link to="/" className="no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>
            Início
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--foreground)' }}>Carrinho</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
          Carrinho de compras
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {cart?.items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <CartSummary />
            </div>
          </div>
        </div>
      </main>

      <footer
        className="border-t mt-12"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            © 2026 SaturnoEmbalagens. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
