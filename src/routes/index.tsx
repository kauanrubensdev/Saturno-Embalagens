import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from '@/components/customer/ProductCard';
import { CategoryMenu } from '@/components/customer/CategoryMenu';
import { Header } from '@/components/customer/Header';
import {
  RotateCcw,
  AlertCircle,
  Package,
  Layers,
  ShoppingBag,
} from 'lucide-react';

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
  const [productsError, setProductsError] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);

  const fetchFeaturedProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      setProductsError(false);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, price, image_url, stock_quantity, category:categories(name)')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(8);

      if (error) throw error;
      setFeaturedProducts((data as FeaturedProduct[]) || []);
    } catch (err) {
      console.error('[HOME] Erro ao buscar produtos em destaque:', err);
      setProductsError(true);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      setCategoriesError(false);
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories((data as FeaturedCategory[]) || []);
    } catch (err) {
      console.error('[HOME] Erro ao buscar categorias:', err);
      setCategoriesError(true);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchFeaturedProducts();
    fetchCategories();
  }, [fetchFeaturedProducts, fetchCategories]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <Header showNav />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-16 md:py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 sm:mb-6 text-xs font-semibold tracking-wider uppercase" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Qualidade e preço justo
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4 sm:mb-6" style={{ color: 'var(--foreground)' }}>
                Embalagens que{' '}
                <span style={{ color: 'var(--primary)' }}>valorizam</span>{' '}
                seu delivery
              </h1>
              <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-10 leading-relaxed max-w-lg" style={{ color: 'var(--muted-foreground)' }}>
                Caixas e embalagens para deixar seu produto bem apresentado, protegido e pronto para chegar ao cliente.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/catalog" className="inline-flex items-center justify-center gap-2.5 rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold no-underline transition-all hover:opacity-90 hover:scale-[1.02]" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', boxShadow: '0 4px 14px rgba(255,65,3,0.25)' }}>
                  Ver catálogo
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <a href="#categorias" className="inline-flex items-center justify-center gap-2.5 rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-semibold no-underline transition-all hover:opacity-80" style={{ backgroundColor: 'transparent', color: 'var(--foreground)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)' }}>
                  Conheça nossas categorias
                </a>
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
      <section id="categorias" className="py-16 md:py-20 scroll-mt-20" style={{ backgroundColor: 'var(--card)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1.5" style={{ color: 'var(--foreground)' }}>Encontre a embalagem certa</h2>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Escolha uma categoria e encontre as opções disponíveis para o seu negócio.</p>
            </div>
            <Link to="/catalog" className="hidden sm:flex items-center gap-1 text-sm font-semibold no-underline transition-colors hover:gap-2" style={{ color: 'var(--primary)' }}>
              Ver todas
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {loadingCategories ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl overflow-hidden border"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div style={{ height: '140px', backgroundColor: 'var(--muted)' }} />
                  <div className="p-5 flex items-center justify-between">
                    <div className="space-y-2 flex-1 mr-4">
                      <div className="h-4 rounded-md w-3/4" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-3 rounded-md w-1/3" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : categoriesError ? (
            <div
              className="p-8 sm:p-12 rounded-2xl border text-center space-y-4 max-w-lg mx-auto"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-destructive"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm sm:text-base" style={{ color: 'var(--foreground)' }}>
                  Não foi possível carregar as categorias
                </p>
                <p className="text-xs text-muted-foreground">
                  Ocorreu uma instabilidade ao conectar com o servidor. Tente novamente.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchCategories}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
            </div>
          ) : categories.length > 0 ? (
            <CategoryMenu categories={categories} />
          ) : (
            <div
              className="p-8 sm:p-12 rounded-2xl border text-center space-y-4 max-w-lg mx-auto"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-muted-foreground"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base" style={{ color: 'var(--foreground)' }}>
                  Nenhuma categoria disponível no momento
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Novas categorias de embalagens serão adicionadas em breve.
                </p>
              </div>
              <Link
                to="/catalog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white no-underline transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <span>Ver catálogo completo</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-20" style={{ backgroundColor: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto px-4">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                  Produtos em Destaque
                </h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Os mais procurados pelos nossos clientes
              </p>
            </div>
            <Link 
              to="/catalog" 
              className="inline-flex items-center gap-1.5 text-sm font-semibold no-underline transition-all hover:gap-2.5"
              style={{ color: 'var(--primary)' }}
            >
              Ver todos os produtos
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Products Grid */}
          {loadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl overflow-hidden border"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div style={{ aspectRatio: '4/3', backgroundColor: 'var(--muted)' }} />
                  <div className="p-3 sm:p-4 space-y-3">
                    <div style={{ backgroundColor: 'var(--muted)', height: '16px', borderRadius: '4px', width: '85%' }} />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div style={{ backgroundColor: 'var(--muted)', height: '18px', borderRadius: '4px', width: '45%' }} />
                      <div style={{ backgroundColor: 'var(--muted)', height: '18px', borderRadius: '4px', width: '35%' }} />
                    </div>
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div style={{ backgroundColor: 'var(--muted)', height: '12px', borderRadius: '4px', width: '50%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : productsError ? (
            <div
              className="p-8 sm:p-12 rounded-2xl border text-center space-y-4 max-w-lg mx-auto"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-destructive"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm sm:text-base" style={{ color: 'var(--foreground)' }}>
                  Não foi possível carregar os produtos em destaque
                </p>
                <p className="text-xs text-muted-foreground">
                  Ocorreu uma instabilidade momentânea na conexão. Clique abaixo para tentar recarregar.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchFeaturedProducts}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div
              className="text-center py-16 px-4 rounded-2xl border max-w-lg mx-auto space-y-4"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-muted-foreground"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <Package className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                  Nenhum produto em destaque no momento
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Confira nosso catálogo completo para conhecer todas as opções disponíveis.
                </p>
              </div>
              <Link 
                to="/catalog" 
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white no-underline transition-all hover:opacity-90 shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Ver catálogo de produtos</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20 md:py-28 relative overflow-hidden" style={{ backgroundColor: 'var(--primary)' }}>
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: 'var(--foreground)', transform: 'translate(-50%, -50%)' }} />
        <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ backgroundColor: 'var(--foreground)', transform: 'translate(50%, 50%)' }} />
        <div className="absolute top-8 right-8 w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--primary-foreground)', opacity: 0.3 }} />
        <div className="absolute bottom-12 left-12 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary-foreground)', opacity: 0.3 }} />
        
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 sm:mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'var(--primary-foreground)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="text-xs font-semibold tracking-wider uppercase">Catálogo completo</span>
          </div>
          
          {/* Title */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 sm:mb-5 leading-tight" style={{ color: 'var(--primary-foreground)' }}>
            Quer conhecer todos os produtos?
          </h2>
          
          {/* Description */}
          <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-10 max-w-xl mx-auto leading-relaxed opacity-90" style={{ color: 'var(--primary-foreground)' }}>
            Acesse nosso catálogo completo e encontre a embalagem perfeita para o seu negócio.
          </p>
          
          {/* CTA Button */}
          <Link 
            to="/catalog" 
            className="inline-flex items-center justify-center gap-2 sm:gap-3 rounded-xl px-6 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base font-bold no-underline transition-all duration-200 hover:scale-[1.03] hover:shadow-lg" 
            style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
          >
            Acessar catálogo completo
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--card)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-14 md:py-16">
          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            {/* Brand Column */}
            <div className="md:col-span-1">
              <Link to="/" className="inline-flex items-center gap-2.5 mb-5 no-underline group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ backgroundColor: 'var(--primary)' }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
              </Link>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Embalagens de qualidade para delivery. Qualidade e preço justo para seu negócio.
              </p>
              {/* Accent line */}
              <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
            </div>

            {/* Navigation Column */}
            <div>
              <h3 className="font-semibold text-sm mb-5 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                Navegação
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/" className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'var(--primary)' }} />
                    <span className="group-hover:opacity-80">Início</span>
                  </Link>
                </li>
                <li>
                  <Link to="/catalog" className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'var(--primary)' }} />
                    <span className="group-hover:opacity-80">Catálogo</span>
                  </Link>
                </li>
                <li>
                  <Link to="/cart" className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'var(--primary)' }} />
                    <span className="group-hover:opacity-80">Carrinho</span>
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-sm no-underline transition-colors inline-flex items-center gap-1.5 group" style={{ color: 'var(--muted-foreground)' }}>
                    <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'var(--primary)' }} />
                    <span className="group-hover:opacity-80">Minha conta</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Pickup Location Column */}
            <div>
              <h3 className="font-semibold text-sm mb-5 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                Retirada
              </h3>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'var(--accent)' }}>
                  <svg className="w-4 h-4" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--foreground)' }}>R. Urupema, nº 150</p>
                  <p className="text-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>São Cosme de Baixo</p>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Santa Luzia - MG, 33130-140</p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              © 2026 SaturnoEmbalagens. Todos os direitos reservados.
            </p>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Feito com
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              para seu negócio
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
