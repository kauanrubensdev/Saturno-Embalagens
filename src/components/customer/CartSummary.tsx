import { Link } from '@tanstack/react-router';
import { useCart } from '@/hooks/useCart';

export function CartSummary() {
  const { getSubtotal, getTotalItems } = useCart();
  const subtotal = getSubtotal();
  const totalItems = getTotalItems();

  const formattedSubtotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(subtotal);

  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5' }}
    >
      <h2 className="text-lg font-bold mb-4" style={{ color: '#1a1a1a' }}>
        Resumo do pedido
      </h2>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span style={{ color: '#666666' }}>Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
          <span style={{ color: '#1a1a1a' }}>{formattedSubtotal}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#666666' }}>Frete</span>
          <span style={{ color: '#666666' }}>Calculado no checkout</span>
        </div>
        <div className="border-t pt-3 flex justify-between">
          <span className="font-semibold" style={{ color: '#1a1a1a' }}>Total</span>
          <span className="font-bold text-lg" style={{ color: '#1a1a1a' }}>{formattedSubtotal}</span>
        </div>
      </div>

      <Link
        to="/checkout"
        className="block w-full text-center py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
        style={{ backgroundColor: '#FF6B00' }}
      >
        Ir para checkout
      </Link>

      <Link
        to="/catalog"
        className="block w-full text-center py-2.5 mt-3 rounded-xl font-medium transition-all hover:opacity-80"
        style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}
      >
        Continuar comprando
      </Link>
    </div>
  );
}
