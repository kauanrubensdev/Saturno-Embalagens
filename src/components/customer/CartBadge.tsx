import { Link } from '@tanstack/react-router';
import { useCart } from '@/hooks/useCart';

export function CartBadge() {
  const { getTotalItems, loading } = useCart();
  const totalItems = getTotalItems();

  if (loading) {
    return (
      <Link
        to="/cart"
        className="relative p-2 rounded-lg transition-colors hover:bg-gray-100"
      >
        <svg
          className="w-5 h-5"
          style={{ color: '#1a1a1a' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      to="/cart"
      className="relative p-2 rounded-lg transition-colors hover:bg-gray-100"
    >
      <svg
        className="w-5 h-5"
        style={{ color: '#1a1a1a' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {totalItems > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: '#FF6B00' }}
        >
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Link>
  );
}
