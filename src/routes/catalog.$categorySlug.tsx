import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';

interface CategoryProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
  category: { name: string; slug: string } | null;
}

export const Route = createFileRoute('/catalog/$categorySlug')({
  component: CategoryPage,
});

function CategoryPage() {
  const params = Route.useParams();
  const categorySlug = params.categorySlug;

  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [categoryName, setCategoryName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSearch('');

    supabase
      .from('products')
      .select('id, name, slug, price, image_url, stock_quantity, category:categories(name, slug)')
      .eq('is_active', true)
      .eq('categories.slug', categorySlug)
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('Erro ao carregar produtos. Tente novamente.');
          setLoading(false);
          return;
        }

        const productsData = (data as CategoryProduct[]) || [];
        setProducts(productsData);

        const firstProduct = productsData[0];
        if (firstProduct?.category) {
          setCategoryName(firstProduct.category.name);
        } else {
          supabase
            .from('categories')
            .select('name')
            .eq('slug', categorySlug)
            .eq('is_active', true)
            .single()
            .then(({ data: catData }) => {
              if (catData) setCategoryName(catData.name);
            });
        }
        setLoading(false);
      });
  }, [categorySlug]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Page Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          <Link 
            to="/catalog" 
            className="no-underline transition-colors inline-flex items-center gap-1.5 hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Catálogo
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--foreground)' }}>
            {loading ? '...' : (categoryName || categorySlug)}
          </span>
        </nav>

        {/* Page Header */}
        <div className="mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold tracking-wider uppercase" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Categoria
          </div>
          <h1 
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            {loading ? 'Carregando...' : (categoryName || categorySlug)}
          </h1>
          <p 
            className="text-base md:text-lg max-w-2xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Encontre as opções ideais de embalagens para o seu negócio.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg 
                className="w-5 h-5" 
                style={{ color: 'var(--muted-foreground)' }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar nesta categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border text-sm focus:outline-none transition-all"
              style={{ 
                borderColor: 'var(--border)', 
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)'
              }}
              onFocus={(e) => { 
                e.target.style.borderColor = 'var(--primary)'; 
                e.target.style.boxShadow = 'var(--shadow-focus)'; 
              }}
              onBlur={(e) => { 
                e.target.style.borderColor = 'var(--border)'; 
                e.target.style.boxShadow = 'none'; 
              }}
            />
          </div>
        </div>

        {/* Results count */}
        {!loading && !error && (
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {filteredProducts.length > 0 
              ? `${filteredProducts.length} produto${filteredProducts.length !== 1 ? 's' : ''} encontrado${filteredProducts.length !== 1 ? 's' : ''}`
              : search ? 'Nenhum resultado' : 'Nenhum produto disponível'
            }
          </p>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="animate-pulse rounded-2xl overflow-hidden"
                style={{ 
                  backgroundColor: 'var(--card)', 
                  border: '1px solid var(--border)'
                }}
              >
                <div 
                  className="aspect-[4/3]" 
                  style={{ backgroundColor: 'var(--muted)' }} 
                />
                <div className="p-4 space-y-3">
                  <div 
                    style={{ 
                      backgroundColor: 'var(--muted)', 
                      height: '18px', 
                      borderRadius: '6px' 
                    }} 
                  />
                  <div 
                    style={{ 
                      backgroundColor: 'var(--muted)', 
                      height: '14px', 
                      borderRadius: '6px', 
                      width: '60%' 
                    }} 
                  />
                  <div 
                    style={{ 
                      backgroundColor: 'var(--muted)', 
                      height: '14px', 
                      borderRadius: '6px', 
                      width: '40%' 
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div 
            className="text-center py-16 px-4 rounded-2xl"
            style={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)'
            }}
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" 
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg 
                className="w-7 h-7 text-red-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-base font-medium mb-3" style={{ color: 'var(--destructive)' }}>
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="text-sm font-medium cursor-pointer px-4 py-2 rounded-lg transition-all"
              style={{ 
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)'
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div 
            className="text-center py-16 px-4 rounded-2xl"
            style={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)'
            }}
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" 
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg 
                className="w-7 h-7" 
                style={{ color: 'var(--primary)' }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {search ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              {search 
                ? `Não encontramos nada para "${search}"` 
                : 'Ainda não há produtos disponíveis nesta categoria.'}
            </p>
            {search ? (
              <button 
                onClick={() => setSearch('')} 
                className="text-sm font-medium cursor-pointer px-4 py-2 rounded-lg transition-all"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                Limpar busca
              </button>
            ) : (
              <Link 
                to="/catalog" 
                className="inline-flex items-center gap-2 text-sm font-medium no-underline px-4 py-2 rounded-lg transition-all"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Voltar ao catálogo
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
