import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/customer/Header';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Truck,
  Building2,
  Banknote,
  MapPin,
  Plus,
  Check,
  CheckCircle2,
  ArrowLeft,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Phone,
  FileText,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const Route = createFileRoute('/checkout')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) {
      return;
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: CheckoutPage,
});

interface CustomerAddress {
  id: string;
  user_id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

interface CompletedOrderData {
  id: string;
  created_at: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  delivery_type: 'delivery' | 'pickup';
  payment_method: string;
  customer_note: string | null;
  shipping_address?: CustomerAddress | null;
  pickup_address?: string | null;
  items: {
    product_name: string;
    product_price: number;
    quantity: number;
    total_price: number;
  }[];
}

const PICKUP_ADDRESS_TEXT =
  'R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140';

export function CheckoutPage() {
  const { authReady, user } = useAuth();
  const { cart, loading: cartLoading, clearCart, getSubtotal } = useCart();
  const navigate = useNavigate();

  // Form states
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery'>('cash_on_delivery');
  const [customerNote, setCustomerNote] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // New address modal state
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [addressForm, setAddressForm] = useState({
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_default: false,
  });

  // Submission & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrderData | null>(null);

  // Fetch customer addresses
  useEffect(() => {
    if (!user) return;

    const fetchAddresses = async () => {
      try {
        setLoadingAddresses(true);
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        const addrList = (data as CustomerAddress[]) || [];
        setAddresses(addrList);

        if (addrList.length > 0) {
          const defaultAddr = addrList.find((a) => a.is_default) || addrList[0];
          setSelectedAddressId(defaultAddr.id);
        }
      } catch (err) {
        console.error('[CHECKOUT] Erro ao carregar endereços:', err);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, [user]);

  // Handle CEP auto-fill
  const handleCepBlur = async () => {
    const rawCep = addressForm.zip_code.replace(/\D/g, '');
    if (rawCep.length !== 8) return;

    try {
      setSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddressForm((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch (err) {
      console.warn('[CHECKOUT] Erro ao consultar CEP:', err);
    } finally {
      setSearchingCep(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (
      !addressForm.zip_code ||
      !addressForm.street ||
      !addressForm.number ||
      !addressForm.neighborhood ||
      !addressForm.city ||
      !addressForm.state
    ) {
      toast.error('Preencha todos os campos obrigatórios do endereço.');
      return;
    }

    try {
      setSavingAddress(true);
      const isFirst = addresses.length === 0;

      const { data, error } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          zip_code: addressForm.zip_code.trim(),
          street: addressForm.street.trim(),
          number: addressForm.number.trim(),
          complement: addressForm.complement.trim() || null,
          neighborhood: addressForm.neighborhood.trim(),
          city: addressForm.city.trim(),
          state: addressForm.state.trim().toUpperCase(),
          is_default: isFirst ? true : addressForm.is_default,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Endereço adicionado com sucesso!');
      const newAddr = data as CustomerAddress;
      setAddresses((prev) => [newAddr, ...prev]);
      setSelectedAddressId(newAddr.id);
      setIsAddressModalOpen(false);

      // Reset form
      setAddressForm({
        zip_code: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        is_default: false,
      });
    } catch (err: any) {
      console.error('[CHECKOUT] Erro ao salvar endereço:', err);
      toast.error(err.message || 'Erro ao cadastrar endereço');
    } finally {
      setSavingAddress(false);
    }
  };

  // Calculations
  const subtotal = getSubtotal();
  const shippingCost = 0; // Free shipping
  const total = subtotal + shippingCost;

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => a.id === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  // Format currencies
  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Finalize order handler
  const handleFinalizeOrder = async () => {
    if (!user) {
      toast.error('Faça login para finalizar o pedido');
      navigate({ to: '/login' });
      return;
    }

    if (!cart || cart.items.length === 0) {
      toast.error('Seu carrinho está vazio');
      return;
    }

    if (deliveryType === 'delivery' && !selectedAddressId) {
      toast.error('Por favor, selecione ou cadastre um endereço de entrega.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. REVALIDATE STOCK & STATUS DIRECTLY FROM DATABASE
      const productIds = cart.items.map((i) => i.product_id);
      const { data: dbProducts, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity, is_active')
        .in('id', productIds);

      if (prodErr || !dbProducts) {
        throw new Error('Não foi possível verificar a disponibilidade dos produtos.');
      }

      // Check each item
      for (const item of cart.items) {
        const liveProd = dbProducts.find((p) => p.id === item.product_id);
        if (!liveProd || !liveProd.is_active) {
          throw new Error(`O produto "${item.product?.name || 'Item'}" não está mais disponível.`);
        }
        if (liveProd.stock_quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para "${liveProd.name}". Quantidade disponível: ${liveProd.stock_quantity}, solicitada: ${item.quantity}.`
          );
        }
      }

      // 2. COMPUTE SNAPSHOT TOTALS
      const verifiedSubtotal = cart.items.reduce((sum, item) => {
        const liveProd = dbProducts.find((p) => p.id === item.product_id);
        const unitPrice = liveProd ? liveProd.price : item.product.price;
        return sum + unitPrice * item.quantity;
      }, 0);

      const verifiedShipping = 0;
      const verifiedTotal = verifiedSubtotal + verifiedShipping;

      // 3. CREATE ORDER IN public.orders
      const orderPayload = {
        user_id: user.id,
        delivery_type: deliveryType,
        shipping_address_id: deliveryType === 'delivery' ? selectedAddressId : null,
        pickup_address: deliveryType === 'pickup' ? PICKUP_ADDRESS_TEXT : null,
        payment_method: 'cash_on_delivery',
        payment_status: 'pending',
        subtotal: verifiedSubtotal,
        shipping_cost: verifiedShipping,
        total: verifiedTotal,
        customer_note: customerNote.trim() || null,
        status: 'pending',
      };

      const { data: createdOrder, error: orderErr } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderErr || !createdOrder) {
        throw new Error(orderErr?.message || 'Erro ao criar pedido no banco de dados.');
      }

      // 4. CREATE ORDER ITEMS (SNAPSHOT)
      const orderItemsPayload = cart.items.map((item) => {
        const liveProd = dbProducts.find((p) => p.id === item.product_id)!;
        return {
          order_id: createdOrder.id,
          product_id: item.product_id,
          product_name: liveProd.name,
          product_price: liveProd.price,
          quantity: item.quantity,
          total_price: liveProd.price * item.quantity,
        };
      });

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsPayload);

      if (itemsErr) {
        console.error('[CHECKOUT] Erro ao inserir order_items:', itemsErr);
        throw new Error('Falha ao registrar os itens do pedido: ' + itemsErr.message);
      }

      // 5. UPDATE STOCK & REGISTER MOVEMENTS
      for (const item of cart.items) {
        const liveProd = dbProducts.find((p) => p.id === item.product_id)!;
        const newStock = Math.max(0, liveProd.stock_quantity - item.quantity);

        // Update product stock
        const { error: stockUpdateErr } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', item.product_id);

        if (stockUpdateErr) {
          console.warn('[CHECKOUT] Aviso ao atualizar estoque do produto:', stockUpdateErr.message);
        }

        // Record movement
        const { error: movErr } = await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          quantity: item.quantity,
          movement_type: 'out',
          reason: `Pedido #${createdOrder.id.slice(0, 8).toUpperCase()}`,
          reference: createdOrder.id,
          performed_by: user.id,
        });

        if (movErr) {
          console.warn('[CHECKOUT] Aviso ao inserir stock_movements:', movErr.message);
        }
      }

      // 6. CLEAR CART
      await clearCart();

      // 7. SAVE COMPLETED ORDER STATE FOR CONFIRMATION
      setCompletedOrder({
        id: createdOrder.id,
        created_at: createdOrder.created_at,
        total: verifiedTotal,
        subtotal: verifiedSubtotal,
        shipping_cost: verifiedShipping,
        delivery_type: deliveryType,
        payment_method: 'Dinheiro na entrega',
        customer_note: customerNote.trim() || null,
        shipping_address: deliveryType === 'delivery' ? selectedAddress : null,
        pickup_address: deliveryType === 'pickup' ? PICKUP_ADDRESS_TEXT : null,
        items: orderItemsPayload.map((it) => ({
          product_name: it.product_name,
          product_price: it.product_price,
          quantity: it.quantity,
          total_price: it.total_price,
        })),
      });

      toast.success('Pedido finalizado com sucesso!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[CHECKOUT] Erro ao finalizar pedido:', err);
      toast.error(err.message || 'Erro ao processar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── LOADING STATE ──
  if (!authReady || cartLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />
        <div className="flex-1 max-w-5xl mx-auto px-4 py-16 w-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Carregando informações do checkout...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── NOT AUTHENTICATED FALLBACK ──
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />
        <div className="flex-1 max-w-md mx-auto px-4 py-20 w-full flex items-center justify-center">
          <div className="text-center space-y-4 w-full">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Acesso ao Checkout
            </h1>
            <p className="text-sm text-muted-foreground">
              Você precisa estar conectado à sua conta para finalizar o pedido.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Fazer login para continuar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS CONFIRMATION STATE ──
  if (completedOrder) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 w-full">
          {/* Success Banner */}
          <div
            className="rounded-2xl p-6 sm:p-8 text-center mb-8 border"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)', color: 'var(--success)' }}
            >
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>

            <span
              className="inline-block text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-2"
              style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)', color: 'var(--success)' }}
            >
              Pedido Confirmado
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Pedido realizado com sucesso!
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-4">
              Seu pedido foi recebido e registrado em nosso sistema. Nossa equipe já está processando
              seus itens.
            </p>

            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              <span>Número do Pedido:</span>
              <span className="text-primary font-mono">
                #{completedOrder.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Order Details Card */}
          <div
            className="rounded-2xl p-6 sm:p-8 mb-8 border space-y-6"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
              Resumo do Pedido
            </h2>

            {/* Items table */}
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {completedOrder.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {item.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} un. × {formatBRL(item.product_price)}
                    </p>
                  </div>
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {formatBRL(item.total_price)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div
              className="pt-4 border-t space-y-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatBRL(completedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Frete</span>
                <span className="text-success font-medium">Grátis</span>
              </div>
              <div
                className="flex justify-between text-base font-bold pt-2 border-t"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <span>Total a pagar</span>
                <span className="text-primary text-lg">{formatBRL(completedOrder.total)}</span>
              </div>
            </div>

            {/* Delivery & Payment info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--muted)' }}>
                <div className="flex items-center gap-2 mb-2 font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                  {completedOrder.delivery_type === 'delivery' ? (
                    <>
                      <Truck className="w-4 h-4 text-primary" />
                      <span>Entrega no Endereço</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4 text-primary" />
                      <span>Retirada no Local</span>
                    </>
                  )}
                </div>
                {completedOrder.delivery_type === 'delivery' && completedOrder.shipping_address ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {completedOrder.shipping_address.street}, {completedOrder.shipping_address.number}
                    {completedOrder.shipping_address.complement && ` (${completedOrder.shipping_address.complement})`}
                    <br />
                    {completedOrder.shipping_address.neighborhood} — {completedOrder.shipping_address.city}/{completedOrder.shipping_address.state}
                    <br />
                    CEP: {completedOrder.shipping_address.zip_code}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {PICKUP_ADDRESS_TEXT}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--muted)' }}>
                <div className="flex items-center gap-2 mb-2 font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                  <Banknote className="w-4 h-4 text-primary" />
                  <span>Forma de Pagamento</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {completedOrder.payment_method}
                  <br />
                  <span className="text-[11px] text-muted-foreground opacity-80">
                    Pagamento realizado no momento do recebimento.
                  </span>
                </p>
              </div>
            </div>

            {completedOrder.customer_note && (
              <div className="p-4 rounded-xl text-xs space-y-1" style={{ backgroundColor: 'var(--muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Observações:</span>
                <p className="text-muted-foreground">{completedOrder.customer_note}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/account"
              className="inline-flex items-center justify-center py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver meus pedidos
            </Link>

            <Link
              to="/"
              className="inline-flex items-center justify-center py-3 px-6 rounded-xl font-medium transition-all hover:opacity-80 border"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              Voltar para o início
            </Link>
          </div>
        </main>

        <footer
          className="border-t mt-12"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-5xl mx-auto px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              © 2026 Saturno Embalagens. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ── EMPTY CART STATE ──
  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <ShoppingBag className="w-10 h-10 text-primary" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>
              Seu carrinho está vazio
            </h1>

            <p className="text-base mb-8 text-muted-foreground max-w-md mx-auto">
              Adicione produtos ao carrinho antes de prosseguir para a finalização da compra.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Ver Catálogo de Produtos
              </Link>
            </div>
          </div>
        </main>

        <footer
          className="border-t"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-5xl mx-auto px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              © 2026 Saturno Embalagens. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ── MAIN CHECKOUT PAGE ──
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 sm:py-8 w-full">
        {/* Breadcrumb & Title */}
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-xs sm:text-sm mb-2 text-muted-foreground">
            <Link to="/" className="no-underline hover:text-foreground">
              Início
            </Link>
            <span>/</span>
            <Link to="/cart" className="no-underline hover:text-foreground">
              Carrinho
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--foreground)' }}>Checkout</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Finalizar Compra
          </h1>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column: Form Steps (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. TIPO DE RECEBIMENTO */}
            <section
              className="rounded-2xl p-5 sm:p-6 border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  1
                </div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Tipo de Recebimento
                </h2>
              </div>

              {/* Delivery / Pickup radio buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setDeliveryType('delivery')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    deliveryType === 'delivery'
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  style={{ backgroundColor: 'var(--card)' }}
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      deliveryType === 'delivery'
                        ? 'border-primary bg-primary text-white'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {deliveryType === 'delivery' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                      <Truck className="w-4 h-4 text-primary" />
                      <span>Entrega</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Receba no seu endereço cadastrado
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('pickup')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    deliveryType === 'pickup'
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  style={{ backgroundColor: 'var(--card)' }}
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      deliveryType === 'pickup'
                        ? 'border-primary bg-primary text-white'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {deliveryType === 'pickup' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                      <Building2 className="w-4 h-4 text-primary" />
                      <span>Retirada no Local</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Retire direto em nossa fábrica
                    </p>
                  </div>
                </button>
              </div>

              {/* Conditional content based on deliveryType */}
              {deliveryType === 'delivery' ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Selecione o endereço de entrega:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo endereço
                    </button>
                  </div>

                  {loadingAddresses ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Carregando endereços...
                    </div>
                  ) : addresses.length === 0 ? (
                    <div
                      className="p-5 rounded-xl border border-dashed text-center space-y-3"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
                    >
                      <MapPin className="w-8 h-8 mx-auto text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          Nenhum endereço cadastrado
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cadastre um endereço para receber seu pedido.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddressModalOpen(true)}
                        className="inline-flex items-center justify-center py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Cadastrar Endereço
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                            selectedAddressId === addr.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-border/80'
                          }`}
                        >
                          <input
                            type="radio"
                            name="address_selection"
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1 accent-primary"
                          />
                          <div className="flex-1 min-w-0 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                {addr.street}, nº {addr.number}
                              </p>
                              {addr.is_default && (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                  style={{
                                    backgroundColor: 'var(--muted)',
                                    color: 'var(--muted-foreground)',
                                  }}
                                >
                                  Padrão
                                </span>
                              )}
                            </div>
                            {addr.complement && (
                              <p className="text-muted-foreground text-xs mt-0.5">
                                Complemento: {addr.complement}
                              </p>
                            )}
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {addr.neighborhood} — {addr.city}/{addr.state} • CEP: {addr.zip_code}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Pickup info box */
                <div
                  className="p-4 rounded-xl border space-y-3"
                  style={{
                    backgroundColor: 'var(--muted)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-xs sm:text-sm space-y-1">
                      <p className="font-bold" style={{ color: 'var(--foreground)' }}>
                        Fábrica Saturno Embalagens
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        R. Urupema, nº 150 - São Cosme de Baixo
                        <br />
                        Santa Luzia - MG • CEP 33130-140
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Retirada: Segunda a Sexta, das 08h às 17h</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-[11px] p-2.5 rounded-lg font-medium"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      color: 'var(--primary)',
                    }}
                  >
                    ℹ️ Você receberá uma notificação quando seu pedido estiver pronto para retirada.
                  </div>
                </div>
              )}
            </section>

            {/* 2. FORMA DE PAGAMENTO */}
            <section
              className="rounded-2xl p-5 sm:p-6 border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  2
                </div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Forma de Pagamento
                </h2>
              </div>

              {/* Dinheiro na entrega */}
              <div className="space-y-3">
                <div
                  className="p-4 rounded-xl border border-primary ring-2 ring-primary/20 flex items-start gap-3.5"
                  style={{ backgroundColor: 'var(--card)' }}
                >
                  <div className="w-5 h-5 rounded-full border border-primary bg-primary text-white flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                        <Banknote className="w-4 h-4 text-primary" />
                        <span>Dinheiro na entrega</span>
                      </div>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          backgroundColor: 'rgba(22, 163, 74, 0.12)',
                          color: 'var(--success)',
                        }}
                      >
                        Disponível
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pague em dinheiro no momento do recebimento ou da retirada no local.
                    </p>
                  </div>
                </div>

                <div
                  className="p-3 rounded-xl text-xs text-muted-foreground flex items-center gap-2"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span>Outros métodos de pagamento (PIX e Cartão) serão habilitados em breve.</span>
                </div>
              </div>
            </section>

            {/* 3. OBSERVAÇÕES DO PEDIDO */}
            <section
              className="rounded-2xl p-5 sm:p-6 border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  3
                </div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Observações do Pedido
                </h2>
              </div>

              <div>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={3}
                  placeholder="Alguma observação sobre seu pedido? (Ex: ponto de referência, instruções de entrega)"
                  className="w-full p-3.5 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <div className="flex justify-end mt-1 text-[11px] text-muted-foreground">
                  {customerNote.length}/500 caracteres
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Order Summary (5 cols) */}
          <div className="lg:col-span-5">
            <div
              className="rounded-2xl p-5 sm:p-6 border sticky top-24 space-y-6"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Resumo da Compra
                </h2>
                <Link
                  to="/cart"
                  className="text-xs font-semibold text-primary hover:underline no-underline"
                >
                  Editar carrinho
                </Link>
              </div>

              {/* Items List */}
              <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    {/* Thumbnail */}
                    <div
                      className="w-12 h-12 rounded-lg border overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                    >
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs sm:text-sm truncate" style={{ color: 'var(--foreground)' }}>
                        {item.product?.name || 'Produto'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qtd: {item.quantity} × {formatBRL(item.product?.price || 0)}
                      </p>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right font-semibold text-xs sm:text-sm" style={{ color: 'var(--foreground)' }}>
                      {formatBRL((item.product?.price || 0) * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Values Breakdown */}
              <div className="space-y-2.5 pt-4 border-t text-sm" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({cart.items.reduce((s, i) => s + i.quantity, 0)} itens)</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>Frete</span>
                  <span className="text-success font-semibold">Grátis</span>
                </div>

                <div
                  className="flex justify-between text-base font-bold pt-3 border-t"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <span>Total</span>
                  <span className="text-primary text-xl font-black">{formatBRL(total)}</span>
                </div>
              </div>

              {/* Finalize Button */}
              <button
                type="button"
                onClick={handleFinalizeOrder}
                disabled={isSubmitting || (deliveryType === 'delivery' && !selectedAddressId)}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processando pedido...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirmar e Finalizar Pedido</span>
                  </>
                )}
              </button>

              {deliveryType === 'delivery' && !selectedAddressId && (
                <p className="text-xs text-destructive text-center">
                  Selecione ou cadastre um endereço de entrega para finalizar.
                </p>
              )}

              {/* Security info */}
              <div className="pt-2 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span>Ambiente seguro e protegido</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: NOVO ENDEREÇO */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-md" style={{ backgroundColor: 'var(--card)' }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
              Cadastrar Endereço de Entrega
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveAddress} className="space-y-3.5 mt-2">
            {/* CEP */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                CEP *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="00000-000"
                  value={addressForm.zip_code}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, zip_code: e.target.value }))
                  }
                  onBlur={handleCepBlur}
                  className="w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                {searchingCep && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Digite o CEP para buscar o endereço automaticamente.
              </p>
            </div>

            {/* Logradouro e Número */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  Rua / Logradouro *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. Principal"
                  value={addressForm.street}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, street: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  Número *
                </label>
                <input
                  type="text"
                  required
                  placeholder="123"
                  value={addressForm.number}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, number: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Complemento e Bairro */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  Complemento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Galpão B, Apto 101"
                  value={addressForm.complement}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, complement: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  Bairro *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Bairro"
                  value={addressForm.neighborhood}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, neighborhood: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Cidade e UF */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  Cidade *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cidade"
                  value={addressForm.city}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                  UF *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  placeholder="MG"
                  value={addressForm.state}
                  onChange={(e) =>
                    setAddressForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))
                  }
                  className="w-full h-10 px-3 rounded-xl border text-sm uppercase focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold border transition-colors hover:bg-muted"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingAddress}
                className="py-2.5 px-5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {savingAddress ? 'Salvando...' : 'Salvar Endereço'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer
        className="border-t mt-12"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Saturno Embalagens. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
