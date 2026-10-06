import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderReceiptPrint, printReceipt, ReceiptData } from '@/components/admin/OrderReceiptPrint';
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
  Tag,
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

export interface ProductVariantItem {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  sort_order: number;
}

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
  variants?: ProductVariantItem[];
}

interface PosCartItem {
  cart_item_id: string;
  product_id: string;
  variant_id?: string | null;
  variant_name?: string | null;
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

  // State: Variants Modal
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [variantQuantities, setVariantQuantities] = useState<Record<string, number>>({});

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
      const [categoriesRes, productsRes, variantsRes] = await Promise.all([
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
        supabase
          .from('product_variants')
          .select('id, product_id, name, sku, price, stock_quantity, is_active, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      // Group variants by product_id
      const variantsByProduct: Record<string, ProductVariantItem[]> = {};
      if (variantsRes.data) {
        variantsRes.data.forEach((v: any) => {
          if (!variantsByProduct[v.product_id]) {
            variantsByProduct[v.product_id] = [];
          }
          variantsByProduct[v.product_id].push({
            id: v.id,
            product_id: v.product_id,
            name: v.name,
            sku: v.sku,
            price: Number(v.price),
            stock_quantity: Number(v.stock_quantity),
            is_active: v.is_active,
            sort_order: v.sort_order ?? 0,
          });
        });
      }

      const rawProducts = (productsRes.data as unknown as Product[]) || [];
      const consolidated: Product[] = rawProducts.map((p) => ({
        ...p,
        variants: variantsByProduct[p.id] || [],
      }));

      setCategories(categoriesRes.data || []);
      setProducts(consolidated);
    } catch (err: unknown) {
      console.error('Erro ao carregar produtos para o PDV:', err);
      toast.error('Erro ao carregar catálogo para o PDV.');
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
      // Search query (name, sku, or variant name/sku)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
        const matchesVariant = p.variants?.some(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (v.sku && v.sku.toLowerCase().includes(q))
        );
        return matchesName || matchesSku || matchesVariant;
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

  const handleAddProductOrOpenVariantModal = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      // Produto possui variações cadastradas -> Abrir modal para escolha do tamanho
      setSelectedProductForVariant(product);
      const initialQty: Record<string, number> = {};
      product.variants.forEach((v) => {
        initialQty[v.id] = 1;
      });
      setVariantQuantities(initialQty);
    } else {
      // Produto simples sem variação -> Adicionar diretamente ao caixa
      handleAddToCartBase(product);
    }
  };

  const handleAddToCartBase = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast.error(`"${product.name}" está sem estoque.`);
      return;
    }

