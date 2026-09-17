import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { ThemeToggle } from '@/components/customer/ThemeToggle';

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
          // Try to get category name directly
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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative p-2 rounded-lg transition-colors hover:bg-gray-100">
              <svg className="w-5 h-5" style={{ color: 'var(--foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
            <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-colors hover:opacity-90" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              Entrar
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          <Link to="/" className="no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Início</Link>
          <span>/</span>
          <Link to="/catalog" className="no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Catálogo</Link>
          <span>/</span>
          <span style={{ color: 'var(--foreground)' }}>{categoryName || categorySlug}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
            {loading ? 'Carregando...' : (categoryName || categorySlug)}
          </h1>
          {!loading && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar nesta categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
                <div style={{ backgroundColor: 'var(--muted)', height: '180px' }} />
                <div className="p-4 space-y-2">
                  <div style={{ backgroundColor: 'var(--muted)', height: '16px', borderRadius: '4px' }} />
                  <div style={{ backgroundColor: 'var(--muted)', height: '12px', borderRadius: '4px', width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-base font-medium mb-2" style={{ color: 'var(--destructive)' }}>{error}</p>
            <button onClick={() => window.location.reload()} className="text-sm font-medium cursor-pointer" style={{ color: 'var(--primary)' }}>
              Tentar novamente
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-base font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              {search ? 'Nenhum produto encontrado nesta categoria' : 'Nenhum produto nesta categoria'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              {search ? `Não encontramos "${search}" nesta categoria.` : 'Volte em breve.'}
            </p>
            {search ? (
              <button onClick={() => setSearch('')} className="text-sm font-medium cursor-pointer" style={{ color: 'var(--primary)' }}>
                Limpar busca
              </button>
            ) : (
              <Link to="/catalog" className="text-sm font-medium no-underline" style={{ color: 'var(--primary)' }}>
                Ver todas as categorias
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t mt-12" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>© 2025 SaturnoEmbalagens. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
