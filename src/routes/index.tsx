import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { CategoryMenu } from '@/components/customer/CategoryMenu';

export const Route = createFileRoute('/')({
  component: Index,
});

interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
  category: { name: string } | null;
}

interface FeaturedCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

function Index() {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [categories, setCategories] = useState<FeaturedCategory[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    // Fetch featured products
    supabase
      .from('products')
      .select('id, name, slug, price, image_url, stock_quantity, category:categories(name)')
      .eq('is_active', true)
      .eq('is_featured', true)
      .limit(8)
      .then(({ data, error }) => {
        if (!error && data) setFeaturedProducts(data as FeaturedProduct[]);
        setLoadingProducts(false);
      });

    // Fetch active categories
    supabase
      .from('categories')
      .select('id, name, slug, image_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setCategories(data as FeaturedCategory[]);
        setLoadingCategories(false);
      });
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fcfbf8' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FF6B00' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ color: '#1a1a1a' }}>SaturnoEmbalagens</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/catalog" className="text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: '#1a1a1a' }}>Catálogo</Link>
            <Link to="/catalog?category=caixas-de-hamburguer" className="text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: '#1a1a1a' }}>Caixas</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative p-2 rounded-lg transition-colors hover:bg-gray-100">
              <svg className="w-5 h-5" style={{ color: '#1a1a1a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
            <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-colors hover:opacity-90" style={{ backgroundColor: '#FF6B00', color: '#ffffff' }}>
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ backgroundColor: '#FF6B00' }}>
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
              Embalagens de qualidade para seu delivery
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8">
              Caixas para hambúrguer, pizza, salgado e muito mais. Calidadepara destacar seu negócio.
            </p>
            <Link to="/catalog" className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold no-underline transition-all hover:opacity-90" style={{ backgroundColor: '#ffffff', color: '#FF6B00' }}>
              Ver catálogo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden lg:block opacity-10">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <rect x="50" y="60" width="100" height="80" rx="8" fill="white" />
            <rect x="60" y="70" width="80" height="60" rx="4" fill="none" stroke="white" strokeWidth="2" />
          </svg>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 md:py-16" style={{ backgroundColor: '#fcfbf8' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#1a1a1a' }}>Categorias</h2>
              <p className="mt-1 text-sm" style={{ color: '#666666' }}>Encontre o que precisa</p>
            </div>
            <Link to="/catalog" className="text-sm font-medium no-underline transition-colors" style={{ color: '#FF6B00' }}>
              Ver todas →
            </Link>
          </div>

          {loadingCategories ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl" style={{ backgroundColor: '#e5e5e5', height: '140px' }} />
              ))}
            </div>
          ) : categories.length > 0 ? (
            <CategoryMenu categories={categories} />
          ) : (
            <p className="text-center py-8" style={{ color: '#666666' }}>Nenhuma categoria disponível.</p>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-12 md:py-16" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#1a1a1a' }}>Produtos em destaque</h2>
              <p className="mt-1 text-sm" style={{ color: '#666666' }}>Os mais procurados pelos nossos clientes</p>
            </div>
            <Link to="/catalog" className="text-sm font-medium no-underline transition-colors" style={{ color: '#FF6B00' }}>
              Ver todos →
            </Link>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl overflow-hidden" style={{ backgroundColor: '#f5f5f5' }}>
                  <div style={{ backgroundColor: '#e5e5e5', height: '180px' }} />
                  <div className="p-4 space-y-2">
                    <div style={{ backgroundColor: '#e5e5e5', height: '16px', borderRadius: '4px' }} />
                    <div style={{ backgroundColor: '#e5e5e5', height: '12px', borderRadius: '4px', width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-base" style={{ color: '#666666' }}>Nenhum produto em destaque no momento.</p>
              <Link to="/catalog" className="mt-4 inline-block text-sm font-medium no-underline" style={{ color: '#FF6B00' }}>
                Ver todos os produtos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#1a1a1a' }}>Quer conhecer todos os produtos?</h2>
          <p className="text-base mb-8" style={{ color: '#666666' }}>Acesse nosso catálogo completo e encontre a embalagem perfeita para o seu negócio.</p>
          <Link to="/catalog" className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold no-underline transition-all hover:opacity-90" style={{ backgroundColor: '#FF6B00', color: '#ffffff' }}>
            Acessar catálogo completo
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FF6B00' }}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="font-bold" style={{ color: '#1a1a1a' }}>SaturnoEmbalagens</span>
              </div>
              <p className="text-sm" style={{ color: '#666666' }}>Embalagens de qualidade para delivery. Qualidade e preço justo para seu negócio.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: '#1a1a1a' }}>Navegação</h3>
              <ul className="space-y-2">
                <li><Link to="/catalog" className="text-sm no-underline transition-colors hover:opacity-80" style={{ color: '#666666' }}>Catálogo</Link></li>
                <li><Link to="/login" className="text-sm no-underline transition-colors hover:opacity-80" style={{ color: '#666666' }}>Minha conta</Link></li>
                <li><Link to="/cart" className="text-sm no-underline transition-colors hover:opacity-80" style={{ color: '#666666' }}>Carrinho</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: '#1a1a1a' }}>Retirada</h3>
              <p className="text-sm" style={{ color: '#666666' }}>R. Urupema, nº 150<br />São Cosme de Baixo<br />Santa Luzia - MG, 33130-140</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: '#e5e5e5' }}>
            <p className="text-xs" style={{ color: '#999999' }}>© 2025 SaturnoEmbalagens. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
