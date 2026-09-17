import { Link } from '@tanstack/react-router';

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
  const isAvailable = product.stock_quantity > 0;

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);

  return (
    <Link
      to="/product/$productSlug"
      params={{ productSlug: product.slug }}
      className="group block no-underline rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
      style={{ 
        backgroundColor: 'var(--card)', 
        border: '1px solid var(--border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Image Container */}
      <div 
        className="relative overflow-hidden" 
        style={{ 
          aspectRatio: '4/3', 
          backgroundColor: 'var(--muted)' 
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--muted)' }}>
            <svg 
              className="w-14 h-14" 
              style={{ color: 'var(--muted-foreground)' }} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={1}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
              />
            </svg>
          </div>
        )}

        {/* Availability Badge */}
        <div className="absolute top-3 right-3">
          {isAvailable ? (
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ 
                backgroundColor: 'rgba(22, 163, 74, 0.9)',
                color: '#ffffff'
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Disponível
            </span>
          ) : (
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ 
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                color: '#ffffff'
              }}
            >
              Esgotado
            </span>
          )}
        </div>

        {/* Category Badge */}
        {product.category && (
          <div className="absolute bottom-3 left-3">
            <span 
              className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                opacity: 0.9
              }}
            >
              {product.category.name}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 
          className="font-semibold text-sm md:text-base leading-snug mb-3 line-clamp-2" 
          style={{ color: 'var(--foreground)' }}
        >
          {product.name}
        </h3>
        
        <div className="flex items-center justify-between gap-2">
          <span 
            className="font-bold text-lg"
            style={{ color: 'var(--primary)' }}
          >
            {formattedPrice}
          </span>
          
          <span 
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ 
              backgroundColor: isAvailable ? 'var(--muted)' : 'rgba(220, 38, 38, 0.1)',
              color: isAvailable ? 'var(--success)' : 'var(--destructive)'
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isAvailable ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            {isAvailable ? 'Em estoque' : 'Indisponível'}
          </span>
        </div>

        {/* Action hint */}
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <span 
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Ver produto
            <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
