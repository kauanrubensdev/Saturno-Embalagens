import { Link } from '@tanstack/react-router';
import { useCart } from '@/hooks/useCart';

export function CartSummary() {
  const { getSubtotal, getTotalItems, hasUnavailableItems } = useCart();
  const subtotal = getSubtotal();
  const totalItems = getTotalItems();

  const formattedSubtotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(subtotal);

  return (
    <div
      className="rounded-xl p-5 sm:p-6 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <h2 className="text-base sm:text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>
        Resumo do pedido
      </h2>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-xs sm:text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>
            Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})
          </span>
          <span className="font-medium" style={{ color: 'var(--foreground)' }}>
            {formattedSubtotal}
          </span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>Frete</span>
          <span style={{ color: 'var(--muted-foreground)' }}>Calculado no checkout</span>
        </div>
        <div className="border-t pt-3 flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold text-sm sm:text-base" style={{ color: 'var(--foreground)' }}>Total</span>
          <span className="font-bold text-lg sm:text-xl" style={{ color: 'var(--primary)' }}>
            {formattedSubtotal}
          </span>
        </div>
      </div>

      {hasUnavailableItems && (
        <div className="mb-4 p-3 rounded-xl text-xs flex items-start gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--destructive)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Remova os itens esgotados ou indisponíveis para prosseguir.</span>
        </div>
      )}

      {hasUnavailableItems ? (
        <button
          type="button"
          disabled
          className="w-full text-center py-3.5 px-4 rounded-xl font-semibold text-sm transition-all opacity-50 cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Finalizar compra
        </button>
      ) : (
        <Link
          to="/checkout"
          className="block w-full text-center py-3.5 px-4 rounded-xl font-semibold text-sm transition-all no-underline shadow-sm hover:opacity-90 active:scale-[0.99]"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Finalizar compra
        </Link>
      )}

      <Link
        to="/catalog"
        className="block w-full text-center py-2.5 px-4 mt-3 rounded-xl font-medium text-xs sm:text-sm transition-all no-underline border hover:opacity-80 active:scale-[0.99]"
        style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
      >
        Continuar comprando
      </Link>
    </div>
  );
}

