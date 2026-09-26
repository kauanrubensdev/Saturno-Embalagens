import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { Header } from '@/components/customer/Header';

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

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (catError) throw catError;
      if (data) setCategories(data as CatalogCategory[]);
    } catch (err) {
      console.error('[CATALOG] Error loading categories:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, name, slug, price, image_url, stock_quantity, category:categories(name, slug)')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setProducts((data as CatalogProduct[]) || []);
    } catch (err) {
      console.error('[CATALOG] Error loading products:', err);
      setError('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = search.trim() === '' || product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || product.category?.slug === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      {/* Catalog Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 md:py-12 w-full">
        {/* Page Header */}
        <div className="mb-8 md:mb-10">
          <h1 
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            Catálogo de produtos
          </h1>
          <p 
            className="text-sm sm:text-base md:text-lg max-w-2xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Encontre as embalagens ideais para o seu negócio com a melhor qualidade e preço.
          </p>
        </div>

        {/* Search & Category Filters */}
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
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
              placeholder="Buscar produtos por nome..."
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

          {/* Categories Pill Buttons */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap active:scale-95"
              style={{
                backgroundColor: !selectedCategory ? 'var(--primary)' : 'var(--card)',
                color: !selectedCategory ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                border: '1px solid ' + (!selectedCategory ? 'var(--primary)' : 'var(--border)'),
              }}
            >
              Todos
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : cat.slug)}
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  style={{
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--card)',
                    color: isSelected ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)'),
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count info */}
        {!loading && !error && (
          <div className="flex items-center justify-between gap-4 mb-6">
            <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
              {selectedCategory && (
                <span> na categoria <strong>{categories.find(c => c.slug === selectedCategory)?.name || selectedCategory}</strong></span>
              )}
            </p>
            {(search || selectedCategory) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSelectedCategory(null); }}
                className="text-xs font-medium cursor-pointer hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        )}

        {/* Products Grid / States */}
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
              Ocorreu uma instabilidade ao buscar o catálogo de produtos.
            </p>
            <button 
              type="button"
              onClick={fetchProducts} 
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
              {search 
                ? 'Nenhum produto encontrado' 
                : selectedCategory 
                  ? 'Nenhum produto nesta categoria' 
                  : 'Nenhum produto disponível'}
            </h3>
            <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: 'var(--muted-foreground)' }}>
              {search 
                ? `Não encontramos nenhum resultado para "${search}". Tente buscar por outro termo ou limpe os filtros.` 
                : selectedCategory 
                  ? 'No momento não temos produtos cadastrados para a categoria selecionada.' 
                  : 'Nosso catálogo está sendo atualizado. Em breve teremos novidades disponíveis.'}
            </p>
            
            {(search || selectedCategory) ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {search && (
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
                )}
                {selectedCategory && (
                  <button 
                    type="button"
                    onClick={() => setSelectedCategory(null)} 
                    className="text-xs sm:text-sm font-medium cursor-pointer px-4 py-2 rounded-xl transition-all active:scale-95"
                    style={{ 
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-foreground)'
                    }}
                  >
                    Ver todas as categorias
                  </button>
                )}
                {search && selectedCategory && (
                  <button 
                    type="button"
                    onClick={() => { setSearch(''); setSelectedCategory(null); }} 
                    className="text-xs sm:text-sm font-medium cursor-pointer px-4 py-2 rounded-xl transition-all active:scale-95"
                    style={{ 
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-foreground)'
                    }}
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
            ) : (
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium no-underline px-4 py-2 rounded-xl transition-all active:scale-95"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                Voltar para o Início
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

