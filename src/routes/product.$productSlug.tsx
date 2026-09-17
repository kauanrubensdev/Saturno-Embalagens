import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { CartBadge } from '@/components/customer/CartBadge';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/customer/ThemeToggle';

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
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const { user } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    setError(null);

    supabase
      .from('products')
      .select('id, name, slug, description, price, stock_quantity, sku, image_url, images, is_active, category:categories(id, name, slug)')
      .eq('slug', productSlug)
      .eq('is_active', true)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setError('Produto não encontrado.');
          setLoading(false);
          return;
        }
        const productData = data as unknown as ProductDetail;
        setProduct(productData);
        setSelectedImage(productData.image_url);
        setLoading(false);
      });
  }, [productSlug]);

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Faça login para adicionar itens ao carrinho');
      return;
    }

    if (!product || product.stock_quantity === 0) {
      toast.error('Produto não disponível');
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
    if (!product) return;
    if (newQty < 1) return;
    if (newQty > product.stock_quantity) {
      toast.error(`Quantidade máxima disponível: ${product.stock_quantity}`);
      return;
    }
    setQuantity(newQty);
  };

  const allImages = product?.images?.length
    ? product.images
    : product?.image_url
    ? [product.image_url]
    : [];

  const isAvailable = (product?.stock_quantity ?? 0) > 0;

  const formattedPrice = product
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)
    : '';

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <Header user={user} />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              <div className="space-y-4">
                <div style={{ backgroundColor: 'var(--muted)', height: '400px', borderRadius: '16px' }} />
                <div className="flex gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ backgroundColor: 'var(--muted)', height: '72px', width: '72px', borderRadius: '12px' }} />
                  ))}
                </div>
              </div>
              <div className="space-y-5">
                <div style={{ backgroundColor: 'var(--muted)', height: '14px', borderRadius: '6px', width: '25%' }} />
                <div style={{ backgroundColor: 'var(--muted)', height: '36px', borderRadius: '8px', width: '85%' }} />
                <div style={{ backgroundColor: 'var(--muted)', height: '32px', borderRadius: '8px', width: '30%' }} />
                <div style={{ backgroundColor: 'var(--muted)', height: '60px', borderRadius: '8px' }} />
                <div style={{ backgroundColor: 'var(--muted)', height: '48px', borderRadius: '12px', width: '60%' }} />
                <div style={{ backgroundColor: 'var(--muted)', height: '48px', borderRadius: '12px' }} />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--muted)' }}>
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>Produto não encontrado</h1>
            <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>Este produto pode ter sido removido ou desativado do catálogo.</p>
            <Link to="/catalog" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold no-underline transition-all hover:opacity-90" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar ao catálogo
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header user={user} />
      <main className="flex-1">
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
            <CartBadge />
            {user ? (
              <Link
                to="/account"
                className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
              >
                Minha conta
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Entrar
              </Link>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
          <Link to="/" className="no-underline transition-colors" style={{ color: 'var(--muted-foreground)' }}>Início</Link>
          <span>/</span>
          <Link to="/catalog" className="no-underline transition-colors" style={{ color: 'var(--muted-foreground)' }}>Catálogo</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link
                to="/catalog/$categorySlug"
                params={{ categorySlug: product.category.slug }}
                className="no-underline transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span style={{ color: 'var(--foreground)' }} className="truncate max-w-xs">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-3">
            <div
              className="rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: 'var(--muted)', minHeight: '360px' }}
            >
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" style={{ maxHeight: '500px' }} />
              ) : (
                <svg className="w-20 h-20" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(img)}
                    className="flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer"
                    style={{
                      width: '72px',
                      height: '72px',
                      borderColor: selectedImage === img ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    <img src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category && (
              <Link
                to="/catalog/$categorySlug"
                params={{ categorySlug: product.category.slug }}
                className="inline-block text-sm font-medium mb-2 no-underline transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                {product.category.name}
              </Link>
            )}

            <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>
              {product.name}
            </h1>

            <div className="mb-6">
              <span className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{formattedPrice}</span>
            </div>

            {/* Stock Status */}
            <div className="mb-6">
              {isAvailable ? (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                    Disponível ({product.stock_quantity} unidades)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--destructive)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--destructive)' }}>Esgotado</span>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Descrição</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--muted-foreground)' }}>
                  {product.description}
                </p>
              </div>
            )}

            {/* SKU */}
            {product.sku && (
              <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>SKU: {product.sku}</p>
            )}

            {/* Quantity Selector */}
            {isAvailable && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Quantidade</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    min={1}
                    max={product.stock_quantity}
                    className="w-16 h-10 rounded-lg border text-center text-sm font-medium"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= product.stock_quantity}
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Add to Cart Button */}
            <button
              disabled={!isAvailable || addingToCart}
              onClick={handleAddToCart}
              className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {addingToCart ? 'Adicionando...' : isAvailable ? 'Adicionar ao carrinho' : 'Produto esgotado'}
            </button>

            {/* Pickup Info */}
            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--muted)' }}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>Opção de retirada</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Retire na R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG
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

// Local Header Component
function Header({ user }: { user: unknown }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
        </Link>
        <div className="flex items-center gap-2">
          <CartBadge />
          {user ? (
            <Link to="/account" className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-all hover:opacity-80" style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}>
              Minha conta
            </Link>
          ) : (
            <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg no-underline transition-all hover:opacity-80" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              Entrar
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
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
            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>SaturnoEmbalagens</span>
          </div>
          <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-medium no-underline transition-colors hover:opacity-80" style={{ color: 'var(--primary)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar ao catálogo
          </Link>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>© 2025 SaturnoEmbalagens. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
