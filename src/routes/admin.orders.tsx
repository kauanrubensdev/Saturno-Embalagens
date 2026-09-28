import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  Check,
  Ban,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ShoppingBag,
  RotateCcw,
  Calendar,
  Eye,
  RefreshCw,
  Banknote,
  CreditCard,
  QrCode,
  DollarSign,
  Search,
  X,
  User,
  MapPin,
  FileText,
  Copy,
  Printer,
} from 'lucide-react';

// ─── Domain types ────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
type PaymentMethod = 'pix' | 'abacate_pix' | 'credit_card' | 'cash_on_delivery' | null;
type DeliveryType = 'delivery' | 'pickup';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
}

interface Address {
  id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
}

interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  shipping_cost: number;
  total: number;
  delivery_type: DeliveryType;
  shipping_address_id: string | null;
  pickup_address: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
  abacate_pix_id?: string | null;
  // joined
  profile?: CustomerProfile | null;
  shipping_address?: Address | null;
  order_items?: OrderItem[];
}

// ─── Status definitions ───────────────────────────────────────────────────────

interface StatusConfig {
  value: OrderStatus;
  label: string;
  icon: typeof Clock;
  bg: string;
  text: string;
  border: string;
}

const NORMAL_STATUS_FLOW: StatusConfig[] = [
  { value: 'pending',   label: 'Pendente',       icon: Clock,        bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' },
  { value: 'confirmed', label: 'Confirmado',     icon: CheckCircle2, bg: 'rgba(59,130,246,0.12)', text: '#2563eb', border: 'rgba(59,130,246,0.3)' },
  { value: 'preparing', label: 'Em preparação',  icon: Package,      bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  { value: 'shipped',   label: 'Enviado',        icon: Truck,        bg: 'rgba(234,88,12,0.12)',  text: '#ea580c', border: 'rgba(234,88,12,0.3)'  },
  { value: 'delivered', label: 'Entregue',       icon: Check,        bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.3)'  },
];

const CANCELLED_STATUS_CONFIG: StatusConfig = {
  value: 'cancelled',
  label: 'Cancelado',
  icon: Ban,
  bg: 'rgba(220,38,38,0.12)',
  text: '#dc2626',
  border: 'rgba(220,38,38,0.3)',
};

const ALL_STATUS_CONFIGS: Record<OrderStatus, StatusConfig> = {
  pending: NORMAL_STATUS_FLOW[0],
  confirmed: NORMAL_STATUS_FLOW[1],
  preparing: NORMAL_STATUS_FLOW[2],
  shipped: NORMAL_STATUS_FLOW[3],
  delivered: NORMAL_STATUS_FLOW[4],
  cancelled: CANCELLED_STATUS_CONFIG,
};

function getOrderStatusLabel(status: OrderStatus, deliveryType?: DeliveryType): string {
  if (status === 'shipped' && deliveryType === 'pickup') {
    return 'Pronto para retirada';
  }
  switch (status) {
    case 'pending': return 'Pendente';
    case 'confirmed': return 'Confirmado';
    case 'preparing': return 'Em preparação';
    case 'shipped': return 'Enviado';
    case 'delivered': return 'Entregue';
    case 'cancelled': return 'Cancelado';
    default: return status;
  }
}

// ─── Payment definitions ──────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  abacate_pix: 'PIX (AbacatePay)',
  credit_card: 'Cartão de Crédito',
  cash_on_delivery: 'Pagamento na entrega',
};

const PAYMENT_STATUS_CONFIGS: Record<PaymentStatus, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Pendente',    bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' },
  paid:      { label: 'Pago',        bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.3)'  },
  failed:    { label: 'Falhou',      bg: 'rgba(220,38,38,0.12)',  text: '#dc2626', border: 'rgba(220,38,38,0.3)'  },
  cancelled: { label: 'Cancelado',   bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
  refunded:  { label: 'Reembolsado', bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
};

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  delivery: 'Entrega',
  pickup: 'Retirada',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function getPaymentIcon(method: PaymentMethod) {
  switch (method) {
    case 'pix':
    case 'abacate_pix':
      return QrCode;
    case 'credit_card':
      return CreditCard;
    case 'cash_on_delivery':
    default:
      return Banknote;
  }
}

function getPrintPaymentMethodLabel(method: string | null): string {
  if (!method) return 'Pagamento na entrega';
  switch (method) {
    case 'abacate_pix':
    case 'pix':
      return 'PIX';
    case 'credit_card':
    case 'card':
    case 'apple_pay':
    case 'google_pay':
      return 'Cartão de Crédito';
    case 'boleto':
      return 'Boleto Bancário';
    case 'cash_on_delivery':
      return 'Dinheiro na entrega';
    default:
      return PAYMENT_METHOD_LABELS[method] || method;
  }
}

function getPrintPaymentStatusLabel(status: PaymentStatus | string): string {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'paid': return 'Pago';
    case 'failed': return 'Falhou';
    case 'cancelled': return 'Cancelado';
    case 'refunded': return 'Reembolsado';
    default: return status;
  }
}

