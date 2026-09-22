import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Store,
  Truck,
  CreditCard,
  Package,
  UserCheck,
  Save,
  RefreshCw,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Mail,
  Phone,
  Banknote,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

export const Route = createFileRoute('/admin/settings')({
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
  component: AdminSettingsPage,
});

interface StoreInfoSettings {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
}

interface DeliverySettings {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  shipping_cost: number;
  pickup_address: string;
}

interface PaymentSettings {
  pix_enabled: boolean;
  card_enabled: boolean;
  cash_on_delivery_enabled: boolean;
}

interface OrdersStockSettings {
  accept_orders: boolean;
  prep_time_minutes: number;
  stock_control: boolean;
}

const DEFAULT_STORE_INFO: StoreInfoSettings = {
  name: 'Saturno Embalagens',
  description: 'Embalagens para delivery com qualidade e praticidade.',
  phone: '',
  email: '',
  address: 'R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140',
};

const DEFAULT_DELIVERY: DeliverySettings = {
  delivery_enabled: true,
  pickup_enabled: true,
  shipping_cost: 0,
  pickup_address: 'R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140',
};

const DEFAULT_PAYMENTS: PaymentSettings = {
  pix_enabled: true,
  card_enabled: true,
  cash_on_delivery_enabled: true,
};

const DEFAULT_ORDERS_STOCK: OrdersStockSettings = {
  accept_orders: true,
  prep_time_minutes: 30,
  stock_control: true,
};

