import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { Header } from '@/components/customer/Header';

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

  const fetchCategoryAndProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch category
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('slug', categorySlug)
        .eq('is_active', true)
        .single();

      if (categoryError || !categoryData) {
        setError('Categoria não encontrada.');
        setLoading(false);
        return;
      }

      setCategoryName(categoryData.name);

      // 2. Fetch products in this category
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, price, image_url, stock_quantity, category:categories(name, slug)')
        .eq('is_active', true)
        .eq('category_id', categoryData.id)
        .order('name', { ascending: true });

      if (productsError) {
        throw productsError;
      }

      setProducts((productsData as CategoryProduct[]) || []);
    } catch (err) {
      console.error('[CATALOG-CATEGORY] Error loading category products:', err);
      setError('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, [categorySlug]);

  useEffect(() => {
    setSearch('');
    fetchCategoryAndProducts();
  }, [fetchCategoryAndProducts]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      {/* Page Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 md:py-12 w-full">
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3 text-xs font-semibold tracking-wider uppercase" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Categoria
          </div>
          <h1 
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            {loading ? 'Carregando categoria...' : (categoryName || categorySlug)}
          </h1>
          <p 
            className="text-sm sm:text-base md:text-lg max-w-2xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Encontre as opções ideais de embalagens para o seu negócio nesta categoria.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6 sm:mb-8">
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
              className="w-full pl-12 pr-10 py-3 rounded-xl border text-sm focus:outline-none transition-all"
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
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-xs hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Limpar busca"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {!loading && !error && (
          <div className="flex items-center justify-between gap-4 mb-6">
            <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {filteredProducts.length > 0 
                ? `${filteredProducts.length} produto${filteredProducts.length !== 1 ? 's' : ''} encontrado${filteredProducts.length !== 1 ? 's' : ''}`
                : search ? 'Nenhum resultado' : 'Nenhum produto disponível'
              }
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs font-medium cursor-pointer hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                Limpar busca
              </button>
            )}
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="rounded-xl overflow-hidden animate-pulse flex flex-col"
                style={{ 
                  backgroundColor: 'var(--card)', 
                  border: '1px solid var(--border)' 
                }}
              >
                {/* Image placeholder */}
                <div 
                  className="relative" 
                  style={{ 
                    aspectRatio: '4/3', 
                    backgroundColor: 'var(--muted)' 
                  }}
                >
                  <div 
                    className="absolute top-2 sm:top-3 right-2 sm:right-3 w-16 h-5 rounded-full" 
                    style={{ backgroundColor: 'var(--border)' }} 
                  />
                </div>
                {/* Content placeholder */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 mb-3">
                    <div className="h-4 rounded-md w-4/5" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-3.5 rounded-md w-3/5" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="h-5 rounded-md w-20" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-4 rounded-md w-16" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                    <div className="pt-2.5 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                      <div className="h-3 rounded w-16" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div 
            className="text-center py-12 px-6 rounded-2xl max-w-lg mx-auto"
            style={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)'
            }}
          >
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" 
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {error}
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
              Ocorreu uma instabilidade ao carregar os produtos desta categoria.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                type="button"
                onClick={fetchCategoryAndProducts} 
                className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Tentar novamente
              </button>
              <Link 
                to="/catalog" 
                className="inline-flex items-center gap-2 text-sm font-medium no-underline px-4 py-2.5 rounded-xl transition-all border active:scale-95"
                style={{ 
                  backgroundColor: 'var(--card)',
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)'
                }}
              >
                Ver todas as categorias
              </Link>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div 
            className="text-center py-12 px-6 rounded-2xl max-w-lg mx-auto"
            style={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)'
            }}
          >
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" 
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg 
                className="w-6 h-6" 
                style={{ color: 'var(--muted-foreground)' }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {search ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
            </h3>
            <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: 'var(--muted-foreground)' }}>
              {search 
                ? `Não encontramos nada para "${search}" nesta categoria.` 
                : 'Ainda não há produtos cadastrados nesta categoria.'}
            </p>
            {search ? (
              <button 
                type="button"
                onClick={() => setSearch('')} 
                className="text-xs sm:text-sm font-medium cursor-pointer px-4 py-2 rounded-xl transition-all border active:scale-95"
                style={{ 
                  backgroundColor: 'var(--card)',
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)'
                }}
              >
                Limpar busca
              </button>
            ) : (
              <Link 
                to="/catalog" 
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium no-underline px-4 py-2 rounded-xl transition-all active:scale-95"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Voltar ao catálogo completo
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer 
        className="border-t mt-12" 
        style={{ 
          backgroundColor: 'var(--card)', 
          borderColor: 'var(--border)' 
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 no-underline mb-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center" 
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--primary)' }}>Saturno</span>Embalagens
            </span>
          </Link>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            © 2026 SaturnoEmbalagens. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

