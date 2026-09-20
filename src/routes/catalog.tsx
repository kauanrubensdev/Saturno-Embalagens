import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { ThemeToggle } from '@/components/customer/ThemeToggle';

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
  category: { name: string; slug: string } | null;
}

interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
}

export const Route = createFileRoute('/catalog')({
  component: CatalogPage,
});

function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setCategories(data as CatalogCategory[]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('products')
      .select('id, name, slug, price, image_url, stock_quantity, category:categories(name, slug)')
      .eq('is_active', true)
      .order('name', { ascending: true });

    query.then(({ data, error: fetchError }) => {
      if (fetchError) {
        setError('Erro ao carregar produtos. Tente novamente.');
        setLoading(false);
        return;
      }
      setProducts((data as CatalogProduct[]) || []);
      setLoading(false);
    });
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = search.trim() === '' || product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || product.category?.slug === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 w-full border-b transition-colors duration-200"
        style={{ 
          backgroundColor: 'var(--card)', 
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-xs)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-[68px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 no-underline group flex-shrink-0">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" 
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--primary)' }}>Saturno</span>Embalagens
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link 
              to="/cart" 
              className="relative p-2 rounded-xl transition-all duration-150 hover:scale-105"
              style={{ 
                backgroundColor: 'var(--accent)', 
                border: '1px solid var(--border)' 
              }}
            >
              <svg className="w-5 h-5" style={{ color: 'var(--accent-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinecap="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
            <Link 
              to="/login" 
              className="text-sm font-semibold px-4 py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-90"
              style={{ 
                backgroundColor: 'var(--primary)', 
                color: 'var(--primary-foreground)' 
              }}
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Catalog Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Page Header */}
        <div className="mb-8 md:mb-10">
          <h1 
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            Catálogo de produtos
          </h1>
          <p 
            className="text-base md:text-lg max-w-2xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Encontre as embalagens ideais para o seu negócio.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
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
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
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

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: !selectedCategory ? 'var(--primary)' : 'transparent',
                color: !selectedCategory ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                border: '1px solid ' + (!selectedCategory ? 'var(--primary)' : 'var(--border)'),
              }}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: selectedCategory === cat.slug ? 'var(--primary)' : 'transparent',
                  color: selectedCategory === cat.slug ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  border: '1px solid ' + (selectedCategory === cat.slug ? 'var(--primary)' : 'var(--border)'),
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && !error && filteredProducts.length > 0 && (
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
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
              {search ? `Não encontramos nada para "${search}"` : 'Volte em breve para novidades.'}
            </p>
            {search && (
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
