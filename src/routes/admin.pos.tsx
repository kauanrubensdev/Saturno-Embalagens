import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderReceiptPrint, printReceipt80mm, ReceiptData } from '@/components/admin/OrderReceiptPrint';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Phone,
  Package,
  RefreshCw,
  Store,
  Receipt,
  ChevronRight,
  Check,
  FileText,
  Boxes,
} from 'lucide-react';

export const Route = createFileRoute('/admin/pos')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) {
      return;
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
    if (!context.auth?.profile || context.auth.profile.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminPosPage,
});

// ─── Domain Types ────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
  category_id: string;
  category?: { id: string; name: string } | null;
}

interface PosCartItem {
  product_id: string;
  name: string;
  price: number;
  sku: string | null;
  image_url: string | null;
  quantity: number;
  stock_available: number;
}

type PosPaymentMethod = 'cash' | 'pix_pos' | 'debit_card' | 'credit_card';

interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
}

interface OrderReceipt {
  order_id: string;
  created_at: string;
  payment_method: PosPaymentMethod;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  customer_note: string | null;
  items: PosCartItem[];
  subtotal: number;
  total: number;
}

// ─── Payment Methods Config ──────────────────────────────────────────────────

const PAYMENT_METHODS: {
  id: PosPaymentMethod;
  label: string;
  subtitle: string;
  icon: typeof Banknote;
}[] = [
  {
    id: 'cash',
    label: 'Dinheiro',
    subtitle: 'Pagamento em espécie',
    icon: Banknote,
  },
  {
    id: 'pix_pos',
    label: 'PIX (Balcão)',
    subtitle: 'Chave ou QR Code local',
    icon: QrCode,
  },
  {
    id: 'debit_card',
    label: 'Cartão de Débito',
    subtitle: 'Maquininha presencial',
    icon: CreditCard,
  },
  {
    id: 'credit_card',
    label: 'Cartão de Crédito',
    subtitle: 'Maquininha presencial',
    icon: CreditCard,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

function AdminPosPage() {
  // State: Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // State: POS Cart
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [customerNote, setCustomerNote] = useState('');

  // State: Customer
  const [customerMode, setCustomerMode] = useState<'anonymous' | 'manual' | 'registered'>('anonymous');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerProfile[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

  // State: Checkout & Receipt
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderReceipt | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Load Data ─────────────────────────────────────────────────────────────

  const loadCatalog = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, slug')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('products')
          .select(`
            id,
            name,
            slug,
            sku,
            price,
            stock_quantity,
            image_url,
            is_active,
            category_id,
            category:categories(id, name)
          `)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      setCategories(categoriesRes.data || []);
      setProducts((productsRes.data as unknown as Product[]) || []);
    } catch (err: unknown) {
      console.error('Erro ao carregar produtos para o PDV:', err);
      toast.error('Erro ao carregar produtos. Verifique a conexão.');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // ─── Customer Search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (customerMode !== 'registered' || !customerSearchQuery.trim()) {
      setCustomerSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const query = customerSearchQuery.trim();
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, phone')
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(6);

        if (error) throw error;
        setCustomerSearchResults(data || []);
      } catch (err) {
        console.error('Erro ao buscar clientes:', err);
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerSearchQuery, customerMode]);

  // ─── Filtered Products ─────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) {
        return false;
      }
      // Search query (name or sku)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
        return matchesName || matchesSku;
      }
      return true;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // ─── Cart Calculations ─────────────────────────────────────────────────────

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // ─── Cart Actions ──────────────────────────────────────────────────────────

  const handleAddToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast.error(`"${product.name}" está sem estoque.`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.warning(`Limite de estoque atingido (${product.stock_quantity} un.) para "${product.name}".`);
          return prevCart;
        }
        return prevCart.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, stock_available: product.stock_quantity }
            : i
        );
      } else {
        return [
          ...prevCart,
          {
            product_id: product.id,
            name: product.name,
            price: product.price,
            sku: product.sku,
            image_url: product.image_url,
            quantity: 1,
            stock_available: product.stock_quantity,
          },
        ];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product_id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock_available) {
            toast.warning(`Estoque máximo disponível: ${item.stock_available} un.`);
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as PosCartItem[];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((i) => i.product_id !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setCustomerNote('');
    toast.info('Carrinho do caixa limpo.');
  };

  // ─── Finalize Sale ─────────────────────────────────────────────────────────

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.error('Adicione pelo menos um produto para finalizar a venda.');
      return;
    }

    if (!paymentMethod) {
      toast.error('Selecione uma forma de pagamento.');
      return;
    }

    // Verificar estoque conhecido no frontend antes de enviar
    for (const item of cart) {
      if (item.quantity > item.stock_available) {
        toast.error(`Quantidade de "${item.name}" excede o estoque disponível.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Preparar itens para a RPC (enviando apenas product_id e quantity)
      const rpcItems = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // 2. Determinar dados do cliente
      let customerNameParam: string | null = null;
      let customerPhoneParam: string | null = null;
      let customerIdParam: string | null = null;

      if (customerMode === 'registered' && selectedCustomer) {
        customerIdParam = selectedCustomer.id;
        customerNameParam = selectedCustomer.name || null;
        customerPhoneParam = selectedCustomer.phone || null;
      } else if (customerMode === 'manual') {
        customerNameParam = manualName.trim() || null;
        customerPhoneParam = manualPhone.trim() || null;
      }

      // 3. Executar RPC no Supabase
      const { data, error } = await supabase.rpc('admin_create_pos_order', {
        p_items: rpcItems,
        p_payment_method: paymentMethod,
        p_customer_name: customerNameParam,
        p_customer_phone: customerPhoneParam,
        p_customer_id: customerIdParam,
        p_customer_note: customerNote.trim() || null,
      });

      if (error) {
        console.error('Erro na RPC admin_create_pos_order:', error);
        // Tratar erro amigável de estoque ou autorização
        if (
          error.message?.toLowerCase().includes('estoque') ||
          error.message?.toLowerCase().includes('stock') ||
          error.message?.toLowerCase().includes('inativo')
        ) {
          toast.error(
            'Um dos produtos ficou sem estoque ou teve a quantidade alterada. O catálogo foi recarregado. Tente novamente.'
          );
        } else if (error.message?.toLowerCase().includes('autorizado') || error.message?.toLowerCase().includes('negado')) {
          toast.error('Acesso não autorizado para emissão de vendas no PDV.');
        } else {
          toast.error('Não foi possível finalizar a venda: ' + (error.message || 'Erro inesperado.'));
        }
        // Recarregar catálogo em caso de falha de estoque
        await loadCatalog();
        return;
      }

      // 4. Sucesso: Registrar comprovante e abrir modal de finalização
      const resultData = data as Record<string, unknown>;
      const orderId = (resultData?.order_id as string) || 'PEDIDO-PDV';

      const receipt: OrderReceipt = {
        order_id: orderId,
        created_at: new Date().toISOString(),
        payment_method: paymentMethod,
        customer_name: customerNameParam,
        customer_phone: customerPhoneParam,
        customer_id: customerIdParam,
        customer_note: customerNote.trim() || null,
        items: [...cart],
        subtotal: subtotal,
        total: subtotal,
      };

      setCompletedOrder(receipt);
      setReceiptModalOpen(true);

      // Limpar formulário de venda
      setCart([]);
      setCustomerNote('');
      setManualName('');
      setManualPhone('');
      setSelectedCustomer(null);
      setCustomerMode('anonymous');

      toast.success('Venda presencial registrada com sucesso!');

      // Recarregar catálogo para sincronizar estoque atualizado
      await loadCatalog();
    } catch (err: unknown) {
      console.error('Erro inesperado ao registrar venda:', err);
      toast.error('Erro de conexão ao processar venda presencial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleStartNewSale = () => {
    setReceiptModalOpen(false);
    setCompletedOrder(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // ─── Format Helpers ────────────────────────────────────────────────────────

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getPaymentMethodLabel = (id: PosPaymentMethod) => {
    switch (id) {
      case 'cash':
        return 'Dinheiro (Espécie)';
      case 'pix_pos':
        return 'PIX Presencial';
      case 'debit_card':
        return 'Cartão de Débito';
      case 'credit_card':
        return 'Cartão de Crédito';
      default:
        return id;
    }
  };

  return (
    <AdminLayout>
      {/* Container principal do PDV */}
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        {/* Top Header / Status bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                  Caixa / PDV
                </h1>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border uppercase"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                  }}
                >
                  Online • Balcão
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Registro seguro de vendas presenciais com baixa automática no estoque
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCatalog}
              disabled={isLoadingProducts}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              title="Recarregar produtos e estoques"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
              <span>Atualizar Catálogo</span>
            </button>
          </div>
        </div>

        {/* Layout 2 Colunas: Produtos (Esquerda) e Caixa/Carrinho (Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ══════════════════════════════════════════════════════════════════════
              COLUNA ESQUERDA: CATÁLOGO & BUSCA DE PRODUTOS (7 Colunas LG)
          ══════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-4">
            {/* Barra de Busca e Filtros */}
            <div
              className="p-4 rounded-xl border shadow-sm space-y-3"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nome do produto ou SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Categorias Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategoryId === 'all'
                      ? 'shadow-sm text-white'
                      : 'border hover:bg-muted/50'
                  }`}
                  style={
                    selectedCategoryId === 'all'
                      ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                      : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                  }
                >
                  Todas as Categorias
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedCategoryId === cat.id
                        ? 'shadow-sm text-white'
                        : 'border hover:bg-muted/50'
                    }`}
                    style={
                      selectedCategoryId === cat.id
                        ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                        : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                    }
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Produtos */}
            <div
              className="p-4 rounded-xl border shadow-sm min-h-[500px]"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Produtos Disponíveis ({filteredProducts.length})
                </span>
                {isLoadingProducts && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                )}
              </div>

              {isLoadingProducts ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
                  <p className="text-sm">Carregando catálogo do caixa...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Package className="w-10 h-10 mx-auto opacity-30" />
                  <p className="font-medium text-sm">Nenhum produto encontrado</p>
                  <p className="text-xs">Tente buscar por outro termo ou selecione outra categoria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[620px] overflow-y-auto pr-1">
                  {filteredProducts.map((product) => {
                    const isOutOfStock = product.stock_quantity <= 0;
                    const inCartItem = cart.find((i) => i.product_id === product.id);
                    const isMaxInCart = inCartItem && inCartItem.quantity >= product.stock_quantity;

                    return (
                      <div
                        key={product.id}
                        onClick={() => !isOutOfStock && handleAddToCart(product)}
                        className={`
                          group relative flex flex-col justify-between p-3 rounded-xl border transition-all duration-150 text-left
                          ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-muted/20' : 'cursor-pointer hover:border-primary hover:shadow-md active:scale-[0.98]'}
                        `}
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: inCartItem ? 'var(--primary)' : 'var(--border)',
                        }}
                      >
                        {/* Imagem + Badge de Estoque */}
                        <div className="space-y-2">
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-muted/40 flex items-center justify-center border" style={{ borderColor: 'var(--border)' }}>
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="w-8 h-8 text-muted-foreground/40" />
                            )}

                            {/* Badge Qtd no Carrinho */}
                            {inCartItem && (
                              <div
                                className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1"
                                style={{ backgroundColor: 'var(--primary)' }}
                              >
                                <span>{inCartItem.quantity} no caixa</span>
                              </div>
                            )}

                            {/* Badge de SKU */}
                            {product.sku && (
                              <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                                {product.sku}
                              </div>
                            )}
                          </div>

                          {/* Info do Produto */}
                          <div>
                            <p className="font-semibold text-xs md:text-sm line-clamp-2 leading-tight" style={{ color: 'var(--foreground)' }}>
                              {product.name}
                            </p>
                            {product.category?.name && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {product.category.name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Preço e Estoque */}
                        <div className="pt-2 mt-2 border-t flex items-end justify-between gap-1" style={{ borderColor: 'var(--border)' }}>
                          <div>
                            <span className="text-xs text-muted-foreground block text-[10px]">Preço unitário</span>
                            <span className="font-bold text-sm md:text-base" style={{ color: 'var(--primary)' }}>
                              {formatCurrency(product.price)}
                            </span>
                          </div>

                          <div className="text-right">
                            {isOutOfStock ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">
                                Esgotado
                              </span>
                            ) : (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                                  isMaxInCart ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                }`}
                              >
                                {product.stock_quantity} un.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              COLUNA DIREITA: CAIXA / CARRINHO / CLIENTE / PAGAMENTO (5 Colunas LG)
          ══════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-4">
            <div
              className="rounded-xl border shadow-sm overflow-hidden"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Header do Carrinho */}
              <div
                className="p-4 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)/20' }}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
                    Venda Presencial
                  </h2>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-xs text-destructive hover:underline font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>

              {/* Lista de Itens no Carrinho */}
              <div className="p-4 max-h-[300px] overflow-y-auto space-y-2.5 divide-y divide-border/40">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <ShoppingBag className="w-10 h-10 mx-auto opacity-30" />
                    <p className="text-sm font-medium">Caixa vazio</p>
                    <p className="text-xs max-w-[240px] mx-auto">
                      Clique nos produtos ao lado para adicionar ao carrinho da venda.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product_id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                      {/* Info Item */}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs md:text-sm truncate" style={{ color: 'var(--foreground)' }}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatCurrency(item.price)} un.</span>
                          {item.sku && <span>• SKU: {item.sku}</span>}
                        </div>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product_id, -1)}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted/60 transition-colors"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs md:text-sm" style={{ color: 'var(--foreground)' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product_id, 1)}
                          disabled={item.quantity >= item.stock_available}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtotal do Item & Remover */}
                      <div className="flex items-center gap-2 text-right">
                        <span className="font-bold text-xs md:text-sm min-w-[70px]" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.product_id)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Seção: Cliente (Opcional) */}
              <div className="p-4 border-t space-y-3 bg-muted/10" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Cliente (Opcional)
                  </span>

                  {/* Tabs de Modo de Cliente */}
                  <div className="flex rounded-lg border p-0.5 bg-background text-[11px]" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('anonymous');
                        setSelectedCustomer(null);
                      }}
                      className={`px-2 py-0.5 rounded font-medium transition-all ${
                        customerMode === 'anonymous' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Sem cadastro
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('manual');
                        setSelectedCustomer(null);
                      }}
                      className={`px-2 py-0.5 rounded font-medium transition-all ${
                        customerMode === 'manual' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Informar dados
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('registered')}
                      className={`px-2 py-0.5 rounded font-medium transition-all ${
                        customerMode === 'registered' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Cadastrado
                    </button>
                  </div>
                </div>

                {/* Campos Manuais */}
                {customerMode === 'manual' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Nome do cliente</Label>
                      <Input
                        placeholder="Ex: João da Silva"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Telefone / WhatsApp</Label>
                      <Input
                        placeholder="Ex: (11) 98765-4321"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Busca de Cliente Cadastrado */}
                {customerMode === 'registered' && (
                  <div className="space-y-2 pt-1">
                    {selectedCustomer ? (
                      <div
                        className="flex items-center justify-between p-2.5 rounded-lg border bg-background"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {selectedCustomer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-xs" style={{ color: 'var(--foreground)' }}>
                              {selectedCustomer.name}
                            </p>
                            {selectedCustomer.phone && (
                              <p className="text-[11px] text-muted-foreground">
                                {selectedCustomer.phone}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-xs text-destructive hover:underline font-medium"
                        >
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar cliente cadastrado por nome ou telefone..."
                          value={customerSearchQuery}
                          onChange={(e) => setCustomerSearchQuery(e.target.value)}
                          className="pl-9 h-8 text-xs"
                        />
                        {isSearchingCustomers && (
                          <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}

                        {/* Resultados da busca */}
                        {customerSearchResults.length > 0 && (
                          <div
                            className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border shadow-lg overflow-hidden bg-card divide-y"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            {customerSearchResults.map((cust) => (
                              <div
                                key={cust.id}
                                onClick={() => {
                                  setSelectedCustomer(cust);
                                  setCustomerSearchQuery('');
                                  setCustomerSearchResults([]);
                                }}
                                className="p-2 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <span className="font-medium text-xs text-foreground">{cust.name}</span>
                                <span className="text-[11px] text-muted-foreground">{cust.phone || 'Sem telefone'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seção: Forma de Pagamento */}
              <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Forma de Pagamento
                </span>

                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const isSelected = paymentMethod === method.id;
                    const IconComponent = method.icon;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`
                          p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all
                          ${isSelected ? 'border-primary ring-1 ring-primary/30 shadow-sm' : 'hover:border-border hover:bg-muted/20'}
                        `}
                        style={{
                          backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--background)',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        }}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold text-xs leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {method.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {method.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Observação Opcional */}
              <div className="p-4 border-t bg-muted/5 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
                <Label className="text-[11px] text-muted-foreground">Observação do Pedido (Opcional)</Label>
                <Input
                  placeholder="Ex: Troco para R$ 100,00, retirar às 17h..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Resumo Financeiro e Finalização */}
              <div className="p-4 border-t bg-muted/20 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'})</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Frete / Retirada</span>
                    <span className="font-semibold text-emerald-600">R$ 0,00 (Balcão)</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t text-base font-bold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                    <span>Total da Venda</span>
                    <span className="text-xl font-extrabold" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>

                {/* Botão Finalizar Venda */}
                <button
                  type="button"
                  onClick={handleFinalizeSale}
                  disabled={cart.length === 0 || isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processando Venda...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Finalizar Venda ({formatCurrency(subtotal)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL DE CONFIRMAÇÃO & RECIBO DE VENDA (COMPROVANTE)
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border">
          {completedOrder && (
            <div className="flex flex-col">
              {/* Header de Sucesso */}
              <div
                className="p-6 text-center text-white space-y-2"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <div className="w-12 h-12 rounded-full bg-white/20 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold">Venda Finalizada com Sucesso!</h3>
                <p className="text-xs text-white/80 font-mono">
                  Pedido #{completedOrder.order_id.substring(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Visualização do Comprovante Reutilizável */}
              <div className="p-4 bg-muted/10 max-h-[55vh] overflow-y-auto flex justify-center">
                <div className="bg-white text-black rounded-lg shadow-sm border border-neutral-300 overflow-hidden">
                  <OrderReceiptPrint order={completedOrder} isPrintOnly={false} />
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row gap-2 no-print" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-2.5 px-3 rounded-lg border font-semibold text-xs flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Comprovante</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartNewSale}
                  className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs text-white shadow flex items-center justify-center gap-2 transition-all hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Venda</span>
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── COMPONENTE E ESTILOS DE IMPRESSÃO 80MM (CUPOM TÉRMICO) ── */}
      <OrderReceiptPrint order={completedOrder} isPrintOnly={true} />

      <style>{`
        @media screen {
          .saturno-receipt-sheet-80mm.print-only {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          .saturno-receipt-sheet-80mm,
          .saturno-receipt-sheet-80mm * {
            visibility: visible !important;
          }
          .saturno-receipt-sheet-80mm {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
