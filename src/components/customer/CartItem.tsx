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

  const subtotal = item.product.price * item.quantity;
  const formattedSubtotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(subtotal);

  const handleIncrease = async () => {
    if (updating) return;
    setUpdating(true);
    await updateQuantity(item.id, item.quantity + 1);
    setUpdating(false);
  };

  const handleDecrease = async () => {
    if (updating || item.quantity <= 1) return;
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

  const isOutOfStock = item.product.stock_quantity <= 0;

  return (
    <div
      className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Image */}
      <Link
        to="/product/$productSlug"
        params={{ productSlug: item.product.slug }}
        className="flex-shrink-0 rounded-lg overflow-hidden no-underline w-16 h-16 sm:w-20 sm:h-20"
        style={{ backgroundColor: 'var(--muted)' }}
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
      <div className="flex-1 min-w-0">
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

        {isOutOfStock && (
          <p className="text-xs font-medium mt-1" style={{ color: 'var(--destructive)' }}>
            Esgotado
          </p>
        )}
      </div>

      {/* Quantity Controls */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <button
          onClick={handleRemove}
          disabled={updating}
          className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
          title="Remover"
        >
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            style={{ color: 'var(--muted-foreground)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleDecrease}
            disabled={updating || item.quantity <= 1 || isOutOfStock}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
          >
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span
            className="w-6 sm:w-8 text-center text-xs sm:text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            {item.quantity}
          </span>
          <button
            onClick={handleIncrease}
            disabled={updating || item.quantity >= item.product.stock_quantity || isOutOfStock}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
          >
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <span className="font-semibold text-xs sm:text-sm" style={{ color: 'var(--foreground)' }}>
          {formattedSubtotal}
        </span>
      </div>
    </div>
  );
}
