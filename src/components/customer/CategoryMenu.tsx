import { Link } from '@tanstack/react-router';

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface CategoryMenuProps {
  categories: Category[];
}

// Category-specific icons
function CategoryIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('hamb') || lowerName.includes('lanche')) {
    return (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" strokeWidth={1.5}>
        <rect x="8" y="14" width="32" height="20" rx="4" style={{ stroke: 'var(--primary)' }} />
        <path d="M12 20h24" style={{ stroke: 'var(--primary)' }} />
        <path d="M16 26h16" style={{ stroke: 'var(--primary)', opacity: 0.5 }} />
        <circle cx="14" cy="18" r="1.5" fill="var(--primary)" />
        <circle cx="34" cy="18" r="1.5" fill="var(--primary)" />
        <path d="M24 10v4M20 12l4-4 4 4" style={{ stroke: 'var(--primary)', opacity: 0.7 }} />
      </svg>
    );
  }
  
  if (lowerName.includes('pizza')) {
    return (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" strokeWidth={1.5}>
        <circle cx="24" cy="24" r="16" style={{ stroke: 'var(--primary)' }} />
        <circle cx="24" cy="24" r="10" style={{ stroke: 'var(--primary)', opacity: 0.5 }} />
        <circle cx="20" cy="20" r="2" fill="var(--primary)" />
        <circle cx="28" cy="22" r="2" fill="var(--primary)" />
        <circle cx="24" cy="28" r="2" fill="var(--primary)" />
        <circle cx="18" cy="26" r="1.5" fill="var(--primary)" />
        <circle cx="30" cy="28" r="1.5" fill="var(--primary)" />
      </svg>
    );
  }
  
  if (lowerName.includes('salgado') || lowerName.includes('quitute')) {
    return (
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" strokeWidth={1.5}>
        <path d="M14 32c0-8 4-14 10-16 6 2 10 8 10 16" style={{ stroke: 'var(--primary)' }} />
        <ellipse cx="24" cy="32" rx="10" ry="4" style={{ stroke: 'var(--primary)' }} />
        <path d="M18 24c2-4 6-6 6-10" style={{ stroke: 'var(--primary)', opacity: 0.7 }} />
        <circle cx="20" cy="26" r="1.5" fill="var(--primary)" />
        <circle cx="28" cy="24" r="1.5" fill="var(--primary)" />
        <circle cx="24" cy="30" r="1.5" fill="var(--primary)" />
      </svg>
    );
  }
  
  // Default box icon
  return (
    <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" strokeWidth={1.5}>
      <path d="M8 16l16-8 16 8v20l-16 8-16-8V16z" style={{ stroke: 'var(--primary)' }} />
      <path d="M8 16l16 8 16-8M24 24v20" style={{ stroke: 'var(--primary)', opacity: 0.5 }} />
    </svg>
  );
}

export function CategoryMenu({ categories }: CategoryMenuProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {categories.map((category, index) => (
        <Link
          key={category.id}
          to="/catalog/$categorySlug"
          params={{ categorySlug: category.slug }}
          className="group block no-underline rounded-2xl overflow-hidden transition-all duration-300"
          style={{ 
            backgroundColor: 'var(--card)', 
            border: '1px solid var(--border)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,65,3,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="flex items-center justify-center transition-all duration-300 group-hover:scale-105"
            style={{ 
              height: '140px', 
              backgroundColor: 'var(--muted)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Background accent */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ backgroundColor: 'var(--primary)', opacity: 0.05 }}
            />
            
            {/* Icon container */}
            <div 
              className="relative z-10 transition-transform duration-300"
              style={{ transform: 'scale(1)' }}
            >
              <CategoryIcon name={category.name} />
            </div>
            
            {/* Decorative corner element */}
            <div 
              className="absolute top-4 right-4 w-8 h-8 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
              style={{ backgroundColor: 'var(--primary)' }}
            />
            <div 
              className="absolute bottom-4 left-4 w-4 h-4 rounded-full opacity-10 group-hover:opacity-30 transition-opacity"
              style={{ backgroundColor: 'var(--primary)' }}
            />
          </div>
          
          <div className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                {category.name}
              </h3>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Ver produtos
              </p>
            </div>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
              style={{ backgroundColor: 'var(--primary)', opacity: 0.1 }}
            >
              <svg 
                className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" 
                style={{ color: 'var(--primary)' }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      ))}
      
      {/* Mobile: Show catalog link below cards */}
      <Link 
        to="/catalog" 
        className="sm:hidden flex items-center justify-center gap-2 rounded-2xl p-4 no-underline transition-colors"
        style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
      >
        <span className="text-sm font-semibold">Ver todas as categorias</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
