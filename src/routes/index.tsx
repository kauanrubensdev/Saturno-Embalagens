import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { CategoryMenu } from '@/components/customer/CategoryMenu';
import { ThemeToggle } from '@/components/customer/ThemeToggle';

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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(255,65,3,0.15)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/catalog" className="text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: 'var(--foreground)' }}>Catálogo</Link>
            <Link to="/catalog" className="text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: 'var(--foreground)' }}>Produtos</Link>
            <Link to="/account" className="text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: 'var(--foreground)' }}>Minha Conta</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative p-2 rounded-lg transition-colors hover:bg-white/5">
              <svg className="w-5 h-5" style={{ color: 'var(--foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
            <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-all hover:opacity-90" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              Entrar
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold tracking-wider uppercase" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Qualidade e preço justo
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6" style={{ color: 'var(--foreground)' }}>
                Embalagens que{' '}
                <span style={{ color: 'var(--primary)' }}>valorizam</span>{' '}
                seu delivery
              </h1>
              <p className="text-lg md:text-xl mb-10 leading-relaxed max-w-lg" style={{ color: 'var(--muted-foreground)' }}>
                Caixas e embalagens para deixar seu produto bem apresentado, protegido e pronto para chegar ao cliente.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/catalog" className="inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold no-underline transition-all hover:opacity-90 hover:scale-[1.02]" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', boxShadow: '0 4px 14px rgba(255,65,3,0.25)' }}>
                  Ver catálogo
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link to="/catalog" className="inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-semibold no-underline transition-all hover:opacity-80" style={{ backgroundColor: 'transparent', color: 'var(--foreground)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)' }}>
                  Conheça nossos produtos
                </Link>
              </div>
            </div>

            {/* Right: Visual Element */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-md aspect-square">
                {/* Main shape */}
                <div className="absolute inset-0 rounded-3xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }} />
                {/* Accent shape */}
                <div className="absolute top-8 right-8 w-32 h-32 rounded-2xl rotate-12" style={{ backgroundColor: 'var(--primary)', opacity: 0.15 }} />
                <div className="absolute bottom-12 left-12 w-24 h-24 rounded-2xl -rotate-6" style={{ backgroundColor: 'var(--primary)', opacity: 0.1 }} />
                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                    <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
                {/* Small decorative elements */}
                <div className="absolute top-16 left-16 w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="absolute bottom-20 right-20 w-4 h-4 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="absolute top-24 right-24 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-20" style={{ backgroundColor: 'var(--card)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Nossas Categorias</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>Encontre a embalagem ideal para o seu negócio</p>
            </div>
            <Link to="/catalog" className="text-sm font-semibold no-underline transition-colors" style={{ color: 'var(--primary)' }}>
              Ver todas →
            </Link>
          </div>

          {loadingCategories ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--muted)', height: '140px' }} />
              ))}
            </div>
          ) : categories.length > 0 ? (
            <CategoryMenu categories={categories} />
          ) : (
            <p className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>Nenhuma categoria disponível.</p>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-20" style={{ backgroundColor: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Produtos em Destaque</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>Os mais procurados pelos nossos clientes</p>
            </div>
            <Link to="/catalog" className="text-sm font-semibold no-underline transition-colors" style={{ color: 'var(--primary)' }}>
              Ver todos →
            </Link>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <div style={{ backgroundColor: 'var(--muted)', height: '180px' }} />
                  <div className="p-4 space-y-2">
                    <div style={{ backgroundColor: 'var(--muted)', height: '16px', borderRadius: '4px' }} />
                    <div style={{ backgroundColor: 'var(--muted)', height: '12px', borderRadius: '4px', width: '60%' }} />
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
              <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>Nenhum produto em destaque no momento.</p>
              <Link to="/catalog" className="mt-4 inline-block text-sm font-semibold no-underline" style={{ color: 'var(--primary)' }}>
                Ver todos os produtos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20" style={{ backgroundColor: 'var(--primary)' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4" style={{ color: 'var(--primary-foreground)' }}>Quer conhecer todos os produtos?</h2>
          <p className="text-base mb-10" style={{ color: 'var(--primary-foreground)' }}>Acesse nosso catálogo completo e encontre a embalagem perfeita para o seu negócio.</p>
          <Link to="/catalog" className="inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-bold no-underline transition-all hover:opacity-90" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
            Acessar catálogo completo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ backgroundColor: 'var(--background)', borderColor: 'rgba(255,65,3,0.12)' }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="font-bold" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Embalagens de qualidade para delivery. Qualidade e preço justo para seu negócio.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--foreground)' }}>Navegação</h3>
              <ul className="space-y-2.5">
                <li><Link to="/catalog" className="text-sm no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Catálogo</Link></li>
                <li><Link to="/login" className="text-sm no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Minha conta</Link></li>
                <li><Link to="/cart" className="text-sm no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Carrinho</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--foreground)' }}>Retirada</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                R. Urupema, nº 150<br />São Cosme de Baixo<br />Santa Luzia - MG, 33130-140
              </p>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t text-center" style={{ borderColor: 'rgba(255,65,3,0.12)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>© 2025 SaturnoEmbalagens. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
