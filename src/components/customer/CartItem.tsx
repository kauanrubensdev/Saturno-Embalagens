import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useCart } from '@/hooks/useCart';

interface CartItemProps {
  item: {
    id: string;
    product_id: string;
    quantity: number;
    product: {
      id: string;
      name: string;
      slug: string;
      price: number;
      image_url: string | null;
      stock_quantity: number;
      is_active: boolean;
    };
  };
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const [updating, setUpdating] = useState(false);

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(item.product.price);

  const isOutOfStock = item.product.stock_quantity <= 0;
  const isInactive = !item.product.is_active;
  const isUnavailable = isOutOfStock || isInactive;

  const subtotal = isUnavailable ? 0 : item.product.price * item.quantity;
  const formattedSubtotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(subtotal);

  const handleIncrease = async () => {
    if (updating || isUnavailable || item.quantity >= item.product.stock_quantity) return;
    setUpdating(true);
    await updateQuantity(item.id, item.quantity + 1);
    setUpdating(false);
  };

  const handleDecrease = async () => {
    if (updating || isUnavailable || item.quantity <= 1) return;
    setUpdating(true);
    await updateQuantity(item.id, item.quantity - 1);
    setUpdating(false);
  };

  const handleRemove = async () => {
    if (updating) return;
    setUpdating(true);
    await removeItem(item.id);
    setUpdating(false);
  };

  return (
    <div
      className="flex gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl transition-all relative"
      style={{ 
        backgroundColor: 'var(--card)', 
        border: '1px solid ' + (isUnavailable ? 'rgba(239, 68, 68, 0.4)' : 'var(--border)')
      }}
    >
      {/* Image */}
      <Link
        to="/product/$productSlug"
        params={{ productSlug: item.product.slug }}
        className="flex-shrink-0 rounded-lg overflow-hidden no-underline w-16 h-16 sm:w-20 sm:h-20 border"
        style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
      >
        {item.product.image_url ? (
          <img
            src={item.product.image_url}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8"
              style={{ color: 'var(--muted-foreground)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 pr-2">
        <Link
          to="/product/$productSlug"
          params={{ productSlug: item.product.slug }}
          className="font-semibold text-xs sm:text-sm no-underline transition-colors hover:opacity-80 line-clamp-2"
          style={{ color: 'var(--foreground)' }}
        >
          {item.product.name}
        </Link>
        
        <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {formattedPrice} un
        </p>

        {isInactive ? (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--destructive)' }}>
            Produto indisponível
          </span>
        ) : isOutOfStock ? (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--destructive)' }}>
            Esgotado no momento
          </span>
        ) : item.product.stock_quantity <= 5 ? (
          <span className="inline-flex items-center gap-1 mt-1 text-[11px]" style={{ color: '#ca8a04' }}>
            Apenas {item.product.stock_quantity} em estoque
          </span>
        ) : null}
      </div>

      {/* Quantity & Actions */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <button
          type="button"
          onClick={handleRemove}
          disabled={updating}
          className="p-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50 cursor-pointer active:scale-95"
          style={{ color: 'var(--muted-foreground)' }}
          title="Remover item do carrinho"
          aria-label="Remover item"
        >
          {updating ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 hover:text-red-500 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>

        {isUnavailable ? (
          <span className="text-xs font-semibold" style={{ color: 'var(--destructive)' }}>
            Indisponível
          </span>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleDecrease}
              disabled={updating || item.quantity <= 1 || isUnavailable}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 border"
              style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              aria-label="Diminuir quantidade"
            >
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <span
              className="w-6 sm:w-8 text-center text-xs sm:text-sm font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={handleIncrease}
              disabled={updating || item.quantity >= item.product.stock_quantity || isUnavailable}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 border"
              style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              aria-label="Aumentar quantidade"
            >
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}

        <span className="font-bold text-xs sm:text-sm" style={{ color: isUnavailable ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
          {isUnavailable ? 'R$ 0,00' : formattedSubtotal}
        </span>
      </div>
    </div>
  );
}