// ============================================================
// AdminSwitch — switch com cores explícitas da identidade visual
// Usado exclusivamente em /admin/settings para garantir contraste
// máximo em ambos os temas (dark/light) sem afetar outros usos
// do componente Switch global.
// ON:  trilho laranja (#FF4103) + bolinha branca
// OFF: trilho cinza-escuro semi-opaco + bolinha cinza-clara
// ============================================================
interface AdminSwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function AdminSwitch({ id, checked, onCheckedChange, disabled = false }: AdminSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: checked ? '#FF4103' : 'rgba(100,116,139,0.55)',
        border: checked ? '2px solid #FF4103' : '2px solid rgba(148,163,184,0.6)',
        focusRingColor: '#FF4103',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition-transform duration-200 ease-in-out"
        style={{
          backgroundColor: checked ? '#ffffff' : '#cbd5e1',
          transform: checked ? 'translateX(20px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}

function AdminSettingsPage() {
  const { user, profile, logout, forgotPassword } = useAuth();

  const [storeInfo, setStoreInfo] = useState<StoreInfoSettings>(DEFAULT_STORE_INFO);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [payments, setPayments] = useState<PaymentSettings>(DEFAULT_PAYMENTS);
  const [ordersStock, setOrdersStock] = useState<OrdersStockSettings>(DEFAULT_ORDERS_STOCK);

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Password reset dialog state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        const settingsMap = new Map<string, any>();
        data.forEach((row) => {
          settingsMap.set(row.key, row.value);
        });

        // 1. Store info
        const savedStoreInfo = settingsMap.get('store_info');
        const legacyStoreName = settingsMap.get('store_name');
        const legacyPickup = settingsMap.get('pickup_address');

        setStoreInfo({
          name:
            savedStoreInfo?.name ||
            (typeof legacyStoreName === 'object' && legacyStoreName?.pt) ||
            (typeof legacyStoreName === 'string' ? legacyStoreName : DEFAULT_STORE_INFO.name),
          description: savedStoreInfo?.description ?? DEFAULT_STORE_INFO.description,
          phone: savedStoreInfo?.phone ?? '',
          email: savedStoreInfo?.email ?? '',
          address:
            savedStoreInfo?.address ||
            (typeof legacyPickup === 'string'
              ? legacyPickup
              : typeof legacyPickup === 'object' && legacyPickup?.street
                ? `${legacyPickup.street}, nº ${legacyPickup.number || ''} - ${legacyPickup.neighborhood || ''}, ${legacyPickup.city || ''} - ${legacyPickup.state || ''}, ${legacyPickup.zip_code || ''}`
                : DEFAULT_STORE_INFO.address),
        });

        // 2. Delivery & Pickup
        const savedDelivery = settingsMap.get('delivery_settings');
        const legacyFreeShipping = settingsMap.get('free_shipping');

        setDelivery({
          delivery_enabled: savedDelivery?.delivery_enabled ?? true,
          pickup_enabled: savedDelivery?.pickup_enabled ?? true,
          shipping_cost: savedDelivery?.shipping_cost ?? (legacyFreeShipping?.cost ?? 0),
          pickup_address:
            savedDelivery?.pickup_address ||
            (typeof legacyPickup === 'string'
              ? legacyPickup
              : typeof legacyPickup === 'object' && legacyPickup?.street
                ? `${legacyPickup.street}, nº ${legacyPickup.number || ''} - ${legacyPickup.neighborhood || ''}, ${legacyPickup.city || ''} - ${legacyPickup.state || ''}, ${legacyPickup.zip_code || ''}`
                : DEFAULT_DELIVERY.pickup_address),
        });

        // 3. Payments
        const savedPayments = settingsMap.get('payment_methods');
        setPayments({
          pix_enabled: savedPayments?.pix_enabled ?? true,
          card_enabled: savedPayments?.card_enabled ?? true,
          cash_on_delivery_enabled: savedPayments?.cash_on_delivery_enabled ?? true,
        });

        // 4. Orders & Stock
        const savedOrdersStock = settingsMap.get('orders_stock');
        setOrdersStock({
          accept_orders: savedOrdersStock?.accept_orders ?? true,
          prep_time_minutes: savedOrdersStock?.prep_time_minutes ?? 30,
          stock_control: savedOrdersStock?.stock_control ?? true,
        });
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setFetchError(err.message || 'Erro ao carregar as configurações');
      toast.error('Erro ao carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Persist a specific setting key
  const saveSettingKey = async (key: string, value: any) => {
    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    if (error) throw error;
  };

  // Save specific section
  const handleSaveSection = async (section: 'store' | 'delivery' | 'payments' | 'orders') => {
    try {
      setSavingSection(section);

      if (section === 'store') {
        await saveSettingKey('store_info', storeInfo);
        // Also keep legacy store_name synchronized for backward compatibility
        await saveSettingKey('store_name', { pt: storeInfo.name });
      } else if (section === 'delivery') {
        await saveSettingKey('delivery_settings', delivery);
        await saveSettingKey('free_shipping', {
          enabled: delivery.shipping_cost === 0,
          cost: delivery.shipping_cost,
        });
        await saveSettingKey('pickup_address', delivery.pickup_address);
      } else if (section === 'payments') {
        await saveSettingKey('payment_methods', payments);
      } else if (section === 'orders') {
        await saveSettingKey('orders_stock', ordersStock);
      }

      toast.success('Configurações salvas com sucesso.');
    } catch (err: any) {
      console.error(`Error saving ${section} settings:`, err);
      toast.error('Erro ao salvar as configurações. Tente novamente.');
    } finally {
      setSavingSection(null);
    }
  };

  // Save all settings at once
  const handleSaveAll = async () => {
    try {
      setSavingAll(true);
      await Promise.all([
        saveSettingKey('store_info', storeInfo),
        saveSettingKey('store_name', { pt: storeInfo.name }),
        saveSettingKey('delivery_settings', delivery),
        saveSettingKey('free_shipping', {
          enabled: delivery.shipping_cost === 0,
          cost: delivery.shipping_cost,
        }),
        saveSettingKey('pickup_address', delivery.pickup_address),
        saveSettingKey('payment_methods', payments),
        saveSettingKey('orders_stock', ordersStock),
      ]);
      toast.success('Configurações salvas com sucesso.');
    } catch (err: any) {
      console.error('Error saving all settings:', err);
      toast.error('Erro ao salvar as configurações. Tente novamente.');
    } finally {
      setSavingAll(false);
    }
  };

  // Password reset handlers
  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    try {
      setResettingPassword(true);
      const res = await forgotPassword(user.email);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`E-mail de recuperação enviado para ${user.email}`);
        setIsPasswordModalOpen(false);
      }
    } catch (err) {
      toast.error('Erro ao enviar e-mail de recuperação.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleUpdateDirectPassword = async () => {
    if (!newPassword) {
      toast.error('Digite a nova senha.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem.');
      return;
    }

    try {
      setResettingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message || 'Erro ao alterar a senha.');
      } else {
        toast.success('Senha atualizada com sucesso!');
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar a senha.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Configurações
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie as informações da loja, entrega, pagamentos, estoque e conta administrativa.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSettings}
              disabled={loading || savingAll}
              className="h-10 px-3 text-xs sm:text-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              onClick={handleSaveAll}
              disabled={loading || savingAll}
              className="h-10 px-4 text-xs sm:text-sm font-semibold shadow-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Save className="w-4 h-4 mr-1.5" />
              {savingAll ? 'Salvando...' : 'Salvar tudo'}
            </Button>
          </div>
        </div>

        {/* Error State */}
        {fetchError && (
          <div
            className="p-4 rounded-xl border flex items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--destructive)/10',
              borderColor: 'var(--destructive)/30',
              color: 'var(--destructive)',
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchSettings}
              className="border-destructive/40 hover:bg-destructive/10 text-xs"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Skeleton Loading */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border space-y-4"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="w-48 h-5" />
                    <Skeleton className="w-72 h-3" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* ============================================================ */}
            {/* 1. INFORMAÇÕES DA LOJA */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)/15', color: 'var(--primary)' }}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Informações da loja
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Dados cadastrais públicos e contatos do seu estabelecimento
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveSection('store')}
                  disabled={savingSection === 'store' || savingAll}
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSection === 'store' ? 'Salvando...' : 'Salvar informações'}
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="sm:col-span-2">
                  <Label htmlFor="store-name" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    Nome da loja <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="store-name"
                    value={storeInfo.name}
                    onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                    placeholder="Saturno Embalagens"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="store-desc" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    Descrição da loja
                  </Label>
                  <Textarea
                    id="store-desc"
                    rows={2}
                    value={storeInfo.description}
                    onChange={(e) => setStoreInfo({ ...storeInfo, description: e.target.value })}
                    placeholder="Embalagens para delivery com qualidade e praticidade."
                    className="rounded-xl text-sm min-h-[72px]"
                  />
                </div>

                <div>
                  <Label htmlFor="store-phone" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Telefone / WhatsApp</span>
                    </div>
                  </Label>
                  <Input
                    id="store-phone"
                    value={storeInfo.phone}
                    onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                    placeholder="(31) 99999-9999"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="store-email" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>E-mail de contato</span>
                    </div>
                  </Label>
                  <Input
                    id="store-email"
                    type="email"
                    value={storeInfo.email}
                    onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })}
                    placeholder="contato@saturnoembalagens.com.br"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="store-address" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Endereço completo</span>
                    </div>
                  </Label>
                  <Input
                    id="store-address"
                    value={storeInfo.address}
                    onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                    placeholder="R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 2. ENTREGA E RETIRADA */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)/15', color: 'var(--primary)' }}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Entrega e retirada
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Opções de despacho, endereço de retirada e regras de frete
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveSection('delivery')}
                  disabled={savingSection === 'delivery' || savingAll}
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSection === 'delivery' ? 'Salvando...' : 'Salvar entrega'}
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="toggle-delivery" className="text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                        Entrega
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Permite envio de pedidos no endereço do cliente
                      </p>
                    </div>
                    <AdminSwitch
                      id="toggle-delivery"
                      checked={delivery.delivery_enabled}
                      onCheckedChange={(checked) => setDelivery({ ...delivery, delivery_enabled: checked })}
                    />
                  </div>

                  <div
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="toggle-pickup" className="text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                        Retirada no local
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Permite que o cliente retire o pedido na loja
                      </p>
                    </div>
                    <AdminSwitch
                      id="toggle-pickup"
                      checked={delivery.pickup_enabled}
                      onCheckedChange={(checked) => setDelivery({ ...delivery, pickup_enabled: checked })}
                    />
                  </div>
                </div>

                {/* Frete Info Card */}
                <div
                  className="p-4 rounded-xl border space-y-3"
                  style={{ backgroundColor: 'var(--muted)/40', borderColor: 'var(--border)' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--muted-foreground)' }}>
                        Valor do Frete Padrão
                      </span>
                      <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--foreground)' }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delivery.shipping_cost)}
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {delivery.shipping_cost === 0
                          ? 'O frete está configurado como gratuito.'
                          : `Taxa fixa de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delivery.shipping_cost)}`}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="w-full sm:w-48">
                      <Label htmlFor="shipping-cost-input" className="text-xs font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                        Ajustar taxa (R$)
                      </Label>
                      <Input
                        id="shipping-cost-input"
                        type="number"
                        min="0"
                        step="0.50"
                        value={delivery.shipping_cost}
                        onChange={(e) =>
                          setDelivery({
                            ...delivery,
                            shipping_cost: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="h-10 rounded-xl text-sm"
                      />
                    </div>
                    <p className="text-xs flex-1" style={{ color: 'var(--muted-foreground)' }}>
                      Defina 0 para frete grátis geral. Cálculo de distância por CEP e zonas complexas poderão ser ativados em expansões futuras.
                    </p>
                  </div>
                </div>

                {/* Pickup Address */}
                <div>
                  <Label htmlFor="pickup-address" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Endereço de retirada no local</span>
                    </div>
                  </Label>
                  <Input
                    id="pickup-address"
                    value={delivery.pickup_address}
                    onChange={(e) => setDelivery({ ...delivery, pickup_address: e.target.value })}
                    placeholder="R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140"
                    className="h-11 rounded-xl text-sm"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Endereço exibido aos clientes no checkout quando selecionarem &quot;Retirada no Local&quot;.
                  </p>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 3. PAGAMENTOS */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)/15', color: 'var(--primary)' }}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Métodos de pagamento
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Controle quais formas de pagamento estão disponíveis para seus clientes
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveSection('payments')}
                  disabled={savingSection === 'payments' || savingAll}
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSection === 'payments' ? 'Salvando...' : 'Salvar pagamentos'}
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {/* PIX */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'var(--primary)/10', color: 'var(--primary)' }}
                    >
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-pix" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        PIX
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento instantâneo via chave PIX / QR Code
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-pix"
                    checked={payments.pix_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, pix_enabled: checked })}
                  />
                </div>

                {/* Cartão */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'var(--primary)/10', color: 'var(--primary)' }}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-card" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Cartão de Crédito / Débito
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento via maquininha ou checkout
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-card"
                    checked={payments.card_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, card_enabled: checked })}
                  />
                </div>

                {/* Dinheiro na entrega */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'var(--primary)/10', color: 'var(--primary)' }}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-cash" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Dinheiro na entrega
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento em espécie no momento da entrega ou retirada
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-cash"
                    checked={payments.cash_on_delivery_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, cash_on_delivery_enabled: checked })}
                  />
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 4. PEDIDOS E ESTOQUE */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)/15', color: 'var(--primary)' }}
                  >
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Pedidos e estoque
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Regras de fluxo de novos pedidos, tempo de preparo e controle de estoque
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveSection('orders')}
                  disabled={savingSection === 'orders' || savingAll}
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSection === 'orders' ? 'Salvando...' : 'Salvar pedidos'}
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Permitir novos pedidos */}
                  <div
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="toggle-accept-orders" className="text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                        Permitir novos pedidos
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Habilita a finalização de compras no catálogo
                      </p>
                    </div>
                    <AdminSwitch
                      id="toggle-accept-orders"
                      checked={ordersStock.accept_orders}
                      onCheckedChange={(checked) => setOrdersStock({ ...ordersStock, accept_orders: checked })}
                    />
                  </div>

                  {/* Controle de estoque */}
                  <div
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="toggle-stock-control" className="text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                        Controle de estoque
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Subtrai do estoque a cada pedido confirmado
                      </p>
                    </div>
                    <AdminSwitch
                      id="toggle-stock-control"
                      checked={ordersStock.stock_control}
                      onCheckedChange={(checked) => setOrdersStock({ ...ordersStock, stock_control: checked })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Tempo estimado de preparação */}
                  <div
                    className="p-4 rounded-xl border space-y-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <Label htmlFor="prep-time-input" className="text-xs sm:text-sm font-medium flex items-center gap-1.5 block" style={{ color: 'var(--foreground)' }}>
                      <Clock className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Tempo estimado de preparação (minutos)</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="prep-time-input"
                        type="number"
                        min="5"
                        max="240"
                        value={ordersStock.prep_time_minutes}
                        onChange={(e) =>
                          setOrdersStock({
                            ...ordersStock,
                            prep_time_minutes: Math.max(1, parseInt(e.target.value, 10) || 30),
                          })
                        }
                        className="h-11 rounded-xl text-sm w-32"
                      />
                      <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        minutos (~{(ordersStock.prep_time_minutes / 60).toFixed(1).replace('.0', '')}h)
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Informa ao cliente a média de tempo para produção e despacho.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 5. CONTA ADMINISTRATIVA */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)/15', color: 'var(--primary)' }}
                  >
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Conta administrativa
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Dados da sua sessão autenticada e segurança de acesso
                    </p>
                  </div>
                </div>

                <Badge
                  variant="default"
                  className="self-start sm:self-auto px-3 py-1 text-xs font-semibold flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Administrador
                </Badge>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome do Administrador */}
                  <div
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <span className="text-xs font-medium uppercase tracking-wider block" style={{ color: 'var(--muted-foreground)' }}>
                      Nome do administrador
                    </span>
                    <div className="text-sm font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
                      {profile?.name || user?.user_metadata?.name || 'Administrador'}
                    </div>
                  </div>

                  {/* E-mail do Administrador */}
                  <div
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <span className="text-xs font-medium uppercase tracking-wider block" style={{ color: 'var(--muted-foreground)' }}>
                      E-mail de acesso
                    </span>
                    <div className="text-sm font-semibold mt-1 truncate" style={{ color: 'var(--foreground)' }}>
                      {user?.email || 'admin@saturnoembalagens.com.br'}
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    Alterar senha
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleLogout}
                    className="h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da conta
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Change Password Dialog */}
        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <KeyRound className="w-5 h-5 text-primary" />
                Alterar senha de acesso
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Você pode definir uma nova senha diretamente ou solicitar o link de redefinição por e-mail ({user?.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-new-password" style={{ color: 'var(--foreground)' }}>
                  Nova senha
                </Label>
                <Input
                  id="admin-new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-confirm-password" style={{ color: 'var(--foreground)' }}>
                  Confirmar nova senha
                </Label>
                <Input
                  id="admin-confirm-password"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Prefere receber um link de redefinição no seu e-mail cadastrado?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendResetEmail}
                  disabled={resettingPassword}
                  className="w-full text-xs h-9"
                >
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                  Enviar e-mail de recuperação para {user?.email}
                </Button>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordModalOpen(false)}
                disabled={resettingPassword}
                className="h-10 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleUpdateDirectPassword}
                disabled={resettingPassword}
                className="h-10 rounded-xl font-semibold"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {resettingPassword ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
