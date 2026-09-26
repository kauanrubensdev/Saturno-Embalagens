import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/customer/Header';
import { toast } from 'sonner';

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  sku: string | null;
  image_url: string | null;
  images: string[] | null;
  is_active: boolean;
  category: { id: string; name: string; slug: string } | null;
}

export const Route = createFileRoute('/product/$productSlug')({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const params = Route.useParams();
  const productSlug = params.productSlug;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'not_found' | 'error' | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { user } = useAuth();
  const { addToCart } = useCart();

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setErrorType(null);
    setImageError(false);

    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, name, slug, description, price, stock_quantity, sku, image_url, images, is_active, category:categories(id, name, slug)')
        .eq('slug', productSlug)
        .eq('is_active', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Record not found
          setErrorType('not_found');
        } else {
          console.error('[PRODUCT-DETAIL] Fetch error:', fetchError);
          setErrorType('error');
        }
        setProduct(null);
        return;
      }

      if (!data) {
        setErrorType('not_found');
        setProduct(null);
        return;
      }

      const productData = data as unknown as ProductDetail;
      setProduct(productData);
      setSelectedImage(productData.image_url);
      setQuantity(1);
    } catch (err) {
      console.error('[PRODUCT-DETAIL] Error:', err);
      setErrorType('error');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productSlug]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Faça login para adicionar itens ao carrinho');
      return;
    }

    if (!product || product.stock_quantity <= 0) {
      toast.error('Produto indisponível no momento');
      return;
    }

    if (quantity > product.stock_quantity) {
      toast.error(`Quantidade máxima disponível: ${product.stock_quantity}`);
      return;
    }

    setAddingToCart(true);
    const result = await addToCart(product.id, quantity);
    setAddingToCart(false);

    if (result.success) {
      setQuantity(1);
    }
  };

  const handleQuantityChange = (newQty: number) => {
    if (!product || product.stock_quantity <= 0) return;
    const clamped = Math.max(1, Math.min(newQty, product.stock_quantity));
    setQuantity(clamped);
  };

  const allImages = product?.images?.length
    ? product.images
    : product?.image_url
    ? [product.image_url]
    : [];

  const isAvailable = (product?.stock_quantity ?? 0) > 0;
  const isLowStock = isAvailable && (product?.stock_quantity ?? 0) <= 5;

  const formattedPrice = product
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)
    : '';

  // 1. Loading Skeleton
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2 mb-8 animate-pulse">
            <div className="h-4 rounded-md w-16" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="h-4 rounded-md w-4" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="h-4 rounded-md w-20" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="h-4 rounded-md w-4" style={{ backgroundColor: 'var(--muted)' }} />
            <div className="h-4 rounded-md w-32" style={{ backgroundColor: 'var(--muted)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 animate-pulse">
            {/* Image area skeleton */}
            <div className="space-y-3">
              <div 
                className="rounded-2xl w-full min-h-[300px] sm:min-h-[420px]" 
                style={{ backgroundColor: 'var(--muted)' }} 
              />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className="w-16 h-16 rounded-xl" 
                    style={{ backgroundColor: 'var(--muted)' }} 
                  />
                ))}
              </div>
            </div>

            {/* Info area skeleton */}
            <div className="space-y-4">
              <div className="h-4 rounded-md w-24" style={{ backgroundColor: 'var(--muted)' }} />
              <div className="space-y-2">
                <div className="h-7 sm:h-8 rounded-lg w-11/12" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="h-7 sm:h-8 rounded-lg w-3/4" style={{ backgroundColor: 'var(--muted)' }} />
              </div>
              <div className="h-9 rounded-lg w-36" style={{ backgroundColor: 'var(--muted)' }} />
              <div className="h-5 rounded-full w-40" style={{ backgroundColor: 'var(--muted)' }} />
              <div className="space-y-2 pt-2">
                <div className="h-4 rounded w-20" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="h-16 rounded-xl" style={{ backgroundColor: 'var(--muted)' }} />
              </div>
              <div className="pt-2">
                <div className="h-4 rounded w-20 mb-2" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="h-10 rounded-xl w-36" style={{ backgroundColor: 'var(--muted)' }} />
              </div>
              <div className="h-12 rounded-xl w-full" style={{ backgroundColor: 'var(--muted)' }} />
              <div className="h-20 rounded-xl w-full" style={{ backgroundColor: 'var(--muted)' }} />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Fetch Error (Connection / Query failure)
  if (errorType === 'error') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div 
            className="text-center max-w-md w-full p-8 rounded-2xl border"
            style={{ 
              backgroundColor: 'var(--card)', 
              borderColor: 'var(--border)' 
            }}
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" 
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Não foi possível carregar este produto
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Ocorreu uma instabilidade ao consultar as informações do item.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button 
                type="button"
                onClick={fetchProduct} 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Tentar novamente
              </button>
              <Link 
                to="/catalog" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all border active:scale-95"
                style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              >
                Voltar ao catálogo
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 3. Product Not Found (404)
  if (errorType === 'not_found' || !product) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div 
            className="text-center max-w-md w-full p-8 rounded-2xl border"
            style={{ 
              backgroundColor: 'var(--card)', 
              borderColor: 'var(--border)' 
            }}
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" 
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg 
                className="w-8 h-8" 
                style={{ color: 'var(--muted-foreground)' }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Produto não encontrado
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Este produto pode ter sido removido ou não está mais disponível no catálogo.
            </p>
            <Link 
              to="/catalog" 
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold no-underline transition-all hover:opacity-90 active:scale-95 shadow-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar ao catálogo
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 4. Product Loaded Success
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm mb-6 sm:mb-8 flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
            <Link to="/" className="no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Início</Link>
            <span>/</span>
            <Link to="/catalog" className="no-underline transition-colors hover:opacity-80" style={{ color: 'var(--muted-foreground)' }}>Catálogo</Link>
            {product.category && (
              <>
                <span>/</span>
                <Link
                  to="/catalog/$categorySlug"
                  params={{ categorySlug: product.category.slug }}
                  className="no-underline transition-colors hover:opacity-80"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {product.category.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span style={{ color: 'var(--foreground)' }} className="truncate max-w-[160px] sm:max-w-xs font-medium">
              {product.name}
            </span>
          </nav>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
            {/* Images Gallery */}
            <div className="space-y-3">
              <div
                className="rounded-2xl overflow-hidden flex items-center justify-center min-h-[260px] sm:min-h-[380px] border relative"
                style={{ 
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)'
                }}
              >
                {selectedImage && !imageError ? (
                  <img 
                    src={selectedImage} 
                    alt={product.name} 
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover transition-opacity duration-300" 
                    style={{ maxHeight: '500px' }} 
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    <svg className="w-16 h-16 sm:w-20 sm:h-20 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">Foto ilustrativa em breve</span>
                  </div>
                )}
              </div>

              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {allImages.map((img, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => { setSelectedImage(img); setImageError(false); }}
                      className="flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer active:scale-95"
                      style={{
                        width: '68px',
                        height: '68px',
                        borderColor: selectedImage === img ? 'var(--primary)' : 'var(--border)',
                        backgroundColor: 'var(--card)'
                      }}
                      aria-label={`Visualizar imagem ${index + 1}`}
                    >
                      <img src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details & Purchase */}
            <div className="flex flex-col justify-start">
              {product.category && (
                <Link
                  to="/catalog/$categorySlug"
                  params={{ categorySlug: product.category.slug }}
                  className="inline-block text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 no-underline transition-opacity hover:opacity-80"
                  style={{ color: 'var(--primary)' }}
                >
                  {product.category.name}
                </Link>
              )}

              <h1 className="text-2xl sm:text-3xl md:text-3xl font-bold mb-3 leading-tight" style={{ color: 'var(--foreground)' }}>
                {product.name}
              </h1>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-extrabold" style={{ color: 'var(--foreground)' }}>
                  {formattedPrice}
                </span>
              </div>

              {/* Stock Status Pill */}
              <div className="mb-6">
                {isAvailable ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: isLowStock ? 'rgba(234, 179, 8, 0.15)' : 'rgba(22, 163, 74, 0.12)' }}>
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: isLowStock ? '#eab308' : 'var(--success)' }} 
                    />
                    <span style={{ color: isLowStock ? '#ca8a04' : 'var(--success)' }}>
                      {isLowStock 
                        ? `Estoque baixo (${product.stock_quantity} restante${product.stock_quantity > 1 ? 's' : ''})` 
                        : `Disponível (${product.stock_quantity} unidades em estoque)`}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--destructive)' }} />
                    <span style={{ color: 'var(--destructive)' }}>Esgotado no momento</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Descrição do produto
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                    {product.description}
                  </p>
                </div>
              )}

              {/* SKU */}
              {product.sku && (
                <p className="text-xs mb-5 font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  SKU: {product.sku}
                </p>
              )}

              {/* Quantity Selector */}
              {isAvailable ? (
                <div className="mb-5">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Quantidade
                  </label>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 border"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      aria-label="Diminuir quantidade"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          handleQuantityChange(val);
                        }
                      }}
                      onBlur={() => {
                        if (!quantity || quantity < 1) setQuantity(1);
                      }}
                      min={1}
                      max={product.stock_quantity}
                      className="w-16 h-10 rounded-xl border text-center text-sm font-semibold focus:outline-none transition-all"
                      style={{ 
                        borderColor: 'var(--border)', 
                        backgroundColor: 'var(--card)', 
                        color: 'var(--foreground)' 
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={quantity >= product.stock_quantity}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 border"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      aria-label="Aumentar quantidade"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
                      máx. {product.stock_quantity}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Add to Cart Button */}
              <button
                type="button"
                disabled={!isAvailable || addingToCart}
                onClick={handleAddToCart}
                className="w-full rounded-xl py-3.5 px-6 text-sm sm:text-base font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)'
                }}
              >
                {addingToCart ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Adicionando ao carrinho...
                  </>
                ) : isAvailable ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Adicionar ao carrinho
                  </>
                ) : (
                  'Produto esgotado'
                )}
              </button>

              {/* Pickup Notice */}
              <div className="mt-5 p-4 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--muted)' }}>
                    <svg className="w-4 h-4" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>
                      Entrega e Retirada no Local
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      Retirada disponível em Santa Luzia - MG ou entrega direta em seu endereço.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Local Footer Component
function Footer() {
  return (
    <footer className="border-t mt-auto" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              <span style={{ color: 'var(--primary)' }}>Saturno</span>Embalagens
            </span>
          </div>
          <Link to="/catalog" className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar ao catálogo
          </Link>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>© 2026 SaturnoEmbalagens. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