interface OrderPrintSheetProps {
  order: Order | null;
}

function OrderPrintSheet({ order }: OrderPrintSheetProps) {
  if (!order) return null;

  const orderItems = order.order_items || [];

  return (
    <div className="saturno-print-sheet">
      <div className="p-8 max-w-4xl mx-auto text-black bg-white font-sans text-sm leading-normal">
        {/* Header */}
        <header className="border-b-2 border-black pb-4 mb-5 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Saturno Embalagens</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mt-0.5">
              Comprovante de Separação e Entrega
            </p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p className="text-base font-black">Pedido: {shortId(order.id)}</p>
            <p className="text-neutral-700">Data/Hora: {formatDate(order.created_at)}</p>
            <p className="font-semibold text-neutral-800">
              Status: <span className="uppercase">{getOrderStatusLabel(order.status, order.delivery_type)}</span>
            </p>
            <p className="font-semibold text-neutral-800">
              Pagamento: <span className="uppercase">{getPrintPaymentStatusLabel(order.payment_status)}</span>
            </p>
          </div>
        </header>

        {/* Customer & Delivery */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* Cliente */}
          <div className="border border-neutral-300 rounded p-3 bg-neutral-50/50 print-avoid-break">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-300 pb-1 mb-2">
              Dados do Cliente
            </h2>
            <div className="space-y-1 text-xs">
              <p>
                <strong className="text-neutral-900">Nome:</strong> {order.profile?.name || 'Cliente não identificado'}
              </p>
              <p>
                <strong className="text-neutral-900">Telefone:</strong> {order.profile?.phone || 'Não informado'}
              </p>
            </div>
          </div>

          {/* Entrega / Retirada */}
          <div className="border border-neutral-300 rounded p-3 bg-neutral-50/50 print-avoid-break">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-300 pb-1 mb-2">
              {order.delivery_type === 'delivery' ? 'Entrega' : 'Retirada'}
            </h2>
            <div className="space-y-1 text-xs">
              <p>
                <strong className="text-neutral-900">Tipo:</strong>{' '}
                <span className="font-bold">{order.delivery_type === 'delivery' ? 'ENTREGA' : 'RETIRADA'}</span>
              </p>
              {order.delivery_type === 'delivery' && order.shipping_address ? (
                <div className="text-neutral-800 leading-snug">
                  <p>
                    {order.shipping_address.street}, nº {order.shipping_address.number}
                    {order.shipping_address.complement ? ` (${order.shipping_address.complement})` : ''}
                  </p>
                  <p>{order.shipping_address.neighborhood} — {order.shipping_address.city}/{order.shipping_address.state}</p>
                  <p className="font-semibold">CEP: {order.shipping_address.zip_code}</p>
                </div>
              ) : (
                <div className="text-neutral-800 leading-snug">
                  <p className="font-medium">{order.pickup_address || 'Galpão Saturno Embalagens - Santa Luzia / MG'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-5 print-avoid-break">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
            Itens do Pedido ({orderItems.length})
          </h2>
          <table className="w-full text-xs border border-neutral-300 border-collapse">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-300">
                <th className="py-2 px-3 text-center font-bold uppercase text-neutral-700 w-12">#</th>
                <th className="py-2 px-3 text-left font-bold uppercase text-neutral-700">Produto / Descrição</th>
                <th className="py-2 px-3 text-center font-bold uppercase text-neutral-700 w-20">Qtd</th>
                <th className="py-2 px-3 text-right font-bold uppercase text-neutral-700 w-28">Unitário</th>
                <th className="py-2 px-3 text-right font-bold uppercase text-neutral-700 w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300">
              {orderItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-center text-neutral-500 italic">
                    Nenhum item listado.
                  </td>
                </tr>
              ) : (
                orderItems.map((item, idx) => (
                  <tr key={item.id || idx} className="print-avoid-break">
                    <td className="py-2 px-3 text-center text-neutral-500 font-medium">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-neutral-900 break-words">{item.product_name}</td>
                    <td className="py-2 px-3 text-center font-bold text-neutral-900">{item.quantity}</td>
                    <td className="py-2 px-3 text-right text-neutral-800">{formatCurrency(item.product_price)}</td>
                    <td className="py-2 px-3 text-right font-bold text-neutral-900">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Payment and Financial Summary */}
        <div className="grid grid-cols-2 gap-4 mb-5 print-avoid-break">
          {/* Detalhes do Pagamento */}
          <div className="border border-neutral-300 rounded p-3 bg-neutral-50/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-300 pb-1 mb-2">
              Pagamento
            </h2>
            <div className="space-y-1.5 text-xs">
              <p>
                <strong className="text-neutral-900">Método:</strong> {getPrintPaymentMethodLabel(order.payment_method)}
              </p>
              <p>
                <strong className="text-neutral-900">Status:</strong> {getPrintPaymentStatusLabel(order.payment_status)}
              </p>
            </div>
          </div>

          {/* Totais */}
          <div className="border border-neutral-300 rounded p-3 bg-neutral-50/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-300 pb-1 mb-2">
              Resumo Financeiro
            </h2>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-neutral-700">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-700">
                <span>Frete:</span>
                <span>{order.shipping_cost > 0 ? formatCurrency(order.shipping_cost) : 'Grátis (R$ 0,00)'}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-neutral-400 font-bold text-sm text-neutral-950">
                <span>TOTAL DO PEDIDO:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Observações do Cliente (quando existirem) */}
        {order.customer_note && (
          <div className="border border-neutral-300 rounded p-3 mb-5 bg-neutral-50/50 print-avoid-break">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-300 pb-1 mb-1.5">
              Observações do Pedido
            </h2>
            <p className="text-xs text-neutral-800 whitespace-pre-line leading-relaxed">
              {order.customer_note}
            </p>
          </div>
        )}

        {/* Assinatura e Data de Entrega */}
        <div className="border-t-2 border-dashed border-neutral-400 pt-6 mt-6 print-avoid-break">
          <div className="grid grid-cols-2 gap-8 text-xs">
            <div>
              <p className="text-neutral-700 mb-8 font-medium">Assinatura do Recebedor:</p>
              <div className="border-b border-black w-full" />
            </div>
            <div>
              <p className="text-neutral-700 mb-8 font-medium">Data de Entrega:</p>
              <p className="font-mono text-sm tracking-widest text-neutral-800">____ / ____ / ________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) return;
    if (!context.auth?.user) throw redirect({ to: '/login' });
    if (!context.auth?.profile || context.auth.profile.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminOrdersPage,
});

// ─── Component ───────────────────────────────────────────────────────────────

function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  // detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // cancellation confirmation modal
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelItems, setCancelItems] = useState<OrderItem[]>([]);
  const [loadingCancelItems, setLoadingCancelItems] = useState(false);

  // status updates in flight
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingPaymentOrderId, setUpdatingPaymentOrderId] = useState<string | null>(null);
  const [simulatingPixId, setSimulatingPixId] = useState<string | null>(null);

  // ── Fetch all orders with joined profile + shipping_address ─────────────
  const fetchOrders = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id, user_id, status, payment_status, payment_method,
          subtotal, shipping_cost, total,
          delivery_type, shipping_address_id, pickup_address,
          customer_note, created_at, updated_at,
          abacate_pix_id,
          profile:profiles!orders_user_id_fkey ( id, name, phone ),
          shipping_address:addresses!orders_shipping_address_id_fkey (
            id, street, number, complement, neighborhood, city, state, zip_code
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setOrders((data as unknown as Order[]) || []);
    } catch (err: any) {
      console.error('[ADMIN-ORDERS] fetchOrders error:', err);
      const errMsg = err?.message || err?.details || err?.hint || 'Erro desconhecido ao carregar pedidos.';
      setError(`Erro do Supabase: ${errMsg} (Code: ${err?.code})`);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Fetch order items for the detail modal ───────────────────────────────
  const openDetail = async (order: Order) => {
    setIsDetailOpen(true);
    setSelectedOrder({ ...order, order_items: undefined });
    setLoadingDetail(true);

    try {
      const { data, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_id, product_name, product_price, quantity, total_price')
        .eq('order_id', order.id)
        .order('product_name', { ascending: true });

      if (itemsError) throw itemsError;
      setSelectedOrder({ ...order, order_items: (data as OrderItem[]) || [] });
    } catch (err) {
      console.error('[ADMIN-ORDERS] fetchItems error:', err);
      toast.error('Erro ao carregar itens do pedido.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Open cancel confirmation modal ───────────────────────────────────────
  const openCancelModal = async (order: Order) => {
    setOrderToCancel(order);
    setIsCancelModalOpen(true);
    setCancelItems(order.order_items || []);

    // If order items not loaded yet, fetch them for the modal preview
    if (!order.order_items || order.order_items.length === 0) {
      try {
        setLoadingCancelItems(true);
        const { data } = await supabase
          .from('order_items')
          .select('id, product_id, product_name, product_price, quantity, total_price')
          .eq('order_id', order.id);

        setCancelItems((data as OrderItem[]) || []);
      } catch (err) {
        console.warn('[ADMIN-ORDERS] Erro ao carregar itens para cancelamento:', err);
      } finally {
        setLoadingCancelItems(false);
      }
    }
  };

  // ── Update order status via RPC ──────────────────────────────────────────
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingOrderId(orderId);

      const { data, error: rpcError } = await supabase.rpc('admin_update_order_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
      });

      if (rpcError) throw rpcError;

      const res = data as { success?: boolean; message?: string; restocked?: boolean; total_units?: number } | null;
      const successMessage = res?.message || 'Status do pedido atualizado com sucesso!';

      toast.success(successMessage);

      // Optimistic state update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      // Update detail modal if open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }

      // Close cancel modal if it was open
      if (isCancelModalOpen && orderToCancel?.id === orderId) {
        setIsCancelModalOpen(false);
        setOrderToCancel(null);
      }
    } catch (err: any) {
      console.error('[ADMIN-ORDERS] handleStatusUpdate error:', err);
      toast.error(err.message || 'Erro ao atualizar status do pedido.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // ── Update payment status via RPC ────────────────────────────────────────
  const handlePaymentStatusUpdate = async (orderId: string, newPaymentStatus: PaymentStatus) => {
    try {
      setUpdatingPaymentOrderId(orderId);

      const { error: rpcError } = await supabase.rpc('admin_update_payment_status', {
        p_order_id: orderId,
        p_new_payment_status: newPaymentStatus,
      });

      if (rpcError) {
        // Fallback to direct update if RPC is not yet loaded
        const { error: directErr } = await supabase
          .from('orders')
          .update({ payment_status: newPaymentStatus, updated_at: new Date().toISOString() })
          .eq('id', orderId);

        if (directErr) throw directErr;
      }

      toast.success(`Status de pagamento atualizado para "${PAYMENT_STATUS_CONFIGS[newPaymentStatus]?.label || newPaymentStatus}"`);

      // Optimistic state update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: newPaymentStatus } : o))
      );

      // Update detail modal if open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, payment_status: newPaymentStatus } : prev));
      }
    } catch (err: any) {
      console.error('[ADMIN-ORDERS] handlePaymentStatusUpdate error:', err);
      toast.error(err.message || 'Erro ao atualizar status de pagamento.');
    } finally {
      setUpdatingPaymentOrderId(null);
    }
  };

  // ── Simulate PIX Payment (DevMode) ───────────────────────────────────────
  const handleSimulatePix = async (orderId: string) => {
    if (!window.confirm('Atenção (DEV): Deseja simular o pagamento PIX para este pedido?')) return;

    try {
      setSimulatingPixId(orderId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-abacate-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido na simulação.');
      }

      toast.success(data.message || 'Simulação aceita. Aguarde a confirmação automática pelo webhook.');
      fetchOrders(true);
    } catch (err: any) {
      console.error('[ADMIN-ORDERS] handleSimulatePix error:', err);
      toast.error(err.message || 'Falha ao simular pagamento.');
    } finally {
      setSimulatingPixId(null);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter((order) => {
      // status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // period filter
      if (periodFilter !== 'all') {
        const orderDate = new Date(order.created_at);
        const diffMs = now.getTime() - orderDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (periodFilter === '7d' && diffDays > 7) return false;
        if (periodFilter === '30d' && diffDays > 30) return false;
        if (periodFilter === '90d' && diffDays > 90) return false;
      }

      // search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesShortId = shortId(order.id).toLowerCase().includes(q);
        const matchesName = order.profile?.name?.toLowerCase().includes(q) ?? false;
        const matchesPhone = order.profile?.phone?.toLowerCase().includes(q) ?? false;
        if (!matchesId && !matchesShortId && !matchesName && !matchesPhone) return false;
      }

      return true;
    });
  }, [orders, statusFilter, periodFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || periodFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPeriodFilter('all');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                Pedidos
              </h1>
              {!loading && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Acompanhe, atualize e gerencie os pedidos da loja com controle de estoque e pagamentos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing || loading}
              aria-label="Atualizar lista de pedidos"
              title="Atualizar lista de pedidos"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* ── Filters & Search ── */}
        <div
          className="p-3.5 sm:p-4 rounded-xl border flex flex-col md:flex-row gap-3 md:items-center"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Buscar por cliente, telefone ou ID do pedido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg border text-sm transition-all outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                title="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:opacity-80"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
            className="w-full md:w-48 px-3 py-2 rounded-lg border text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="all">Todos os status</option>
            {NORMAL_STATUS_FLOW.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            <option value="cancelled">Cancelado</option>
          </select>

          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            aria-label="Filtrar por período"
            className="w-full md:w-44 px-3 py-2 rounded-lg border text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="all">Todo período</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              aria-label="Limpar todos os filtros"
              title="Limpar todos os filtros"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--muted-foreground)',
              }}
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          /* Skeletons */
          <div className="space-y-3">
            <div
              className="hidden lg:block rounded-xl border overflow-hidden"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="h-11 border-b" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 border-b last:border-0 animate-pulse"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="space-y-1.5 w-1/5">
                    <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-3 w-20 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-5 w-20 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-5 w-24 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-4 w-16 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-8 w-32 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                </div>
              ))}
            </div>

            <div className="lg:hidden space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-4 space-y-3 animate-pulse"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="h-4 w-40 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-10 w-full rounded-xl" style={{ backgroundColor: 'var(--muted)' }} />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div
            className="p-8 sm:p-12 rounded-xl border text-center max-w-md mx-auto"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: 'var(--destructive)',
              }}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              Não foi possível carregar os pedidos.
            </h3>
            <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={() => fetchOrders()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty States */
          <div
            className="p-8 sm:p-12 rounded-xl border text-center"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--muted-foreground)',
              }}
            >
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {orders.length === 0 ? 'Você ainda não possui pedidos registrados.' : 'Nenhum pedido corresponde aos filtros atuais.'}
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {orders.length === 0
                ? 'Quando seus clientes realizarem compras na loja, os pedidos aparecerão aqui.'
                : 'Tente ajustar os termos de pesquisa, o status ou o período selecionado.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Totals summary bar ── */}
            <div
              className="flex items-center justify-between text-xs px-1"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <span>
                {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido exibido' : 'pedidos exibidos'}
              </span>
              <span>
                Total: <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(filteredOrders.reduce((s, o) => s + o.total, 0))}</strong>
              </span>
            </div>

            {/* ── Desktop table ── */}
            <div
              className="hidden lg:block overflow-hidden rounded-xl border shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-xs font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Modalidade</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 min-w-[190px]">Status do Pedido</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredOrders.map((order) => {
                    const isUpdating = updatingOrderId === order.id;
                    const isCancelled = order.status === 'cancelled';
                    const currentCfg = ALL_STATUS_CONFIGS[order.status] || ALL_STATUS_CONFIGS.pending;
                    const StatusIcon = currentCfg.icon;

                    const PaymentIcon = getPaymentIcon(order.payment_method);
                    const paymentStatusCfg = PAYMENT_STATUS_CONFIGS[order.payment_status] || PAYMENT_STATUS_CONFIGS.pending;
                    const statusLabel = getOrderStatusLabel(order.status, order.delivery_type);

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/40 transition-colors"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {/* ID */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => copyToClipboard(order.id, 'ID do pedido')}
                            aria-label={`Copiar ID ${order.id}`}
                            title="Clique para copiar o ID completo"
                            className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-1 rounded border transition-colors hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--background)',
                              borderColor: 'var(--border)',
                              color: 'var(--foreground)',
                            }}
                          >
                            <span>{shortId(order.id)}</span>
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {order.profile?.name ?? 'Cliente sem nome'}
                            </p>
                            {order.profile?.phone && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {order.profile.phone}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Data */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(order.created_at)}</span>
                          </div>
                        </td>

                        {/* Modalidade */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            {order.delivery_type === 'delivery' ? (
                              <Truck className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span>{DELIVERY_TYPE_LABELS[order.delivery_type]}</span>
                          </div>
                        </td>

                        {/* Pagamento (Método + Status) */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium">
                              <PaymentIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {order.payment_method ? PAYMENT_METHOD_LABELS[order.payment_method] : 'Na entrega'}
                              </span>
                            </div>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                              style={{
                                backgroundColor: paymentStatusCfg.bg,
                                color: paymentStatusCfg.text,
                                borderColor: paymentStatusCfg.border,
                              }}
                            >
                              {paymentStatusCfg.label}
                            </span>
                          </div>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-bold">
                            {formatCurrency(order.total)}
                          </span>
                        </td>

                        {/* Status visual control */}
                        <td className="px-4 py-3.5">
                          {isCancelled ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                                style={{
                                  backgroundColor: CANCELLED_STATUS_CONFIG.bg,
                                  color: CANCELLED_STATUS_CONFIG.text,
                                  borderColor: CANCELLED_STATUS_CONFIG.border,
                                }}
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Cancelado
                              </span>
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-muted-foreground"
                                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                title="Estoque foi automaticamente devolvido"
                              >
                                Estoque devolvido
                              </span>
                            </div>
                          ) : (
                            <div className="relative">
                              <select
                                disabled={isUpdating}
                                value={order.status}
                                onChange={(e) => {
                                  const nextStatus = e.target.value as OrderStatus;
                                  if (nextStatus === 'cancelled') {
                                    openCancelModal(order);
                                  } else {
                                    handleStatusUpdate(order.id, nextStatus);
                                  }
                                }}
                                aria-label={`Alterar status do pedido ${shortId(order.id)}`}
                                className="w-full appearance-none pl-8 pr-7 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-2 focus:ring-primary/20"
                                style={{
                                  backgroundColor: currentCfg.bg,
                                  color: currentCfg.text,
                                  borderColor: currentCfg.border,
                                }}
                              >
                                {NORMAL_STATUS_FLOW.map((s) => (
                                  <option
                                    key={s.value}
                                    value={s.value}
                                    style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                                  >
                                    {s.value === 'shipped' && order.delivery_type === 'pickup'
                                      ? 'Pronto para retirada'
                                      : s.label}
                                  </option>
                                ))}
                                <option
                                  value="cancelled"
                                  style={{ backgroundColor: 'var(--card)', color: 'var(--destructive)' }}
                                >
                                  ⚠️ Cancelar pedido
                                </option>
                              </select>
                              <StatusIcon
                                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: currentCfg.text }}
                              />
                              {isUpdating ? (
                                <Loader2
                                  className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                  style={{ color: currentCfg.text }}
                                />
                              ) : (
                                <ChevronDown
                                  className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                                  style={{ color: currentCfg.text }}
                                />
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openDetail(order)}
                              aria-label={`Ver detalhes do pedido ${shortId(order.id)}`}
                              title="Ver detalhes do pedido"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detalhes</span>
                            </button>

                            {!isCancelled && (
                              <button
                                onClick={() => openCancelModal(order)}
                                disabled={isUpdating}
                                aria-label={`Cancelar pedido ${shortId(order.id)}`}
                                title="Cancelar pedido e devolver estoque"
                                className="p-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-destructive/10 text-destructive cursor-pointer disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--background)',
                                  borderColor: 'var(--border)',
                                }}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile/Tablet cards ── */}
            <div className="lg:hidden space-y-3">
              {filteredOrders.map((order) => {
                const isUpdating = updatingOrderId === order.id;
                const isCancelled = order.status === 'cancelled';
                const currentCfg = ALL_STATUS_CONFIGS[order.status] || ALL_STATUS_CONFIGS.pending;
                const StatusIcon = currentCfg.icon;

                const PaymentIcon = getPaymentIcon(order.payment_method);
                const paymentStatusCfg = PAYMENT_STATUS_CONFIGS[order.payment_status] || PAYMENT_STATUS_CONFIGS.pending;

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl p-4 border space-y-3 shadow-xs"
                    style={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {/* Top Row: ID, Client, Total */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                          {shortId(order.id)}
                        </span>
                        <p className="text-sm font-semibold truncate mt-0.5" style={{ color: 'var(--foreground)' }}>
                          {order.profile?.name ?? 'Cliente sem nome'}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-primary block">
                          {formatCurrency(order.total)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          {order.delivery_type === 'delivery' ? (
                            <Truck className="w-3 h-3 text-primary" />
                          ) : (
                            <Package className="w-3 h-3 text-primary" />
                          )}
                          {DELIVERY_TYPE_LABELS[order.delivery_type]}
                        </span>
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div
                      className="p-2.5 rounded-xl border flex items-center justify-between text-xs"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <PaymentIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                          {order.payment_method ? PAYMENT_METHOD_LABELS[order.payment_method] : 'Na entrega'}
                        </span>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{
                          backgroundColor: paymentStatusCfg.bg,
                          color: paymentStatusCfg.text,
                          borderColor: paymentStatusCfg.border,
                        }}
                      >
                        {paymentStatusCfg.label}
                      </span>
                    </div>

                    {/* Status Changer Bar & Actions */}
                    <div
                      className="pt-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {isCancelled ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border"
                            style={{
                              backgroundColor: CANCELLED_STATUS_CONFIG.bg,
                              color: CANCELLED_STATUS_CONFIG.text,
                              borderColor: CANCELLED_STATUS_CONFIG.border,
                            }}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancelado
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Estoque devolvido
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <select
                            disabled={isUpdating}
                            value={order.status}
                            onChange={(e) => {
                              const nextStatus = e.target.value as OrderStatus;
                              if (nextStatus === 'cancelled') {
                                openCancelModal(order);
                              } else {
                                handleStatusUpdate(order.id, nextStatus);
                              }
                            }}
                            className="w-full appearance-none pl-8 pr-7 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-all disabled:opacity-50 outline-none"
                            style={{
                              backgroundColor: currentCfg.bg,
                              color: currentCfg.text,
                              borderColor: currentCfg.border,
                            }}
                          >
                            {NORMAL_STATUS_FLOW.map((s) => (
                              <option key={s.value} value={s.value} style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)' }}>
                                Status: {s.value === 'shipped' && order.delivery_type === 'pickup'
                                  ? 'Pronto para retirada'
                                  : s.label}
                              </option>
                            ))}
                            <option value="cancelled" style={{ backgroundColor: 'var(--card)', color: 'var(--destructive)' }}>
                              ⚠️ Cancelar pedido
                            </option>
                          </select>
                          <StatusIcon
                            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: currentCfg.text }}
                          />
                          {isUpdating ? (
                            <Loader2
                              className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              style={{ color: currentCfg.text }}
                            />
                          ) : (
                            <ChevronDown
                              className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                              style={{ color: currentCfg.text }}
                            />
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openDetail(order)}
                          className="px-3 py-2 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--background)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)',
                          }}
                        >
                          Detalhes
                        </button>
                        {!isCancelled && (
                          <button
                            onClick={() => openCancelModal(order)}
                            className="p-2 rounded-lg border text-xs font-medium transition-colors text-destructive hover:bg-destructive/10 cursor-pointer"
                            style={{
                              backgroundColor: 'var(--background)',
                              borderColor: 'var(--border)',
                            }}
                            title="Cancelar pedido"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── CANCELLATION CONFIRMATION MODAL ── */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)', color: 'var(--destructive)' }}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  Confirmar Cancelamento do Pedido
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pedido {orderToCancel ? shortId(orderToCancel.id) : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Warning callout */}
            <div
              className="p-3.5 rounded-xl border text-xs leading-relaxed space-y-1"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                borderColor: 'rgba(220, 38, 38, 0.2)',
                color: 'var(--destructive)',
              }}
            >
              <p className="font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Devolução automática de estoque
              </p>
              <p className="opacity-90">
                Ao cancelar este pedido, todos os itens comprados serão devolvidos ao estoque dos produtos
                e as movimentações de entrada serão registradas atomicamente.
              </p>
            </div>

            {/* Order info summary */}
            {orderToCancel && (
              <div
                className="p-3.5 rounded-xl border text-xs space-y-2"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {orderToCancel.profile?.name ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total do pedido:</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(orderToCancel.total)}
                  </span>
                </div>

                {/* Items preview to be restored */}
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                    Itens que retornarão ao estoque:
                  </p>
                  {loadingCancelItems ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Carregando itens...</span>
                    </div>
                  ) : cancelItems.length > 0 ? (
                    <div className="space-y-1">
                      {cancelItems.map((item) => (
                        <div key={item.id} className="flex justify-between text-muted-foreground">
                          <span className="truncate pr-2">• {item.product_name}</span>
                          <span className="font-medium text-success whitespace-nowrap">
                            +{item.quantity} un.
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Itens vinculados a este pedido.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setIsCancelModalOpen(false);
                setOrderToCancel(null);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-muted cursor-pointer"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={updatingOrderId !== null}
              onClick={() => {
                if (orderToCancel) {
                  handleStatusUpdate(orderToCancel.id, 'cancelled');
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: 'var(--destructive)' }}
            >
              {updatingOrderId !== null ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cancelando e devolvendo estoque...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirmar cancelamento</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL MODAL ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6 flex-wrap">
              <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                Detalhes do Pedido {selectedOrder ? shortId(selectedOrder.id) : ''}
              </DialogTitle>
              {selectedOrder && !loadingDetail && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-muted cursor-pointer shadow-sm no-print"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  title="Imprimir comprovante do pedido"
                  aria-label="Imprimir Pedido"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>Imprimir Pedido</span>
                </button>
              )}
            </div>
          </DialogHeader>

          {!selectedOrder ? null : loadingDetail ? (
            <div className="space-y-3 py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Carregando detalhes do pedido...</p>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Status Progression Workflow */}
              <div
                className="p-4 rounded-2xl border space-y-3"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Fluxo do Pedido
                  </p>
                  {selectedOrder.status === 'cancelled' && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: CANCELLED_STATUS_CONFIG.bg,
                        color: CANCELLED_STATUS_CONFIG.text,
                        borderColor: CANCELLED_STATUS_CONFIG.border,
                      }}
                    >
                      <Ban className="w-3 h-3" />
                      Cancelado (Estoque Devolvido)
                    </span>
                  )}
                </div>

                {/* Progression steps */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {NORMAL_STATUS_FLOW.map((s) => {
                    const isActive = selectedOrder.status === s.value;
                    const Icon = s.icon;
                    const isUpdating = updatingOrderId === selectedOrder.id;
                    const stepLabel = s.value === 'shipped' && selectedOrder.delivery_type === 'pickup'
                      ? 'Pronto p/ retirada'
                      : s.label;

                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusUpdate(selectedOrder.id, s.value)}
                        className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          isActive
                            ? 'ring-2 shadow-sm'
                            : 'hover:opacity-80 opacity-75 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isActive ? s.bg : 'var(--card)',
                          color: isActive ? s.text : 'var(--muted-foreground)',
                          borderColor: isActive ? s.text : 'var(--border)',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] whitespace-nowrap">{stepLabel}</span>
                        {isActive && <span className="text-[10px] font-bold">✓ Atual</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Separate Cancel Button */}
                {selectedOrder.status !== 'cancelled' ? (
                  <div className="pt-2 flex justify-end border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => openCancelModal(selectedOrder)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancelar pedido e devolver estoque
                    </button>
                  </div>
                ) : (
                  <div
                    className="p-2.5 rounded-xl text-xs flex items-center gap-2 border"
                    style={{
                      backgroundColor: 'rgba(220, 38, 38, 0.08)',
                      borderColor: 'rgba(220, 38, 38, 0.2)',
                      color: 'var(--destructive)',
                    }}
                  >
                    <RotateCcw className="w-4 h-4 flex-shrink-0" />
                    <span>Este pedido foi cancelado e os itens retornaram ao estoque.</span>
                  </div>
                )}
              </div>

              {/* Visual Payment Section */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span>Pagamento</span>
                </h3>
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Método de Pagamento */}
                    <div>
                      <span className="text-muted-foreground text-xs block mb-1">Método:</span>
                      <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                        {(() => {
                          const Icon = getPaymentIcon(selectedOrder.payment_method);
                          return <Icon className="w-4 h-4 text-primary" />;
                        })()}
                        <span>
                          {selectedOrder.payment_method
                            ? PAYMENT_METHOD_LABELS[selectedOrder.payment_method]
                            : 'Pagamento na entrega'}
                        </span>
                      </div>
                    </div>

                    {/* Status do Pagamento (com controle para Admin) */}
                    <div>
                      <span className="text-muted-foreground text-xs block mb-1">Status do Pagamento:</span>
                      <div className="flex items-center gap-2">
                        <select
                          disabled={updatingPaymentOrderId === selectedOrder.id}
                          value={selectedOrder.payment_status}
                          onChange={(e) =>
                            handlePaymentStatusUpdate(selectedOrder.id, e.target.value as PaymentStatus)
                          }
                          aria-label="Atualizar status do pagamento"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all disabled:opacity-50 outline-none focus:ring-2 focus:ring-primary/20"
                          style={{
                            backgroundColor: PAYMENT_STATUS_CONFIGS[selectedOrder.payment_status]?.bg || 'var(--card)',
                            color: PAYMENT_STATUS_CONFIGS[selectedOrder.payment_status]?.text || 'var(--foreground)',
                            borderColor: PAYMENT_STATUS_CONFIGS[selectedOrder.payment_status]?.border || 'var(--border)',
                          }}
                        >
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                          <option value="failed">Falhou</option>
                          <option value="cancelled">Cancelado</option>
                          <option value="refunded">Reembolsado</option>
                        </select>
                        {updatingPaymentOrderId === selectedOrder.id && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dev Mode Simulation Button */}
                  {selectedOrder.payment_method === 'abacate_pix' && selectedOrder.abacate_pix_id && selectedOrder.payment_status !== 'paid' && (
                    <div className="pt-3 border-t mt-3 flex justify-end" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => handleSimulatePix(selectedOrder.id)}
                        disabled={simulatingPixId === selectedOrder.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                      >
                        {simulatingPixId === selectedOrder.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Simulando pagamento...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>SIMULAR PAGAMENTO PIX (DEV)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Customer info */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Informações do Cliente</span>
                </h3>
                <div
                  className="p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nome:</span>
                    <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.profile?.name ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Telefone:</span>
                    <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.profile?.phone ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Data de criação:</span>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {formatDate(selectedOrder.created_at)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Delivery info */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>Entrega / Recebimento</span>
                </h3>
                <div
                  className="p-3.5 rounded-xl border text-xs space-y-1.5"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    {selectedOrder.delivery_type === 'delivery' ? (
                      <Truck className="w-4 h-4 text-primary" />
                    ) : (
                      <Package className="w-4 h-4 text-primary" />
                    )}
                    <span className="font-bold" style={{ color: 'var(--foreground)' }}>
                      {DELIVERY_TYPE_LABELS[selectedOrder.delivery_type]}
                    </span>
                  </div>

                  {selectedOrder.delivery_type === 'delivery' && selectedOrder.shipping_address ? (
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedOrder.shipping_address.street}, nº {selectedOrder.shipping_address.number}
                      {selectedOrder.shipping_address.complement && ` (${selectedOrder.shipping_address.complement})`}
                      <br />
                      {selectedOrder.shipping_address.neighborhood} — {selectedOrder.shipping_address.city}/{selectedOrder.shipping_address.state}
                      <br />
                      CEP: {selectedOrder.shipping_address.zip_code}
                    </p>
                  ) : (
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedOrder.pickup_address || 'R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG'}
                    </p>
                  )}
                </div>
              </section>

              {/* Order items */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span>Itens do Pedido ({selectedOrder.order_items?.length || 0})</span>
                </h3>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  <div
                    className="overflow-hidden rounded-xl border"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--muted)' }}>
                          <th className="px-3 py-2 text-left font-semibold uppercase text-muted-foreground">Produto</th>
                          <th className="px-3 py-2 text-center font-semibold uppercase text-muted-foreground">Qtd</th>
                          <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Unit.</th>
                          <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {selectedOrder.order_items.map((item) => (
                          <tr key={item.id} style={{ color: 'var(--foreground)' }}>
                            <td className="px-3 py-2.5 font-medium">
                              {item.product_name}
                            </td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground font-semibold">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                              {formatCurrency(item.product_price)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold" style={{ color: 'var(--foreground)' }}>
                              {formatCurrency(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum item encontrado.</p>
                )}
              </section>

              {/* Totals Breakdown */}
              <section
                className="p-3.5 rounded-xl border space-y-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Frete:</span>
                  <span className="text-success font-medium">
                    {selectedOrder.shipping_cost > 0 ? formatCurrency(selectedOrder.shipping_cost) : 'Grátis'}
                  </span>
                </div>
                <div
                  className="flex justify-between pt-2 border-t font-bold text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <span>Total:</span>
                  <span className="text-primary text-base font-black">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </section>

              {/* Customer note */}
              {selectedOrder.customer_note && (
                <section className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>Observações do Cliente</span>
                  </h3>
                  <p
                    className="text-xs p-3 rounded-xl border leading-relaxed"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {selectedOrder.customer_note}
                  </p>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PRINT COMPONENT & STYLES (A4 & thermal ready) ── */}
      <OrderPrintSheet order={selectedOrder} />

      <style>{`
        @media screen {
          .saturno-print-sheet {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .saturno-print-sheet,
          .saturno-print-sheet * {
            visibility: visible !important;
          }
          .saturno-print-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
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
