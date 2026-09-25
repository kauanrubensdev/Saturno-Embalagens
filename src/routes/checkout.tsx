import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ShoppingBag,
  Loader2,
  Clock,
  ShieldCheck,
  FileText,
  CreditCard,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  Smartphone,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ── Stripe public key — safe to expose in the frontend ──────────────────────
const STRIPE_PUBLISHABLE_KEY =
  (import.meta.env['VITE_STRIPE_PUBLISHABLE_KEY'] as string) || '';

// Lazy-initialize Stripe to avoid loading the SDK on every page
let stripePromise: ReturnType<typeof loadStripe> | null = null;
const getStripe = () => {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

export const Route = createFileRoute('/checkout')({
  beforeLoad: async ({ context }: { context: any }) => {
    if (!context.auth?.authReady) {
      return;
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: CheckoutPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethodOption =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'boleto'
  | 'cash_on_delivery';

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
  payment_status: string;
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

/** State for orders that require online payment via Stripe */
interface StripePaymentState {
  orderId: string;
  total: number;
  clientSecret: string;
  selectedMethod: 'card' | 'apple_pay' | 'google_pay' | 'boleto';
  orderData: CompletedOrderData;
  /** Whether confirmed payment by Stripe (via realtime or polling) */
  isPaid: boolean;
  /** Whether the boleto PDF URL is available after payment submission */
  boletoPdfUrl: string | null;
  boletoHostedUrl: string | null;
}

const PICKUP_ADDRESS_TEXT =
  'R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140';

// ── Brand Icons ─────────────────────────────────────────────────────────────

function ApplePayIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.9.04-2.03.62-2.67 1.37-.56.65-.99 1.7-0.85 2.72 1.01.08 2.01-.52 2.6-1.22z" />
    </svg>
  );
}

function GooglePayIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.24 10.285V14.4h6.872c-.297 1.636-1.75 4.8-6.872 4.8-4.14 0-7.518-3.39-7.518-7.56 0-4.17 3.378-7.56 7.518-7.56 2.355 0 3.93.996 4.827 1.848l3.297-3.174C18.291 1.014 15.534 0 12.24 0 5.478 0 0 5.484 0 12.24s5.478 12.24 12.24 12.24c7.065 0 11.754-4.962 11.754-11.958 0-.804-.087-1.416-.192-2.238H12.24z" />
    </svg>
  );
}

// ── StripePaymentForm Component ──────────────────────────────────────────────
// Rendered inside the <Elements> provider; has access to useStripe/useElements

interface StripePaymentFormProps {
  stripePaymentState: StripePaymentState;
  onPaymentConfirmed: () => void;
  onBoletoIssued: (pdfUrl: string | null, hostedUrl: string | null) => void;
  onChangeMethod: () => void;
  formatBRL: (val: number) => string;
}

function StripePaymentForm({
  stripePaymentState,
  onPaymentConfirmed,
  onBoletoIssued,
  onChangeMethod,
  formatBRL,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentReady, setPaymentReady] = useState(false);

  const selectedMethod = stripePaymentState.selectedMethod;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);
    setPaymentError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setPaymentError(error.message || 'Erro ao processar o pagamento.');
        toast.error(error.message || 'Falha no pagamento. Verifique os dados e tente novamente.');
        return;
      }

      if (paymentIntent) {
        // Check if this is a boleto payment (status = requires_action, next_action = display_boleto_details)
        if (paymentIntent.status === 'requires_action') {
          const nextAction = (paymentIntent as any).next_action;
          if (nextAction?.type === 'display_boleto_details') {
            const boleto = nextAction.display_boleto_details;
            const pdfUrl = boleto?.boleto_pdf || boleto?.pdf || null;
            const hostedUrl = boleto?.hosted_voucher_url || null;
            onBoletoIssued(pdfUrl, hostedUrl);
            toast.success(
              'Boleto gerado com sucesso! Realize o pagamento dentro do prazo para confirmar seu pedido.'
            );
            return;
          }
        }

        if (paymentIntent.status === 'succeeded') {
          onPaymentConfirmed();
          toast.success('Pagamento confirmado com sucesso!');
        } else if (paymentIntent.status === 'processing') {
          toast.info(
            'Seu pagamento está sendo processado. Você será notificado assim que for confirmado.'
          );
        }
      }
    } catch (err: any) {
      console.error('[STRIPE-PAYMENT-FORM] Erro inesperado:', err);
      setPaymentError(err.message || 'Erro inesperado ao processar pagamento.');
      toast.error('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tailored PaymentElement options based on the chosen individual method
  const paymentElementOptions = useMemo(() => {
    if (selectedMethod === 'card') {
      return {
        layout: 'tabs' as const,
        paymentMethodOrder: ['card'],
        wallets: {
          applePay: 'never' as const,
          googlePay: 'never' as const,
        },
      };
    }
    if (selectedMethod === 'apple_pay') {
      return {
        layout: 'tabs' as const,
        wallets: {
          applePay: 'auto' as const,
          googlePay: 'never' as const,
        },
      };
    }
    if (selectedMethod === 'google_pay') {
      return {
        layout: 'tabs' as const,
        wallets: {
          googlePay: 'auto' as const,
          applePay: 'never' as const,
        },
      };
    }
    if (selectedMethod === 'boleto') {
      return {
        layout: 'tabs' as const,
        paymentMethodOrder: ['boleto'],
        wallets: {
          applePay: 'never' as const,
          googlePay: 'never' as const,
        },
      };
    }
    return {
      layout: 'tabs' as const,
    };
  }, [selectedMethod]);

  const buttonLabel = useMemo(() => {
    if (selectedMethod === 'boleto') {
      return `Gerar Boleto (${formatBRL(stripePaymentState.total)})`;
    }
    if (selectedMethod === 'apple_pay') {
      return `Pagar com Apple Pay (${formatBRL(stripePaymentState.total)})`;
    }
    if (selectedMethod === 'google_pay') {
      return `Pagar com Google Pay (${formatBRL(stripePaymentState.total)})`;
    }
    return `Confirmar Pagamento com Cartão (${formatBRL(stripePaymentState.total)})`;
  }, [selectedMethod, stripePaymentState.total, formatBRL]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {selectedMethod === 'boleto' && (
        <div
          className="p-3.5 rounded-xl text-xs border space-y-1"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.06)',
            borderColor: 'rgba(59, 130, 246, 0.2)',
            color: 'var(--foreground)',
          }}
        >
          <p className="font-semibold flex items-center gap-1.5 text-primary">
            <FileText className="w-4 h-4" />
            Informações do Boleto
          </p>
          <p className="text-muted-foreground">
            Preencha os dados abaixo (nome, CPF/CNPJ e endereço) para a emissão do boleto bancário.
            O documento será gerado logo após clicar no botão abaixo.
          </p>
        </div>
      )}

      {/* Stripe Payment Element */}
      <PaymentElement onReady={() => setPaymentReady(true)} options={paymentElementOptions} />

      {paymentError && (
        <div
          className="p-3.5 rounded-xl text-xs border flex items-start gap-2"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{paymentError}</span>
        </div>
      )}

      <div className="space-y-2.5 pt-2">
        <button
          type="submit"
          disabled={!stripe || !elements || !paymentReady || isSubmitting}
          className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {selectedMethod === 'boleto'
                  ? 'Gerando boleto...'
                  : 'Processando pagamento...'}
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>{buttonLabel}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onChangeMethod}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trocar forma de pagamento</span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5 text-success" />
        Pagamento seguro processado via Stripe. Seus dados estão protegidos.
      </p>
    </form>
  );
}

