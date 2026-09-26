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
  const { cart, loading, error, getTotalItems, hasUnavailableItems, refetch } = useCart();
  const totalItems = getTotalItems();

  // 1. Loading state with faithful 2-column layout skeleton
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full animate-pulse">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-4 rounded-md w-16" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="h-4 rounded-md w-4" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="h-4 rounded-md w-24" style={{ backgroundColor: 'var(--muted)' }} />
          </div>

          <div className="h-8 w-56 rounded-lg mb-6" style={{ backgroundColor: 'var(--muted)' }} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Items Column */}
            <div className="lg:col-span-2 space-y-3">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className="flex gap-4 p-4 rounded-xl border" 
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-3 rounded w-1/4" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="flex flex-col justify-between items-end">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="w-20 h-6 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Column */}
            <div className="lg:col-span-1">
              <div className="p-6 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="h-5 rounded w-36" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between">
                    <div className="h-4 rounded w-24" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-4 rounded w-16" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 rounded w-16" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-4 rounded w-20" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <div className="h-5 rounded w-16" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-5 rounded w-20" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
                <div className="h-11 rounded-xl w-full pt-2" style={{ backgroundColor: 'var(--muted)' }} />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Not authenticated
  if (!user && authReady) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="max-w-5xl mx-auto px-4 py-16 flex-1 flex items-center justify-center w-full">
          <div 
            className="text-center max-w-md w-full p-8 rounded-2xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
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
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Faça login para ver seu carrinho
            </h1>
            <p className="text-xs sm:text-sm mb-6 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Acesse sua conta para visualizar seus itens salvos e finalizar suas compras.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 no-underline shadow-sm"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Entrar na conta
              </Link>
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-medium text-sm transition-all hover:opacity-80 active:scale-95 no-underline border"
                style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              >
                Explorar catálogo
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 3. Error state with localized retry
  if (error) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="max-w-5xl mx-auto px-4 py-16 flex-1 flex items-center justify-center w-full">
          <div 
            className="text-center max-w-md w-full p-8 rounded-2xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              <svg
                className="w-7 h-7 text-red-500"
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
              Erro ao carregar o carrinho
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Ocorreu uma instabilidade ao buscar os itens do seu carrinho.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-sm"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Tentar novamente
              </button>
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center py-2.5 px-5 rounded-xl font-medium text-sm no-underline border active:scale-95"
                style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              >
                Voltar ao catálogo
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 4. Empty cart state
  if (totalItems === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="max-w-5xl mx-auto px-4 py-16 flex-1 flex items-center justify-center w-full">
          <div 
            className="text-center max-w-md w-full p-8 rounded-2xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg
                className="w-10 h-10"
                style={{ color: 'var(--muted-foreground)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Seu carrinho está vazio
            </h1>
            <p className="text-xs sm:text-sm mb-6 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Explore nosso catálogo de embalagens e adicione os produtos ideais para o seu negócio.
            </p>
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 no-underline shadow-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Explorar produtos
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 5. Cart with items
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs sm:text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          <Link to="/" className="no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>
            Início
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--foreground)' }} className="font-medium">Carrinho</span>
        </nav>

        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Carrinho de compras
          </h1>
          <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Unavailable items alert banner */}
        {hasUnavailableItems && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3 border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: 'var(--destructive)' }}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold mb-0.5">Atenção ao estoque</p>
              <p className="text-xs leading-relaxed opacity-90">
                Alguns itens no seu carrinho estão esgotados ou indisponíveis no momento. Por favor, remova-os para habilitar a finalização da compra.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-3">
            {cart?.items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <CartSummary />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Local Footer Component
function Footer() {
  return (
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
  );
}

