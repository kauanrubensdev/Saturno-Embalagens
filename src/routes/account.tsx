import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Header } from '@/components/customer/Header';
import {
  User,
  ShoppingBag,
  MapPin,
  Mail,
  Phone,
  Shield,
  Lock,
  LogOut,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  Calendar,
  Truck,
  Building2,
  Banknote,
  CreditCard,
  QrCode,
  ChevronRight,
  Star,
  CheckCircle2,
} from 'lucide-react';

export const Route = createFileRoute('/account')({
  beforeLoad: async ({ context }) => {
    // Aguarda autenticação estar pronta — não trata loading como "não logado"
    if (!context.auth?.authReady) {
      return;
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AccountPage,
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  created_at: string;
  updated_at?: string;
}

interface AddressFormData {
  id?: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

interface CustomerOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
}

interface CustomerOrder {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  delivery_type: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  pickup_address: string | null;
  customer_note: string | null;
  created_at: string;
  shipping_address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
  order_items?: CustomerOrderItem[];
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const ORDER_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pendente',   bg: 'rgba(251,191,36,0.12)', text: '#d97706' },
  confirmed: { label: 'Confirmado', bg: 'rgba(59,130,246,0.12)', text: '#2563eb' },
  preparing: { label: 'Em preparo', bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
  shipped:   { label: 'Enviado',    bg: 'rgba(234,88,12,0.12)',  text: '#ea580c' },
  delivered: { label: 'Entregue',   bg: 'rgba(22,163,74,0.12)',  text: '#16a34a' },
  cancelled: { label: 'Cancelado',  bg: 'rgba(220,38,38,0.12)',  text: '#dc2626' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  abacate_pix: 'PIX (AbacatePay)',
  credit_card: 'Cartão de Crédito',
  cash_on_delivery: 'Pagamento na entrega',
};

const PAYMENT_STATUS_CONFIGS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Pendente',    bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' },
  paid:      { label: 'Pago',        bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.3)'  },
  failed:    { label: 'Falhou',      bg: 'rgba(220,38,38,0.12)',  text: '#dc2626', border: 'rgba(220,38,38,0.3)'  },
  cancelled: { label: 'Cancelado',   bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
  refunded:  { label: 'Reembolsado', bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function getPaymentIcon(method: string | null) {
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

const INITIAL_ADDRESS_FORM: AddressFormData = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: 'MG',
  zip_code: '',
  is_default: false,
};

function AccountPage() {
  const { authReady, user, profile, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'orders'>('profile');

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormData>(INITIAL_ADDRESS_FORM);
  const [savingAddress, setSavingAddress] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Redireciona para /login se já terminou de carregar e não há usuário
  useEffect(() => {
    if (authReady && !user) {
      navigate({ to: '/login' });
    }
  }, [authReady, user, navigate]);

  // Sincronizar dados do profile no estado local
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  // Carregar endereços do cliente
  const fetchAddresses = async () => {
    if (!user) return;
    try {
      setLoadingAddresses(true);
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses((data as CustomerAddress[]) || []);
    } catch (err: any) {
      console.error('[ACCOUNT-ADDRESSES] Erro ao carregar endereços:', err);
      toast.error('Erro ao carregar endereços.');
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  // Carregar pedidos do cliente
  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id, user_id, status, payment_status, payment_method,
            subtotal, shipping_cost, total, delivery_type,
            pickup_address, customer_note, created_at,
            shipping_address:addresses!orders_shipping_address_id_fkey (
              street, number, neighborhood, city, state, zip_code
            ),
            order_items (
              id, product_id, product_name, product_price, quantity, total_price
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders((data as unknown as CustomerOrder[]) || []);
      } catch (err) {
        console.error('[ACCOUNT] Erro ao carregar pedidos:', err);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [user]);

  // Loading state enquanto auth inicializa
  if (!authReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Carregando sua conta...
          </p>
        </div>
      </div>
    );
  }

  // ── Handlers do Profile ───────────────────────────────────────────────────

  const handleStartEditProfile = () => {
    setName(profile?.name || '');
    setPhone(profile?.phone || '');
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setName(profile?.name || '');
    setPhone(profile?.phone || '');
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('O nome não pode ficar em branco.');
      return;
    }

    setSavingProfile(true);
    try {
      const result = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Dados atualizados com sucesso!');
        await refreshProfile();
        setIsEditingProfile(false);
      }
    } catch (err: any) {
      console.error('[ACCOUNT-UPDATE-ERROR]', err);
      toast.error(err?.message || 'Erro ao atualizar os dados.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Handlers de Endereços ─────────────────────────────────────────────────

  const handleOpenNewAddressForm = () => {
    setAddressForm({
      ...INITIAL_ADDRESS_FORM,
      is_default: addresses.length === 0, // Primeiro endereço é padrão por padrão
    });
    setIsAddressFormOpen(true);
  };

  const handleOpenEditAddressForm = (addr: CustomerAddress) => {
    setAddressForm({
      id: addr.id,
      street: addr.street,
      number: addr.number,
      complement: addr.complement || '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      zip_code: formatCep(addr.zip_code),
      is_default: addr.is_default,
    });
    setIsAddressFormOpen(true);
  };

  const handleCancelAddressForm = () => {
    setAddressForm(INITIAL_ADDRESS_FORM);
    setIsAddressFormOpen(false);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const rawCep = addressForm.zip_code.replace(/\D/g, '');
    if (rawCep.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos.');
      return;
    }
    if (!addressForm.street.trim()) {
      toast.error('O logradouro é obrigatório.');
      return;
    }
    if (!addressForm.number.trim()) {
      toast.error('O número é obrigatório.');
      return;
    }
    if (!addressForm.neighborhood.trim()) {
      toast.error('O bairro é obrigatório.');
      return;
    }
    if (!addressForm.city.trim()) {
      toast.error('A cidade é obrigatória.');
      return;
    }
    if (!addressForm.state.trim()) {
      toast.error('O estado é obrigatório.');
      return;
    }

    try {
      setSavingAddress(true);
      const isFirst = addresses.length === 0;
      const willBeDefault = isFirst || addressForm.is_default;

      // Se este endereço for marcado como padrão, desmarca os anteriores primeiro
      if (willBeDefault) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      if (addressForm.id) {
        // Atualizar endereço existente
        const { data, error } = await supabase
          .from('addresses')
          .update({
            street: addressForm.street.trim(),
            number: addressForm.number.trim(),
            complement: addressForm.complement.trim() || null,
            neighborhood: addressForm.neighborhood.trim(),
            city: addressForm.city.trim(),
            state: addressForm.state.trim().toUpperCase(),
            zip_code: rawCep,
            is_default: willBeDefault,
            updated_at: new Date().toISOString(),
          })
          .eq('id', addressForm.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        toast.success('Endereço atualizado com sucesso!');

        const updatedAddr = data as CustomerAddress;
        setAddresses((prev) => {
          const list = prev.map((a) => {
            if (a.id === updatedAddr.id) return updatedAddr;
            if (willBeDefault) return { ...a, is_default: false };
            return a;
          });
          return list.sort((a, b) => (b.is_default ? 1 : a.is_default ? -1 : 0));
        });
      } else {
        // Inserir novo endereço
        const { data, error } = await supabase
          .from('addresses')
          .insert({
            user_id: user.id,
            street: addressForm.street.trim(),
            number: addressForm.number.trim(),
            complement: addressForm.complement.trim() || null,
            neighborhood: addressForm.neighborhood.trim(),
            city: addressForm.city.trim(),
            state: addressForm.state.trim().toUpperCase(),
            zip_code: rawCep,
            is_default: willBeDefault,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success('Endereço adicionado com sucesso!');

        const newAddr = data as CustomerAddress;
        setAddresses((prev) => {
          const list = willBeDefault
            ? [newAddr, ...prev.map((a) => ({ ...a, is_default: false }))]
            : [newAddr, ...prev];
          return list.sort((a, b) => (b.is_default ? 1 : a.is_default ? -1 : 0));
        });
      }

      handleCancelAddressForm();
    } catch (err: any) {
      console.error('[ACCOUNT-ADDRESS-SAVE] Erro:', err);
      toast.error(err?.message || 'Erro ao salvar o endereço.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;
    try {
      setSettingDefaultId(addressId);

      // Desmarcar todos os endereços do usuário
      const { error: resetErr } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      if (resetErr) throw resetErr;

      // Marcar o selecionado como padrão
      const { error: setErr } = await supabase
        .from('addresses')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', addressId)
        .eq('user_id', user.id);

      if (setErr) throw setErr;

      toast.success('Endereço definido como padrão!');
      setAddresses((prev) => {
        const list = prev.map((a) => ({
          ...a,
          is_default: a.id === addressId,
        }));
        return list.sort((a, b) => (b.is_default ? 1 : a.is_default ? -1 : 0));
      });
    } catch (err: any) {
      console.error('[ACCOUNT-ADDRESS-SET-DEFAULT] Erro:', err);
      toast.error('Erro ao definir endereço como padrão.');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDeleteAddress = async (address: CustomerAddress) => {
    if (!user) return;
    const confirmed = window.confirm(`Deseja realmente excluir o endereço "${address.street}, ${address.number}"?`);
    if (!confirmed) return;

    try {
      setDeletingAddressId(address.id);
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', address.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Endereço excluído com sucesso!');
      setAddresses((prev) => prev.filter((a) => a.id !== address.id));
    } catch (err: any) {
      console.error('[ACCOUNT-ADDRESS-DELETE] Erro:', err);
      toast.error('Erro ao excluir endereço.');
    } finally {
      setDeletingAddressId(null);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você saiu da sua conta.');
      navigate({ to: '/login' });
    } catch (err: any) {
      console.error('[LOGOUT-ERROR]', err);
      toast.error('Erro ao sair da conta.');
    }
  };

  const userInitial = (profile?.name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4 w-full space-y-6">
          
          {/* ── Perfil Hero Header ── */}
          <div
            className="rounded-3xl p-6 sm:p-8 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-bold text-2xl sm:text-3xl text-white flex-shrink-0 shadow-md"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {userInitial}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                    {profile?.name || 'Cliente Saturno'}
                  </h1>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                  >
                    {profile?.role === 'admin' ? 'Administrador' : 'Cliente'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:bg-destructive/10 hover:text-destructive cursor-pointer border"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              title="Sair da conta e ir para o login"
            >
              <LogOut className="w-4 h-4 text-destructive" />
              <span>Sair da conta</span>
            </button>
          </div>

          {/* ── Navigation Tabs ── */}
          <div className="flex gap-2 border-b pb-2 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'profile' ? 'var(--primary)' : 'transparent',
              }}
            >
              <User className="w-4 h-4" />
              <span>Dados da Conta</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('addresses')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'addresses'
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'addresses' ? 'var(--primary)' : 'transparent',
              }}
            >
              <MapPin className="w-4 h-4" />
              <span>Meus Endereços</span>
              {addresses.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    backgroundColor: activeTab === 'addresses' ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                    color: activeTab === 'addresses' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {addresses.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'orders' ? 'var(--primary)' : 'transparent',
              }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Meus Pedidos</span>
              {orders.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    backgroundColor: activeTab === 'orders' ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                    color: activeTab === 'orders' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {orders.length}
                </span>
              )}
            </button>
          </div>

          {/* ── TAB 1: DADOS DA CONTA & SEGURANÇA ── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Seção 1: Dados Pessoais */}
              <div
                className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-6"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Dados Pessoais
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gerencie as informações principais do seu cadastro.
                    </p>
                  </div>

                  {!isEditingProfile && (
                    <button
                      type="button"
                      onClick={handleStartEditProfile}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm self-start sm:self-auto"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar dados</span>
                    </button>
                  )}
                </div>

                {isEditingProfile ? (
                  /* Modo de Edição */
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={savingProfile}
                        placeholder="Seu nome completo"
                        className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                        style={{
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
                        E-mail (Não editável)
                      </label>
                      <input
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="w-full h-11 px-4 rounded-xl border text-sm cursor-not-allowed opacity-75"
                        style={{
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                        }}
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        O e-mail é utilizado para autenticação e não pode ser alterado no momento.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        disabled={savingProfile}
                        placeholder="(00) 00000-0000"
                        className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                        style={{
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)',
                        }}
                      />
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={handleCancelEditProfile}
                        disabled={savingProfile}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>

                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {savingProfile ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Salvando alterações...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Salvar alterações</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Modo de Visualização */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                        <User className="w-3.5 h-3.5 text-primary" />
                        Nome Completo
                      </span>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {profile?.name || <span className="text-muted-foreground italic">Não informado</span>}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        E-mail de Cadastro
                      </span>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                        {user.email}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border sm:col-span-2" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        Telefone / WhatsApp
                      </span>
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {profile?.phone ? formatPhone(profile.phone) : <span className="text-muted-foreground italic">Não informado</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção 2: Segurança */}
              <div
                className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Segurança
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Controle sua senha e o acesso à sua conta.
                    </p>
                  </div>
                </div>

                <div
                  className="p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        Senha de acesso
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Para sua proteção, recomendamos utilizar uma senha forte e alterá-la periodicamente.
                    </p>
                  </div>

                  <Link
                    to="/forgot-password"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all hover:bg-muted cursor-pointer whitespace-nowrap self-start sm:self-auto no-underline"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <span>Alterar senha</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: MEUS ENDEREÇOS ── */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div
                className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-6"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Meus Endereços
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gerencie seus endereços para agilizar as entregas de seus pedidos.
                    </p>
                  </div>

                  {!isAddressFormOpen && (
                    <button
                      type="button"
                      onClick={handleOpenNewAddressForm}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm self-start sm:self-auto"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar endereço</span>
                    </button>
                  )}
                </div>

                {/* Formulário de Adicionar/Editar Endereço */}
                {isAddressFormOpen ? (
                  <form onSubmit={handleSaveAddress} className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                        {addressForm.id ? 'Editar Endereço' : 'Novo Endereço'}
                      </h3>
                      <button
                        type="button"
                        onClick={handleCancelAddressForm}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Fechar formulário"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* CEP */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                          CEP *
                        </label>
                        <input
                          type="text"
                          value={addressForm.zip_code}
                          onChange={(e) =>
                            setAddressForm((prev) => ({ ...prev, zip_code: formatCep(e.target.value) }))
                          }
                          required
                          disabled={savingAddress}
                          placeholder="00000-000"
                          maxLength={9}
                          className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>

                      {/* Estado (UF) */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                          Estado (UF) *
                        </label>
                        <select
                          value={addressForm.state}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))}
                          required
                          disabled={savingAddress}
                          className="w-full h-11 px-3 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 cursor-pointer"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        >
                          {BRAZILIAN_STATES.map((uf) => (
                            <option key={uf} value={uf} style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)' }}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Logradouro */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                          Logradouro (Rua, Avenida, etc.) *
                        </label>
                        <input
                          type="text"
                          value={addressForm.street}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                          required
                          disabled={savingAddress}
                          placeholder="Ex: Rua das Flores"
                          className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>

                      {/* Número */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                          Número *
                        </label>
                        <input
                          type="text"
                          value={addressForm.number}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, number: e.target.value }))}
                          required
                          disabled={savingAddress}
                          placeholder="Ex: 123 ou S/N"
                          className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>

                      {/* Complemento (Opcional) */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
                          Complemento (Opcional)
                        </label>
                        <input
                          type="text"
                          value={addressForm.complement}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, complement: e.target.value }))}
                          disabled={savingAddress}
                          placeholder="Ex: Apto 101, Bloco B"
                          className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>

                      {/* Bairro */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                          Bairro *
                        </label>
                        <input
                          type="text"
                          value={addressForm.neighborhood}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
                          required
                          disabled={savingAddress}
                          placeholder="Ex: Centro"
                          className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>

                      {/* Cidade */}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
                          Cidade *
                        </label>
                        <input
                          type="text"
                          value={addressForm.city}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                          required
                          disabled={savingAddress}
                          placeholder="Ex: Santa Luzia"
                          className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Checkbox: Definir como padrão */}
                    <div className="pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: 'var(--foreground)' }}>
                        <input
                          type="checkbox"
                          checked={addressForm.is_default}
                          onChange={(e) => setAddressForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                          disabled={savingAddress}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                        />
                        <span>Definir como endereço padrão de entrega</span>
                      </label>
                    </div>

                    {/* Botões do Formulário */}
                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={handleCancelAddressForm}
                        disabled={savingAddress}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>

                      <button
                        type="submit"
                        disabled={savingAddress}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {savingAddress ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Salvando endereço...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{addressForm.id ? 'Salvar alterações' : 'Cadastrar endereço'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : null}

                {/* Listagem de Endereços */}
                {loadingAddresses ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Carregando seus endereços...
                  </div>
                ) : addresses.length === 0 ? (
                  <div
                    className="p-8 rounded-2xl border text-center space-y-4"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                      style={{ backgroundColor: 'var(--muted)' }}
                    >
                      <MapPin className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                        Você ainda não cadastrou nenhum endereço
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cadastre seu endereço para entregas rápidas e facilitadas em suas compras.
                      </p>
                    </div>
                    {!isAddressFormOpen && (
                      <button
                        type="button"
                        onClick={handleOpenNewAddressForm}
                        className="inline-flex items-center justify-center gap-2 py-2 px-5 rounded-xl font-semibold text-white text-xs transition-all hover:opacity-90 shadow-sm cursor-pointer"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cadastrar primeiro endereço</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addresses.map((addr) => {
                      const isSettingDefault = settingDefaultId === addr.id;
                      const isDeleting = deletingAddressId === addr.id;

                      return (
                        <div
                          key={addr.id}
                          className="p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all relative"
                          style={{
                            backgroundColor: 'var(--background)',
                            borderColor: addr.is_default ? 'var(--primary)' : 'var(--border)',
                          }}
                        >
                          <div className="space-y-2">
                            {/* Badges do topo do card */}
                            <div className="flex items-center justify-between gap-2">
                              {addr.is_default ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: 'var(--primary)',
                                    color: 'var(--primary-foreground)',
                                  }}
                                >
                                  <Star className="w-3 h-3 fill-current" />
                                  Padrão
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-primary" />
                                  Endereço
                                </span>
                              )}
                            </div>

                            {/* Detalhes do Endereço */}
                            <div className="text-xs sm:text-sm space-y-1">
                              <p className="font-bold" style={{ color: 'var(--foreground)' }}>
                                {addr.street}, {addr.number}
                              </p>
                              {addr.complement && (
                                <p className="text-muted-foreground text-xs">
                                  {addr.complement}
                                </p>
                              )}
                              <p className="text-muted-foreground text-xs">
                                {addr.neighborhood} — {addr.city}/{addr.state}
                              </p>
                              <p className="text-muted-foreground font-mono text-xs pt-0.5">
                                CEP: {formatCep(addr.zip_code)}
                              </p>
                            </div>
                          </div>

                          {/* Ações do Card */}
                          <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
                            <div>
                              {!addr.is_default && (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultAddress(addr.id)}
                                  disabled={isSettingDefault || isDeleting}
                                  className="text-[11px] font-semibold transition-colors hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  style={{ color: 'var(--primary)' }}
                                >
                                  {isSettingDefault ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Definindo...
                                    </>
                                  ) : (
                                    'Definir como padrão'
                                  )}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAddressForm(addr)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-muted cursor-pointer"
                                style={{ color: 'var(--foreground)' }}
                                title="Editar endereço"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteAddress(addr)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-destructive/10 text-destructive cursor-pointer disabled:opacity-50"
                                title="Excluir endereço"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: MEUS PEDIDOS ── */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {loadingOrders ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Carregando seus pedidos...
                </div>
              ) : orders.length === 0 ? (
                <div
                  className="rounded-3xl p-8 sm:p-12 border text-center space-y-4 shadow-sm"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                      Você ainda não fez nenhum pedido
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Explore nosso catálogo e faça sua primeira compra.
                    </p>
                  </div>
                  <Link
                    to="/catalog"
                    className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white text-xs transition-all hover:opacity-90 no-underline"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    Ver Catálogo
                  </Link>
                </div>
              ) : (
                orders.map((ord) => {
                  const statusInfo =
                    ORDER_STATUS_LABELS[ord.status] || {
                      label: ord.status,
                      bg: 'var(--muted)',
                      text: 'var(--foreground)',
                    };
                  const paymentCfg =
                    PAYMENT_STATUS_CONFIGS[ord.payment_status] || PAYMENT_STATUS_CONFIGS.pending;
                  const PaymentIcon = getPaymentIcon(ord.payment_method);
                  const isExpanded = expandedOrderId === ord.id;

                  return (
                    <div
                      key={ord.id}
                      className="rounded-3xl border transition-all overflow-hidden shadow-sm"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      {/* Order summary header */}
                      <div
                        onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                              #{ord.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span
                              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              {statusInfo.label}
                            </span>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: paymentCfg.bg,
                                color: paymentCfg.text,
                                borderColor: paymentCfg.border,
                              }}
                            >
                              Pagamento: {paymentCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(ord.created_at)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {ord.delivery_type === 'delivery' ? (
                                <Truck className="w-3.5 h-3.5" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5" />
                              )}
                              {ord.delivery_type === 'delivery' ? 'Entrega' : 'Retirada'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Total</span>
                            <span className="font-bold text-sm text-primary">
                              {formatCurrency(ord.total)}
                            </span>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-muted-foreground transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded order details */}
                      {isExpanded && (
                        <div
                          className="p-4 sm:p-5 border-t space-y-4 text-xs sm:text-sm"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                          }}
                        >
                          {/* Items */}
                          <div>
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                              Itens do Pedido
                            </h4>
                            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                              {(ord.order_items || []).map((item) => (
                                <div
                                  key={item.id}
                                  className="py-2.5 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                                      {item.product_name}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {item.quantity} un. × {formatCurrency(item.product_price)}
                                    </p>
                                  </div>
                                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                    {formatCurrency(item.total_price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Reception & Payment */}
                          <div
                            className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            {/* Entrega */}
                            <div className="p-3.5 rounded-2xl bg-card border" style={{ borderColor: 'var(--border)' }}>
                              <p className="font-semibold text-xs mb-1" style={{ color: 'var(--foreground)' }}>
                                {ord.delivery_type === 'delivery' ? 'Endereço de Entrega' : 'Local de Retirada'}
                              </p>
                              {ord.delivery_type === 'delivery' && ord.shipping_address ? (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {ord.shipping_address.street}, {ord.shipping_address.number}
                                  <br />
                                  {ord.shipping_address.neighborhood} — {ord.shipping_address.city}/{ord.shipping_address.state}
                                  <br />
                                  CEP: {formatCep(ord.shipping_address.zip_code)}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {ord.pickup_address || 'R. Urupema, nº 150 - Santa Luzia/MG'}
                                </p>
                              )}
                            </div>

                            {/* Pagamento */}
                            <div className="p-3.5 rounded-2xl bg-card border space-y-1.5" style={{ borderColor: 'var(--border)' }}>
                              <p className="font-semibold text-xs" style={{ color: 'var(--foreground)' }}>
                                Pagamento
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <PaymentIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                <span>
                                  {ord.payment_method
                                    ? PAYMENT_METHOD_LABELS[ord.payment_method] || ord.payment_method
                                    : 'Pagamento na entrega'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground">Status:</span>
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                                  style={{
                                    backgroundColor: paymentCfg.bg,
                                    color: paymentCfg.text,
                                    borderColor: paymentCfg.border,
                                  }}
                                >
                                  {paymentCfg.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Frete: {ord.shipping_cost > 0 ? formatCurrency(ord.shipping_cost) : 'Grátis (R$ 0,00)'}
                              </p>
                            </div>
                          </div>

                          {ord.customer_note && (
                            <div className="p-3 rounded-2xl bg-card border text-xs" style={{ borderColor: 'var(--border)' }}>
                              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Observações: </span>
                              <span className="text-muted-foreground">{ord.customer_note}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
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
