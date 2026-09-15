import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
    stock_quantity: number;
    category?: { name: string } | null;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const isAvailable = product.stock_quantity > 0;

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);

  return (
    <Link
      to="/product/$productSlug"
      params={{ productSlug: product.slug }}
      className="group block no-underline rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
      style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5' }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: '180px', backgroundColor: '#f5f5f5' }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12" style={{ color: '#d1d5db' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span className="text-white text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
              Esgotado
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        {product.category && (
          <p className="text-xs font-medium mb-1" style={{ color: '#FF6B00' }}>
            {product.category.name}
          </p>
        )}
        <h3 className="font-semibold text-sm md:text-base leading-tight mb-2 line-clamp-2" style={{ color: '#1a1a1a' }}>
          {product.name}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-bold text-base" style={{ color: '#1a1a1a' }}>
            {formattedPrice}
          </span>
          <span className="text-xs" style={{ color: isAvailable ? '#16a34a' : '#dc2626' }}>
            {isAvailable ? 'Disponível' : 'Esgotado'}
          </span>
        </div>
      </div>
    </Link>
  );
}
