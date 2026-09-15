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
      className="flex gap-4 p-4 rounded-xl transition-all"
      style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5' }}
    >
      {/* Image */}
      <Link
        to="/product/$productSlug"
        params={{ productSlug: item.product.slug }}
        className="flex-shrink-0 rounded-lg overflow-hidden no-underline"
        style={{ width: '80px', height: '80px', backgroundColor: '#f5f5f5' }}
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
              className="w-8 h-8"
              style={{ color: '#d1d5db' }}
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
          className="font-semibold text-sm no-underline transition-colors hover:opacity-80 line-clamp-2"
          style={{ color: '#1a1a1a' }}
        >
          {item.product.name}
        </Link>
        <p className="text-sm mt-0.5" style={{ color: '#666666' }}>
          {formattedPrice} un
        </p>

        {isOutOfStock && (
          <p className="text-xs font-medium mt-1" style={{ color: '#dc2626' }}>
            Esgotado
          </p>
        )}
      </div>

      {/* Quantity Controls */}
      <div className="flex flex-col items-end justify-between">
        <button
          onClick={handleRemove}
          disabled={updating}
          className="p-1 rounded transition-colors hover:bg-gray-100 disabled:opacity-50"
          title="Remover"
        >
          <svg
            className="w-4 h-4"
            style={{ color: '#999999' }}
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

        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrease}
            disabled={updating || item.quantity <= 1 || isOutOfStock}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span
            className="w-8 text-center text-sm font-medium"
            style={{ color: '#1a1a1a' }}
          >
            {item.quantity}
          </span>
          <button
            onClick={handleIncrease}
            disabled={updating || item.quantity >= item.product.stock_quantity || isOutOfStock}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <span className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>
          {formattedSubtotal}
        </span>
      </div>
    </div>
  );
}
