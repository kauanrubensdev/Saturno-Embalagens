import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      <div className="min-h-screen" style={{ backgroundColor: '#fcfbf8' }}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div style={{ backgroundColor: '#e5e5e5', height: '400px', borderRadius: '16px' }} />
              <div className="space-y-4">
                <div style={{ backgroundColor: '#e5e5e5', height: '12px', borderRadius: '4px', width: '40%' }} />
                <div style={{ backgroundColor: '#e5e5e5', height: '32px', borderRadius: '4px', width: '80%' }} />
                <div style={{ backgroundColor: '#e5e5e5', height: '24px', borderRadius: '4px', width: '30%' }} />
                <div style={{ backgroundColor: '#e5e5e5', height: '80px', borderRadius: '8px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fcfbf8' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#fef2f2' }}>
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1a1a' }}>Produto não encontrado</h2>
          <p className="text-sm mb-6" style={{ color: '#666666' }}>Este produto pode ter sido removido ou desativado.</p>
          <Link to="/catalog" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold no-underline transition-colors hover:opacity-90" style={{ backgroundColor: '#FF6B00', color: '#ffffff' }}>
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    );
  }

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

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8" style={{ color: '#999999' }}>
          <Link to="/" className="no-underline transition-colors" style={{ color: '#999999' }}>Início</Link>
          <span>/</span>
          <Link to="/catalog" className="no-underline transition-colors" style={{ color: '#999999' }}>Catálogo</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link to={`/catalog/${product.category.slug}`} className="no-underline transition-colors" style={{ color: '#999999' }}>
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span style={{ color: '#1a1a1a' }} className="truncate max-w-xs">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-3">
            <div
              className="rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: '#f5f5f5', minHeight: '360px' }}
            >
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" style={{ maxHeight: '500px' }} />
              ) : (
                <svg className="w-20 h-20" style={{ color: '#d1d5db' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
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
                      borderColor: selectedImage === img ? '#FF6B00' : '#e5e5e5',
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
                style={{ color: '#FF6B00' }}
              >
                {product.category.name}
              </Link>
            )}

            <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: '#1a1a1a' }}>
              {product.name}
            </h1>

            <div className="mb-6">
              <span className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>{formattedPrice}</span>
            </div>

            {/* Stock Status */}
            <div className="mb-6">
              {isAvailable ? (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} />
                  <span className="text-sm font-medium" style={{ color: '#16a34a' }}>
                    Disponível ({product.stock_quantity} unidades)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#dc2626' }} />
                  <span className="text-sm font-medium" style={{ color: '#dc2626' }}>Esgotado</span>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>Descrição</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#666666' }}>
                  {product.description}
                </p>
              </div>
            )}

            {/* SKU */}
            {product.sku && (
              <p className="text-xs mb-6" style={{ color: '#999999' }}>SKU: {product.sku}</p>
            )}

            {/* Add to Cart Button */}
            <button
              disabled={!isAvailable}
              className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#FF6B00' }}
              onClick={() => {
                // Prepared for future cart implementation
                alert('Carrinho será implementado na próxima fase.');
              }}
            >
              {isAvailable ? 'Adicionar ao carrinho' : 'Produto esgotado'}
            </button>

            {/* Pickup Info */}
            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#FF6B00' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: '#1a1a1a' }}>Opção de retirada</p>
                  <p className="text-xs" style={{ color: '#666666' }}>
                    Retire na R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t mt-12" style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}>
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-2" style={{ color: '#FF6B00' }}>
            ← Voltar ao catálogo
          </Link>
          <p className="text-xs" style={{ color: '#999999' }}>© 2025 SaturnoEmbalagens. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