// ── Main CheckoutPage ────────────────────────────────────────────────────────

export function CheckoutPage() {
  const { authReady, user } = useAuth();
  const { cart, loading: cartLoading, clearCart, getSubtotal } = useCart();
  const navigate = useNavigate();

  // Form states
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption>('card');
  const [customerNote, setCustomerNote] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Digital wallets support detection
  const [walletsSupport, setWalletsSupport] = useState<{
    applePay: boolean;
    googlePay: boolean;
    checked: boolean;
  }>({
    applePay: false,
    googlePay: false,
    checked: false,
  });

  // New address modal
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

  // Flow states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrderData | null>(null);
  const [stripePaymentState, setStripePaymentState] = useState<StripePaymentState | null>(null);

  // Stripe confirmation state
  const pollingRef = useRef<number | null>(null);

  // ── Detect Digital Wallets Support (Apple Pay & Google Pay) ────────────────
  useEffect(() => {
    let isMounted = true;

    const detectWallets = async () => {
      try {
        const stripe = await getStripe();
        if (!stripe) {
          if (isMounted) setWalletsSupport({ applePay: false, googlePay: false, checked: true });
          return;
        }

        const pr = stripe.paymentRequest({
          country: 'BR',
          currency: 'brl',
          total: { label: 'Saturno Embalagens', amount: 1000 },
          requestPayerName: true,
          requestPayerEmail: true,
        });

        const result = (await pr.canMakePayment()) as Record<string, boolean> | null;
        if (isMounted) {
          const applePayAvailable = Boolean(result && result['applePay']);
          const googlePayAvailable = Boolean(result && result['googlePay']);
          setWalletsSupport({
            applePay: applePayAvailable,
            googlePay: googlePayAvailable,
            checked: true,
          });
        }
      } catch (err) {
        console.warn('[CHECKOUT-WALLETS] Verificação de carteiras digitais:', err);
        if (isMounted) {
          setWalletsSupport({ applePay: false, googlePay: false, checked: true });
        }
      }
    };

    detectWallets();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Fetch addresses ────────────────────────────────────────────────────────
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
          if (defaultAddr?.id) {
            setSelectedAddressId(defaultAddr.id);
          }
        }
      } catch (err) {
        console.error('[CHECKOUT] Erro ao carregar endereços:', err);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, [user]);

  // ── Realtime subscription for online payment confirmation ─────────────────
  useEffect(() => {
    if (!stripePaymentState || stripePaymentState.isPaid) return;
    if (stripePaymentState.boletoPdfUrl !== null) return; // boleto issued — don't poll

    const orderId = stripePaymentState.orderId;

    const channel = supabase
      .channel(`order-payment-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated && updated.payment_status === 'paid') {
            toast.success('Pagamento confirmado com sucesso!');
            setStripePaymentState((prev) => (prev ? { ...prev, isPaid: true } : null));
          }
        }
      )
      .subscribe();

    // Polling fallback (every 8s)
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('payment_status')
          .eq('id', orderId)
          .single();

        if (!error && data && data.payment_status === 'paid') {
          toast.success('Pagamento confirmado!');
          setStripePaymentState((prev) => (prev ? { ...prev, isPaid: true } : null));
        }
      } catch (err) {
        console.warn('[CHECKOUT-STRIPE-POLLING] Erro ao checar status:', err);
      }
    };

    const interval = setInterval(checkStatus, 8000);
    pollingRef.current = interval as unknown as number;

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [stripePaymentState?.orderId, stripePaymentState?.isPaid, stripePaymentState?.boletoPdfUrl]);

  // ── CEP auto-fill ──────────────────────────────────────────────────────────
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

  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = getSubtotal();
  const shippingCost = 0;
  const total = subtotal + shippingCost;

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => a.id === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // ── Payment confirmed callback ─────────────────────────────────────────────
  const handlePaymentConfirmed = useCallback(() => {
    setStripePaymentState((prev) => (prev ? { ...prev, isPaid: true } : null));
  }, []);

  // ── Boleto issued callback ─────────────────────────────────────────────────
  const handleBoletoIssued = useCallback((pdfUrl: string | null, hostedUrl: string | null) => {
    setStripePaymentState((prev) =>
      prev ? { ...prev, boletoPdfUrl: pdfUrl, boletoHostedUrl: hostedUrl } : null
    );
  }, []);

  // ── Handle Change Method from Stripe screen ───────────────────────────────
  const handleChangeMethod = useCallback(() => {
    setStripePaymentState(null);
  }, []);

  // ── Label helper ──────────────────────────────────────────────────────────
  const getPaymentMethodDisplayLabel = (method: PaymentMethodOption) => {
    switch (method) {
      case 'card':
        return 'Cartão de Crédito / Débito';
      case 'apple_pay':
        return 'Apple Pay';
      case 'google_pay':
        return 'Google Pay';
      case 'boleto':
        return 'Boleto Bancário';
      case 'cash_on_delivery':
        return 'Dinheiro na entrega';
      default:
        return 'Pagamento Online';
    }
  };

  // ── Finalize order handler ─────────────────────────────────────────────────
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

    // Wallet availability validation
    if (paymentMethod === 'apple_pay' && !walletsSupport.applePay) {
      toast.error('Apple Pay não está disponível neste dispositivo ou navegador.');
      return;
    }

    if (paymentMethod === 'google_pay' && !walletsSupport.googlePay) {
      toast.error('Google Pay não está disponível neste dispositivo ou navegador.');
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

      for (const item of cart.items) {
        const liveProd = dbProducts.find((p) => p.id === item.product_id);
        if (!liveProd || !liveProd.is_active) {
          throw new Error(`O produto "${item.product?.name || 'Item'}" não está mais disponível.`);
        }
        if (liveProd.stock_quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para "${liveProd.name}". Disponível: ${liveProd.stock_quantity}, solicitado: ${item.quantity}.`
          );
        }
      }

      // 2. COMPUTE SNAPSHOT TOTALS (from live DB prices)
      const verifiedSubtotal = cart.items.reduce((sum, item) => {
        const liveProd = dbProducts.find((p) => p.id === item.product_id);
        const unitPrice = liveProd ? liveProd.price : item.product.price;
        return sum + unitPrice * item.quantity;
      }, 0);

      const verifiedShipping = 0;
      const verifiedTotal = verifiedSubtotal + verifiedShipping;

      // 3. CREATE ORDER IN public.orders
      // DB constraint allows 'stripe_online' or 'cash_on_delivery'
      const dbPaymentMethod =
        paymentMethod === 'cash_on_delivery' ? 'cash_on_delivery' : 'stripe_online';

      const orderPayload = {
        user_id: user.id,
        delivery_type: deliveryType,
        shipping_address_id: deliveryType === 'delivery' ? selectedAddressId : null,
        pickup_address: deliveryType === 'pickup' ? PICKUP_ADDRESS_TEXT : null,
        payment_method: dbPaymentMethod,
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
        throw new Error('Falha ao registrar os itens do pedido: ' + itemsErr.message);
      }

      // 5. UPDATE STOCK & REGISTER MOVEMENTS
      for (const item of cart.items) {
        const liveProd = dbProducts.find((p) => p.id === item.product_id)!;
        const newStock = Math.max(0, liveProd.stock_quantity - item.quantity);

        const { error: stockUpdateErr } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', item.product_id);

        if (stockUpdateErr) {
          console.warn('[CHECKOUT] Aviso ao atualizar estoque:', stockUpdateErr.message);
        }

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

      const paymentMethodLabel = getPaymentMethodDisplayLabel(paymentMethod);

      const completedOrderData: CompletedOrderData = {
        id: createdOrder.id,
        created_at: createdOrder.created_at,
        total: verifiedTotal,
        subtotal: verifiedSubtotal,
        shipping_cost: verifiedShipping,
        delivery_type: deliveryType,
        payment_method: paymentMethodLabel,
        payment_status: 'pending',
        customer_note: customerNote.trim() || null,
        shipping_address: deliveryType === 'delivery' ? selectedAddress : null,
        pickup_address: deliveryType === 'pickup' ? PICKUP_ADDRESS_TEXT : null,
        items: orderItemsPayload.map((it) => ({
          product_name: it.product_name,
          product_price: it.product_price,
          quantity: it.quantity,
          total_price: it.total_price,
        })),
      };

      // 6. CLEAR CART
      await clearCart();

      // 7. BRANCH: online payment (Stripe) vs cash_on_delivery
      if (paymentMethod !== 'cash_on_delivery') {
        const session = await supabase.auth.getSession();
        const accessToken = session.data?.session?.access_token;

        const { data: paymentRes, error: paymentErr } = await supabase.functions.invoke(
          'create-stripe-payment',
          {
            body: {
              order_id: createdOrder.id,
              payment_method: paymentMethod,
            },
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          }
        );

        if (paymentErr || !paymentRes?.client_secret) {
          console.error('[CHECKOUT] Erro na Edge Function create-stripe-payment:', paymentErr);
          toast.error(
            'Pedido registrado, mas houve um erro ao inicializar o pagamento. Tente novamente ou entre em contato com o suporte.'
          );
          return;
        }

        setStripePaymentState({
          orderId: createdOrder.id,
          total: verifiedTotal,
          clientSecret: paymentRes.client_secret,
          selectedMethod: paymentMethod,
          orderData: completedOrderData,
          isPaid: false,
          boletoPdfUrl: null,
          boletoHostedUrl: null,
        });

        toast.success('Pedido criado! Prossiga com o pagamento.');
      } else {
        // Cash on delivery — order is confirmed immediately
        setCompletedOrder(completedOrderData);
        toast.success('Pedido finalizado com sucesso!');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[CHECKOUT] Erro ao finalizar pedido:', err);
      toast.error(err.message || 'Erro ao processar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
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

  // ── NOT AUTHENTICATED FALLBACK ─────────────────────────────────────────────
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

  // ── STRIPE PAYMENT SCREEN ─────────────────────────────────────────────────
  if (stripePaymentState) {
    const {
      isPaid,
      boletoPdfUrl,
      boletoHostedUrl,
      orderData,
      total: orderTotal,
      clientSecret,
      selectedMethod,
    } = stripePaymentState;

    const stripeAppearance = {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: 'var(--primary, #3b82f6)',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '12px',
      },
    };

    const elementsOptions: StripeElementsOptions = {
      clientSecret,
      appearance: stripeAppearance,
      locale: 'pt-BR',
    };

    const methodHeaderInfo = {
      card: {
        icon: <CreditCard className="w-8 h-8 sm:w-10 sm:h-10" />,
        title: 'Pagamento com Cartão',
        subtitle: 'Preencha os dados do seu cartão para concluir a compra.',
      },
      apple_pay: {
        icon: <ApplePayIcon className="w-8 h-8 sm:w-10 sm:h-10" />,
        title: 'Pagamento com Apple Pay',
        subtitle: 'Conclua sua compra com segurança usando Apple Pay.',
      },
      google_pay: {
        icon: <GooglePayIcon className="w-8 h-8 sm:w-10 sm:h-10" />,
        title: 'Pagamento com Google Pay',
        subtitle: 'Conclua sua compra com segurança usando Google Pay.',
      },
      boleto: {
        icon: <FileText className="w-8 h-8 sm:w-10 sm:h-10" />,
        title: 'Emissão de Boleto Bancário',
        subtitle: 'Preencha seus dados para emitir o boleto bancário.',
      },
    }[selectedMethod];

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <Header showNav />

        <main className="flex-1 max-w-2xl mx-auto px-4 py-6 sm:py-10 w-full">
          {/* Status Card */}
          <div
            className="rounded-2xl p-6 sm:p-8 text-center mb-6 border"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {isPaid ? (
              <>
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
                  Pagamento Confirmado
                </span>
                <h1
                  className="text-2xl sm:text-3xl font-bold mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Pagamento Realizado com Sucesso!
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Seu pagamento foi confirmado pelo Stripe. Seu pedido já está sendo preparado pela
                  nossa equipe.
                </p>
              </>
            ) : boletoPdfUrl !== null || boletoHostedUrl !== null ? (
              <>
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#d97706' }}
                >
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span
                  className="inline-block text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-2"
                  style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#d97706' }}
                >
                  Boleto Gerado — Pagamento Pendente
                </span>
                <h1
                  className="text-xl sm:text-2xl font-bold mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Seu boleto está pronto para pagamento
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Realize o pagamento do boleto dentro do prazo de vencimento. A compensação pode
                  levar <strong>até 3 dias úteis</strong>.
                </p>

                <div
                  className="p-4 rounded-xl border text-xs mb-4 space-y-1 text-left"
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.06)',
                    borderColor: 'rgba(251, 191, 36, 0.25)',
                    color: '#92400e',
                  }}
                >
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Atenção à compensação bancária
                  </p>
                  <p>
                    O boleto bancário não é compensado instantaneamente. O pedido começará a ser
                    preparado assim que o banco nos confirmar a liquidação do título.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                  {boletoHostedUrl && (
                    <a
                      href={boletoHostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center py-2.5 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 gap-2"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visualizar Boleto
                    </a>
                  )}
                  {boletoPdfUrl && (
                    <a
                      href={boletoPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center py-2.5 px-5 rounded-xl text-sm font-semibold border transition-all hover:opacity-80 gap-2"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                    >
                      <FileText className="w-4 h-4" />
                      Baixar PDF
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)' }}
                >
                  {methodHeaderInfo.icon}
                </div>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-2 text-primary"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)' }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {getPaymentMethodDisplayLabel(selectedMethod)}
                </span>
                <h1
                  className="text-xl sm:text-2xl font-bold mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  {methodHeaderInfo.title}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  {methodHeaderInfo.subtitle}
                </p>
              </>
            )}

            {/* Order metadata badges */}
            <div
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-4 pt-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
              >
                <span>Pedido: </span>
                <span className="text-primary font-mono font-bold">
                  #{stripePaymentState.orderId.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
              >
                <span>Valor: </span>
                <span className="text-primary font-bold">{formatBRL(orderTotal)}</span>
              </div>
            </div>
          </div>

          {/* Stripe Payment Element — only shown while awaiting payment */}
          {!isPaid && boletoPdfUrl === null && boletoHostedUrl === null && (
            <div
              className="rounded-2xl p-5 sm:p-6 mb-6 border"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>
                {selectedMethod === 'boleto' ? 'Dados para Emissão do Boleto' : 'Dados do Pagamento'}
              </h2>

              {getStripe() ? (
                <Elements options={elementsOptions} stripe={getStripe()!}>
                  <StripePaymentForm
                    stripePaymentState={stripePaymentState}
                    onPaymentConfirmed={handlePaymentConfirmed}
                    onBoletoIssued={handleBoletoIssued}
                    onChangeMethod={handleChangeMethod}
                    formatBRL={formatBRL}
                  />
                </Elements>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Stripe não está configurado. Verifique a variável{' '}
                    <code className="font-mono text-xs bg-muted px-1 rounded">
                      VITE_STRIPE_PUBLISHABLE_KEY
                    </code>
                    .
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div
            className="rounded-2xl p-5 sm:p-6 mb-6 border space-y-4 text-xs sm:text-sm"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h2 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
              Detalhes do Pedido
            </h2>

            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {orderData.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
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

            <div
              className="pt-3 border-t flex justify-between font-bold text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span style={{ color: 'var(--foreground)' }}>Total</span>
              <span className="text-primary text-base font-black">{formatBRL(orderTotal)}</span>
            </div>
          </div>

          {/* Navigation */}
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

  // ── CASH ON DELIVERY SUCCESS CONFIRMATION ──────────────────────────────────
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

            <h1
              className="text-2xl sm:text-3xl font-bold mb-2"
              style={{ color: 'var(--foreground)' }}
            >
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

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--muted)' }}>
                <div
                  className="flex items-center gap-2 mb-2 font-semibold text-sm"
                  style={{ color: 'var(--foreground)' }}
                >
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
                    {completedOrder.shipping_address.complement &&
                      ` (${completedOrder.shipping_address.complement})`}
                    <br />
                    {completedOrder.shipping_address.neighborhood} —{' '}
                    {completedOrder.shipping_address.city}/{completedOrder.shipping_address.state}
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
                <div
                  className="flex items-center gap-2 mb-2 font-semibold text-sm"
                  style={{ color: 'var(--foreground)' }}
                >
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
              <div
                className="p-4 rounded-xl text-xs space-y-1"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  Observações:
                </span>
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

  // ── EMPTY CART STATE ───────────────────────────────────────────────────────
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

            <h1
              className="text-2xl md:text-3xl font-bold mb-3"
              style={{ color: 'var(--foreground)' }}
            >
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

  // ── Payment Methods Definitions ───────────────────────────────────────────
  const paymentOptions: {
    id: PaymentMethodOption;
    title: string;
    description: string;
    icon: React.ReactNode;
    isAvailable: boolean;
    unavailableBadge?: string | undefined;
    badge?: string | undefined;
  }[] = [
    {
      id: 'card',
      title: 'Cartão',
      description: 'Pague com cartão de crédito ou débito.',
      icon: <CreditCard className="w-4 h-4 text-primary" />,
      isAvailable: true,
    },
    {
      id: 'apple_pay',
      title: 'Apple Pay',
      description: 'Pague rapidamente usando Apple Pay.',
      icon: <ApplePayIcon className="w-4 h-4 text-primary" />,
      isAvailable: walletsSupport.checked ? walletsSupport.applePay : true,
      unavailableBadge: walletsSupport.checked && !walletsSupport.applePay ? 'Indisponível neste dispositivo' : undefined,
    },
    {
      id: 'google_pay',
      title: 'Google Pay',
      description: 'Pague rapidamente usando Google Pay.',
      icon: <GooglePayIcon className="w-4 h-4 text-primary" />,
      isAvailable: walletsSupport.checked ? walletsSupport.googlePay : true,
      unavailableBadge: walletsSupport.checked && !walletsSupport.googlePay ? 'Indisponível neste navegador' : undefined,
    },
    {
      id: 'boleto',
      title: 'Boleto',
      description: 'Gere seu boleto e realize o pagamento.',
      icon: <FileText className="w-4 h-4 text-primary" />,
      isAvailable: true,
    },
    {
      id: 'cash_on_delivery',
      title: 'Dinheiro na entrega',
      description: 'Pague em dinheiro no recebimento ou retirada.',
      icon: <Banknote className="w-4 h-4 text-primary" />,
      isAvailable: true,
      badge: 'No Recebimento',
    },
  ];

  // ── MAIN CHECKOUT FORM ─────────────────────────────────────────────────────
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
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: 'var(--foreground)' }}
          >
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
                    <div
                      className="flex items-center gap-1.5 font-semibold text-sm"
                      style={{ color: 'var(--foreground)' }}
                    >
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
                    <div
                      className="flex items-center gap-1.5 font-semibold text-sm"
                      style={{ color: 'var(--foreground)' }}
                    >
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

              <div className="space-y-3" role="radiogroup" aria-label="Forma de Pagamento">
                {paymentOptions.map((opt) => {
                  const isSelected = paymentMethod === opt.id;
                  const isDisabled = !opt.isAvailable;

                  return (
                    <label
                      key={opt.id}
                      htmlFor={`payment-option-${opt.id}`}
                      className={`w-full p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all select-none ${
                        isDisabled
                          ? 'opacity-60 border-border/60 bg-muted/30 cursor-not-allowed'
                          : isSelected
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 cursor-pointer'
                            : 'border-border hover:border-border/80 bg-card cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        id={`payment-option-${opt.id}`}
                        name="payment_method_option"
                        value={opt.id}
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {
                          if (!isDisabled) {
                            setPaymentMethod(opt.id);
                          }
                        }}
                        className="sr-only"
                      />

                      {/* Custom Radio Indicator */}
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                          isDisabled
                            ? 'border-muted-foreground/30 bg-muted'
                            : isSelected
                              ? 'border-primary bg-primary text-white'
                              : 'border-muted-foreground/40 bg-card'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Info & Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div
                            className="flex items-center gap-2 font-semibold text-sm"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {opt.icon}
                            <span>{opt.title}</span>
                          </div>

                          {opt.badge && (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                color: 'var(--primary)',
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}

                          {opt.unavailableBadge && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: 'var(--muted)',
                                color: 'var(--muted-foreground)',
                              }}
                            >
                              {opt.unavailableBadge}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                      </div>
                    </label>
                  );
                })}
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
              <div
                className="flex items-center justify-between border-b pb-4"
                style={{ borderColor: 'var(--border)' }}
              >
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
                      <p
                        className="font-semibold text-xs sm:text-sm truncate"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {item.product?.name || 'Produto'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qtd: {item.quantity} × {formatBRL(item.product?.price || 0)}
                      </p>
                    </div>

                    {/* Subtotal */}
                    <div
                      className="text-right font-semibold text-xs sm:text-sm"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {formatBRL((item.product?.price || 0) * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Values Breakdown */}
              <div
                className="space-y-2.5 pt-4 border-t text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
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
                ) : paymentMethod !== 'cash_on_delivery' ? (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Continuar para Pagamento ({formatBRL(total)})</span>
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
                  <span>Ambiente seguro e protegido via Stripe</span>
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
              <label
                className="block text-xs font-semibold mb-1"
                style={{ color: 'var(--foreground)' }}
              >
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
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--foreground)' }}
                >
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
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--foreground)' }}
                >
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
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--foreground)' }}
                >
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
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--foreground)' }}
                >
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
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--foreground)' }}
                >
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
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--foreground)' }}
                >
                  UF *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  placeholder="MG"
                  value={addressForm.state}
                  onChange={(e) =>
                    setAddressForm((prev) => ({
                      ...prev,
                      state: e.target.value.toUpperCase(),
                    }))
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
                className="py-2.5 px-4 rounded-xl text-xs font-semibold border transition-colors hover:bg-muted cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingAddress}
                className="py-2.5 px-5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
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