    const cartItemId = `${product.id}_base`;

    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.cart_item_id === cartItemId);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.warning(`Limite de estoque atingido (${product.stock_quantity} un.) para "${product.name}".`);
          return prevCart;
        }
        return prevCart.map((i) =>
          i.cart_item_id === cartItemId
            ? { ...i, quantity: i.quantity + 1, stock_available: product.stock_quantity }
            : i
        );
      } else {
        return [
          ...prevCart,
          {
            cart_item_id: cartItemId,
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

    toast.success(`"${product.name}" adicionado ao caixa.`);
  };

  const handleAddVariantToCart = (product: Product, variant: ProductVariantItem, qty: number = 1) => {
    if (qty <= 0) return;
    if (variant.stock_quantity <= 0) {
      toast.error(`A variação "${variant.name}" está esgotada.`);
      return;
    }

    const cartItemId = `${product.id}_${variant.id}`;
    const displayName = `${product.name} (${variant.name})`;

    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.cart_item_id === cartItemId);
      if (existing) {
        const newTotalQty = existing.quantity + qty;
        if (newTotalQty > variant.stock_quantity) {
          toast.warning(
            `Limite de estoque da variação atingido (${variant.stock_quantity} un.) para "${variant.name}".`
          );
          return prevCart.map((i) =>
            i.cart_item_id === cartItemId
              ? { ...i, quantity: variant.stock_quantity, stock_available: variant.stock_quantity }
              : i
          );
        }
        return prevCart.map((i) =>
          i.cart_item_id === cartItemId
            ? { ...i, quantity: newTotalQty, stock_available: variant.stock_quantity }
            : i
        );
      } else {
        const initialQty = Math.min(qty, variant.stock_quantity);
        return [
          ...prevCart,
          {
            cart_item_id: cartItemId,
            product_id: product.id,
            variant_id: variant.id,
            variant_name: variant.name,
            name: displayName,
            price: variant.price,
            sku: variant.sku || product.sku,
            image_url: product.image_url,
            quantity: initialQty,
            stock_available: variant.stock_quantity,
          },
        ];
      }
    });

    toast.success(`Variação "${variant.name}" (${qty}x) adicionada ao caixa!`);
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.cart_item_id !== cartItemId) return item;
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

  const handleRemoveFromCart = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((i) => i.cart_item_id !== cartItemId));
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
        toast.error(`Quantidade de "${item.name}" excede o estoque disponível (${item.stock_available} un.).`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Determinar dados do cliente
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

      // 2. Inserir pedido no banco com origin = 'pos', delivery_type = 'pickup', status = 'delivered', payment_status = 'paid'
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: customerIdParam,
          customer_name: customerNameParam,
          customer_phone: customerPhoneParam,
          origin: 'pos',
          status: 'delivered',
          payment_status: 'paid',
          payment_method: paymentMethod,
          delivery_type: 'pickup',
          shipping_cost: 0,
          subtotal: subtotal,
          total: subtotal,
          customer_note: customerNote.trim() || null,
        })
        .select()
        .single();

      if (orderErr || !orderData) {
        throw new Error(orderErr?.message || 'Falha ao registrar pedido.');
      }

      const orderId = orderData.id;

      // 3. Inserir itens em public.order_items (snapshot com nome e preço da variação)
      const orderItemsPayload = cart.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity,
        total_price: Math.round(item.price * item.quantity * 100) / 100,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsPayload);
      if (itemsErr) {
        console.error('Erro ao inserir order_items:', itemsErr);
      }

      // 4. Baixar estoque e registrar movimentações de forma segura
      const { data: authUser } = await supabase.auth.getUser();
      const currentAdminId = authUser?.user?.id || null;

      for (const item of cart) {
        // Decrementar estoque da variação se houver
        if (item.variant_id) {
          try {
            const { data: currentVar } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', item.variant_id)
              .single();

            if (currentVar) {
              const newVarStock = Math.max(0, (currentVar.stock_quantity || 0) - item.quantity);
              await supabase
                .from('product_variants')
                .update({ stock_quantity: newVarStock, updated_at: new Date().toISOString() })
                .eq('id', item.variant_id);
            }
          } catch (varStockErr) {
            console.warn('Erro ao atualizar estoque da variação:', varStockErr);
          }
        }

        // Decrementar estoque do produto principal
        try {
          const { data: currentProd } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (currentProd) {
            const newProdStock = Math.max(0, (currentProd.stock_quantity || 0) - item.quantity);
            await supabase
              .from('products')
              .update({ stock_quantity: newProdStock, updated_at: new Date().toISOString() })
              .eq('id', item.product_id);
          }

          // Registrar movimentação de estoque
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            quantity: item.quantity,
            movement_type: 'out',
            reason: `Venda Presencial (PDV) #${orderId.substring(0, 8).toUpperCase()}${item.variant_name ? ` - Variação: ${item.variant_name}` : ''}`,
            reference: orderId,
            performed_by: currentAdminId,
          });
        } catch (stockMoveErr) {
          console.warn('Erro ao registrar baixa de estoque no PDV:', stockMoveErr);
        }
      }

      // 5. Sucesso: Registrar comprovante e abrir modal de finalização
      const receipt: OrderReceipt = {
        order_id: orderId,
        created_at: orderData.created_at || new Date().toISOString(),
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
      toast.error('Erro de conexão ao processar venda presencial: ' + (err instanceof Error ? err.message : 'Falha no banco'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    if (completedOrder) {
      printReceipt(completedOrder);
    }
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
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50 cursor-pointer"
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
                  placeholder="Buscar por nome do produto, variação ou SKU..."
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Categorias Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
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
                    const hasVariants = product.variants && product.variants.length > 0;
                    const inCartItems = cart.filter((i) => i.product_id === product.id);
                    const totalInCart = inCartItems.reduce((acc, i) => acc + i.quantity, 0);

                    // Cálculos de estoque e preços para produtos com e sem variações
                    const totalStock = hasVariants
                      ? product.variants!.reduce((acc, v) => acc + v.stock_quantity, 0)
                      : product.stock_quantity;
                    const isOutOfStock = totalStock <= 0;

                    const minVariantPrice = hasVariants
                      ? Math.min(...product.variants!.map((v) => v.price))
                      : product.price;
                    const maxVariantPrice = hasVariants
                      ? Math.max(...product.variants!.map((v) => v.price))
                      : product.price;

                    return (
                      <div
                        key={product.id}
                        onClick={() => !isOutOfStock && handleAddProductOrOpenVariantModal(product)}
                        className={`
                          group relative flex flex-col justify-between p-3 rounded-xl border transition-all duration-150 text-left
                          ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-muted/20' : 'cursor-pointer hover:border-primary hover:shadow-md active:scale-[0.98]'}
                        `}
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: totalInCart > 0 ? 'var(--primary)' : 'var(--border)',
                        }}
                      >
                        {/* Imagem + Badges */}
                        <div className="space-y-2">
                          <div
                            className="relative aspect-square w-full rounded-lg overflow-hidden bg-muted/40 flex items-center justify-center border"
                            style={{ borderColor: 'var(--border)' }}
                          >
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
                            {totalInCart > 0 && (
                              <div
                                className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1 z-10"
                                style={{ backgroundColor: 'var(--primary)' }}
                              >
                                <span>{totalInCart} no caixa</span>
                              </div>
                            )}

                            {/* Badge de Variações */}
                            {hasVariants ? (
                              <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                <Boxes className="w-3 h-3" />
                                <span>{product.variants!.length} tamanhos</span>
                              </div>
                            ) : product.sku ? (
                              <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                                {product.sku}
                              </div>
                            ) : null}
                          </div>

                          {/* Info do Produto */}
                          <div>
                            <p
                              className="font-semibold text-xs md:text-sm line-clamp-2 leading-tight"
                              style={{ color: 'var(--foreground)' }}
                            >
                              {product.name}
                            </p>
                            {product.category?.name && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {product.category.name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Preço, Estoque e Botão */}
                        <div className="pt-2 mt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex items-end justify-between gap-1">
                            <div>
                              <span className="text-xs text-muted-foreground block text-[10px]">
                                {hasVariants && minVariantPrice !== maxVariantPrice
                                  ? 'A partir de'
                                  : 'Preço unitário'}
                              </span>
                              <span className="font-bold text-sm md:text-base" style={{ color: 'var(--primary)' }}>
                                {formatCurrency(minVariantPrice)}
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
                                    totalInCart > 0
                                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                  }`}
                                >
                                  {totalStock} un.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Botão de Ação Rápida para Variações */}
                          {hasVariants && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddProductOrOpenVariantModal(product);
                              }}
                              disabled={isOutOfStock}
                              className="w-full py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
                              style={{
                                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                                borderColor: 'rgba(234, 88, 12, 0.3)',
                                color: 'var(--primary)',
                              }}
                            >
                              <Boxes className="w-3.5 h-3.5" />
                              <span>Escolher Tamanho</span>
                            </button>
                          )}
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
                    className="text-xs text-destructive hover:underline font-medium flex items-center gap-1 cursor-pointer"
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
                    <div key={item.cart_item_id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                      {/* Info Item */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-xs md:text-sm truncate" style={{ color: 'var(--foreground)' }}>
                            {item.variant_name ? item.name.replace(` (${item.variant_name})`, '') : item.name}
                          </p>
                          {item.variant_name && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                backgroundColor: 'rgba(234, 88, 12, 0.12)',
                                borderColor: 'rgba(234, 88, 12, 0.3)',
                                color: 'var(--primary)',
                              }}
                            >
                              <Boxes className="w-2.5 h-2.5" />
                              {item.variant_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatCurrency(item.price)} un.</span>
                          {item.sku && <span>• SKU: {item.sku}</span>}
                        </div>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cart_item_id, -1)}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs md:text-sm" style={{ color: 'var(--foreground)' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cart_item_id, 1)}
                          disabled={item.quantity >= item.stock_available}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                          onClick={() => handleRemoveFromCart(item.cart_item_id)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
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
                      className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
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
                      className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                        customerMode === 'manual' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Informar dados
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('registered')}
                      className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
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
                          className="text-xs text-destructive hover:underline font-medium cursor-pointer"
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
                          p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer
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
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
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
          MODAL DE ESCOLHA DE VARIAÇÃO / TAMANHO DO PRODUTO
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={!!selectedProductForVariant}
        onOpenChange={(open) => !open && setSelectedProductForVariant(null)}
      >
        <DialogContent
          className="max-w-md sm:max-w-lg p-0 overflow-hidden"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {selectedProductForVariant && (
            <div className="flex flex-col">
              {/* Header do Modal */}
              <div
                className="p-4 sm:p-5 border-b flex items-start gap-3.5"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)/30' }}
              >
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-background border flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {selectedProductForVariant.image_url ? (
                    <img
                      src={selectedProductForVariant.image_url}
                      alt={selectedProductForVariant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1"
                    style={{ backgroundColor: 'rgba(234, 88, 12, 0.12)', color: 'var(--primary)' }}
                  >
                    <Boxes className="w-3 h-3" />
                    Variações de Tamanho / Preço
                  </span>
                  <h3
                    className="text-sm sm:text-base font-bold leading-snug line-clamp-2"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {selectedProductForVariant.name}
                  </h3>
                  {selectedProductForVariant.category?.name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedProductForVariant.category.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Lista de Variações */}
              <div className="p-4 sm:p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-muted-foreground">
                  Escolha o tamanho/variação desejada e a quantidade para adicionar ao caixa da venda:
                </p>

                <div className="space-y-2.5">
                  {selectedProductForVariant.variants && selectedProductForVariant.variants.length > 0 ? (
                    selectedProductForVariant.variants.map((variant) => {
                      const cartItemId = `${selectedProductForVariant.id}_${variant.id}`;
                      const inCart = cart.find((i) => i.cart_item_id === cartItemId);
                      const inCartQty = inCart?.quantity || 0;
                      const isVariantOutOfStock = variant.stock_quantity <= 0;
                      const currentSelectedQty = variantQuantities[variant.id] || 1;
                      const isMaxReached = inCartQty >= variant.stock_quantity;

                      return (
                        <div
                          key={variant.id}
                          className={`
                            p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3
                            ${isVariantOutOfStock ? 'opacity-50 bg-muted/20 border-dashed' : 'hover:border-primary/60 bg-background'}
                          `}
                          style={{
                            borderColor: inCart ? 'var(--primary)' : 'var(--border)',
                          }}
                        >
                          {/* Info da Variação */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-bold text-xs sm:text-sm"
                                style={{ color: 'var(--foreground)' }}
                              >
                                {variant.name}
                              </span>
                              {variant.sku && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                  {variant.sku}
                                </span>
                              )}
                              {inCartQty > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-xs"
                                  style={{ backgroundColor: 'var(--primary)' }}
                                >
                                  {inCartQty} no caixa
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <span
                                className="font-extrabold text-sm"
                                style={{ color: 'var(--primary)' }}
                              >
                                {formatCurrency(variant.price)}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span
                                className={`text-[11px] font-medium ${
                                  isVariantOutOfStock
                                    ? 'text-destructive font-bold'
                                    : 'text-emerald-600 font-semibold'
                                }`}
                              >
                                {isVariantOutOfStock ? 'Sem estoque' : `${variant.stock_quantity} un. disponíveis`}
                              </span>
                            </div>
                          </div>

                          {/* Seletor de Quantidade e Botão Adicionar */}
                          <div className="flex items-center gap-2 justify-end sm:justify-start">
                            {!isVariantOutOfStock && (
                              <div
                                className="flex items-center rounded-lg border bg-muted/20 p-0.5"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVariantQuantities((prev) => ({
                                      ...prev,
                                      [variant.id]: Math.max(1, (prev[variant.id] || 1) - 1),
                                    }))
                                  }
                                  disabled={currentSelectedQty <= 1}
                                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-background transition-colors disabled:opacity-30 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center text-xs font-bold">
                                  {currentSelectedQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVariantQuantities((prev) => ({
                                      ...prev,
                                      [variant.id]: Math.min(
                                        variant.stock_quantity - inCartQty,
                                        (prev[variant.id] || 1) + 1
                                      ),
                                    }))
                                  }
                                  disabled={currentSelectedQty >= variant.stock_quantity - inCartQty}
                                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-background transition-colors disabled:opacity-30 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                handleAddVariantToCart(
                                  selectedProductForVariant,
                                  variant,
                                  currentSelectedQty
                                );
                              }}
                              disabled={isVariantOutOfStock || isMaxReached}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                              style={{ backgroundColor: 'var(--primary)' }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                {isMaxReached
                                  ? 'Limite Atingido'
                                  : isVariantOutOfStock
                                  ? 'Esgotado'
                                  : 'Adicionar'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Nenhuma variação cadastrada para este produto.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer do Modal */}
              <div
                className="p-4 border-t bg-muted/20 flex items-center justify-between gap-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="text-xs text-muted-foreground">
                  <span>Itens no caixa desta venda: </span>
                  <strong className="text-foreground font-bold">{totalItemsCount} un.</strong>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProductForVariant(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 cursor-pointer shadow-xs"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  Concluir / Fechar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </AdminLayout>
  );
}
