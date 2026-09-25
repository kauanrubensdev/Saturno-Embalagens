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
  Plus,
  Pencil,
  Trash2,
  Navigation,
  Loader2,
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

interface ShippingZone {
  id: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number | null;
  price: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ShippingZoneFormData {
  id?: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number | null;
  has_no_max: boolean;
  price: number;
  is_active: boolean;
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

const INITIAL_ZONE_FORM: ShippingZoneFormData = {
  name: '',
  min_distance_km: 0,
  max_distance_km: 10,
  has_no_max: false,
  price: 0,
  is_active: true,
};

// ============================================================
// AdminSwitch — switch com cores da identidade visual
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

  // Shipping Zones state
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState<ShippingZoneFormData>(INITIAL_ZONE_FORM);
  const [savingZone, setSavingZone] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Password reset dialog state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Fetch Settings and Shipping Zones ─────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const [settingsRes, zonesRes] = await Promise.all([
        supabase.from('settings').select('*'),
        supabase.from('shipping_zones').select('*').order('min_distance_km', { ascending: true }),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (zonesRes.error) {
        console.warn('[ADMIN-SETTINGS] shipping_zones fetch error:', zonesRes.error.message);
      } else {
        setShippingZones((zonesRes.data as ShippingZone[]) || []);
      }

      if (settingsRes.data && settingsRes.data.length > 0) {
        const settingsMap = new Map<string, any>();
        settingsRes.data.forEach((row) => {
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

  // ── Shipping Zones Handlers ───────────────────────────────────────────────

  const handleOpenNewZone = () => {
    setZoneForm(INITIAL_ZONE_FORM);
    setIsZoneModalOpen(true);
  };

  const handleOpenEditZone = (zone: ShippingZone) => {
    setZoneForm({
      id: zone.id,
      name: zone.name,
      min_distance_km: zone.min_distance_km,
      max_distance_km: zone.max_distance_km,
      has_no_max: zone.max_distance_km === null,
      price: zone.price,
      is_active: zone.is_active,
    });
    setIsZoneModalOpen(true);
  };

  const handleToggleZoneActive = async (zone: ShippingZone) => {
    const newStatus = !zone.is_active;
    try {
      setShippingZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, is_active: newStatus } : z))
      );

      const { error } = await supabase
        .from('shipping_zones')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', zone.id);

      if (error) throw error;
      toast.success(`Zona "${zone.name}" ${newStatus ? 'ativada' : 'desativada'}.`);
    } catch (err: any) {
      setShippingZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, is_active: zone.is_active } : z))
      );
      toast.error('Erro ao atualizar status da zona.');
    }
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneForm.name.trim()) {
      toast.error('O nome da zona é obrigatório.');
      return;
    }
    if (zoneForm.min_distance_km < 0) {
      toast.error('A distância mínima não pode ser negativa.');
      return;
    }
    if (!zoneForm.has_no_max && zoneForm.max_distance_km !== null && zoneForm.max_distance_km < zoneForm.min_distance_km) {
      toast.error('A distância máxima não pode ser menor que a distância mínima.');
      return;
    }
    if (zoneForm.price < 0) {
      toast.error('O valor do frete não pode ser negativo.');
      return;
    }

    try {
      setSavingZone(true);
      const payload = {
        name: zoneForm.name.trim(),
        min_distance_km: zoneForm.min_distance_km,
        max_distance_km: zoneForm.has_no_max ? null : zoneForm.max_distance_km,
        price: zoneForm.price,
        is_active: zoneForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (zoneForm.id) {
        // Update
        const { data, error } = await supabase
          .from('shipping_zones')
          .update(payload)
          .eq('id', zoneForm.id)
          .select()
          .single();

        if (error) throw error;
        toast.success('Zona de frete atualizada com sucesso.');
        setShippingZones((prev) =>
          prev.map((z) => (z.id === zoneForm.id ? (data as ShippingZone) : z))
        );
      } else {
        // Insert
        const { data, error } = await supabase
          .from('shipping_zones')
          .insert({
            name: payload.name,
            min_distance_km: payload.min_distance_km,
            max_distance_km: payload.max_distance_km,
            price: payload.price,
            is_active: payload.is_active,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success('Zona de frete criada com sucesso.');
        setShippingZones((prev) =>
          [...prev, data as ShippingZone].sort((a, b) => a.min_distance_km - b.min_distance_km)
        );
      }

      setIsZoneModalOpen(false);
    } catch (err: any) {
      console.error('[SHIPPING-ZONE-SAVE] Erro:', err);
      toast.error(err.message || 'Erro ao salvar zona de frete.');
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zone: ShippingZone) => {
    const confirmed = window.confirm(`Deseja realmente excluir a zona de frete "${zone.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingZoneId(zone.id);
      const { error } = await supabase
        .from('shipping_zones')
        .delete()
        .eq('id', zone.id);

      if (error) throw error;
      toast.success(`Zona "${zone.name}" excluída com sucesso.`);
      setShippingZones((prev) => prev.filter((z) => z.id !== zone.id));
    } catch (err: any) {
      console.error('[SHIPPING-ZONE-DELETE] Erro:', err);
      toast.error('Erro ao excluir zona de frete.');
    } finally {
      setDeletingZoneId(null);
    }
  };

  // ── Password Reset Handlers ───────────────────────────────────────────────

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
              className="h-10 px-4 text-xs sm:text-sm font-semibold shadow-sm cursor-pointer"
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
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm cursor-pointer"
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
              className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all space-y-6"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Header da Seção de Entrega */}
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
                      Opções de despacho, endereço de retirada no balcão e zonas de entrega
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveSection('delivery')}
                  disabled={savingSection === 'delivery' || savingAll}
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSection === 'delivery' ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </div>

              {/* Toggles e Configurações Gerais */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Toggle Entrega */}
                  <div
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="toggle-delivery" className="text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                        Entrega no endereço
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Permite envio de pedidos diretamente no endereço do cliente
                      </p>
                    </div>
                    <AdminSwitch
                      id="toggle-delivery"
                      checked={delivery.delivery_enabled}
                      onCheckedChange={(checked) => setDelivery({ ...delivery, delivery_enabled: checked })}
                    />
                  </div>

                  {/* Toggle Retirada */}
                  <div
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <Label htmlFor="toggle-pickup" className="text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                        Retirada no local
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Permite que o cliente retire o pedido pronto na loja física
                      </p>
                    </div>
                    <AdminSwitch
                      id="toggle-pickup"
                      checked={delivery.pickup_enabled}
                      onCheckedChange={(checked) => setDelivery({ ...delivery, pickup_enabled: checked })}
                    />
                  </div>
                </div>

                {/* Frete Padrão Info Card */}
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
                          ? 'O frete padrão está configurado como gratuito.'
                          : `Taxa padrão de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delivery.shipping_cost)}`}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="w-full sm:w-48">
                      <Label htmlFor="shipping-cost-input" className="text-xs font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                        Ajustar taxa padrão (R$)
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
                      Defina 0 para frete grátis por padrão. Caso nenhuma zona de frete específica se aplique, esse valor será utilizado.
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

              {/* ── Sub-seção: Zonas de Entrega e Tarifas (shipping_zones) ── */}
              <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                      <Navigation className="w-4 h-4 text-primary" />
                      <span>Zonas de entrega e tarifas</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure regras de entrega baseadas em faixas de distância em quilômetros.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenNewZone}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar zona</span>
                  </Button>
                </div>

                {loadingZones ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Carregando zonas de entrega...
                  </div>
                ) : shippingZones.length === 0 ? (
                  <div
                    className="p-6 rounded-xl border text-center space-y-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                      Nenhuma zona de entrega configurada
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      As entregas utilizarão a taxa de frete padrão configurada acima. Você pode criar faixas de distância específicas para cobrar valores diferentes conforme a distância.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--muted)' }}>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Nome da Zona</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Faixa de Distância</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Valor do Frete</th>
                            <th className="px-4 py-3 text-center font-semibold uppercase text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody style={{ backgroundColor: 'var(--background)' }}>
                          {shippingZones.map((zone, idx) => (
                            <tr
                              key={zone.id}
                              className="hover:bg-muted/20 transition-colors"
                              style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                            >
                              <td className="px-4 py-3 font-semibold" style={{ color: 'var(--foreground)' }}>
                                {zone.name}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {zone.min_distance_km} km {zone.max_distance_km !== null ? `até ${zone.max_distance_km} km` : 'em diante (sem limite)'}
                              </td>
                              <td className="px-4 py-3 font-bold" style={{ color: 'var(--foreground)' }}>
                                {zone.price === 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Grátis</span>
                                ) : (
                                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(zone.price)
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <AdminSwitch
                                  checked={zone.is_active}
                                  onCheckedChange={() => handleToggleZoneActive(zone)}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditZone(zone)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    title="Editar zona"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteZone(zone)}
                                    disabled={deletingZoneId === zone.id}
                                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                                    title="Excluir zona"
                                  >
                                    {deletingZoneId === zone.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="sm:hidden space-y-3">
                      {shippingZones.map((zone) => (
                        <div
                          key={zone.id}
                          className="p-3.5 rounded-xl border space-y-2.5"
                          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                                {zone.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Distância: {zone.min_distance_km} km {zone.max_distance_km !== null ? `até ${zone.max_distance_km} km` : 'em diante'}
                              </p>
                            </div>
                            <AdminSwitch
                              checked={zone.is_active}
                              onCheckedChange={() => handleToggleZoneActive(zone)}
                            />
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Frete:</span>
                              <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                                {zone.price === 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">Grátis</span>
                                ) : (
                                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(zone.price)
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditZone(zone)}
                                className="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteZone(zone)}
                                disabled={deletingZoneId === zone.id}
                                className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                                title="Excluir"
                              >
                                {deletingZoneId === zone.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm cursor-pointer"
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
                        Pagamento instantâneo via PIX / QR Code
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
                        Pagamento via checkout online ou maquininha
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
                  className="self-end sm:self-auto h-9 px-3.5 text-xs sm:text-sm cursor-pointer"
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
                    className="h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    Alterar senha
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleLogout}
                    className="h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da conta
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── Dialog Criar/Editar Zona de Frete ── */}
        <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Navigation className="w-5 h-5 text-primary" />
                {zoneForm.id ? 'Editar Zona de Frete' : 'Nova Zona de Frete'}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Defina o nome da zona, faixa de distância e taxa cobrada para entrega.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveZone} className="space-y-4 py-3">
              <div>
                <Label htmlFor="zone-name" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                  Nome da Zona <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="zone-name"
                  required
                  placeholder="Ex: Região Central (Até 5 km)"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="rounded-xl h-11"
                  disabled={savingZone}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="zone-min" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    Distância Mín. (km) *
                  </Label>
                  <Input
                    id="zone-min"
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={zoneForm.min_distance_km}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, min_distance_km: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    className="rounded-xl h-11"
                    disabled={savingZone}
                  />
                </div>

                <div>
                  <Label htmlFor="zone-max" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                    Distância Máx. (km) {!zoneForm.has_no_max && '*'}
                  </Label>
                  <Input
                    id="zone-max"
                    type="number"
                    min={zoneForm.min_distance_km}
                    step="0.5"
                    required={!zoneForm.has_no_max}
                    disabled={zoneForm.has_no_max || savingZone}
                    value={zoneForm.has_no_max ? '' : (zoneForm.max_distance_km ?? '')}
                    onChange={(e) =>
                      setZoneForm({
                        ...zoneForm,
                        max_distance_km: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="Sem limite"
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="checkbox"
                    checked={zoneForm.has_no_max}
                    onChange={(e) =>
                      setZoneForm({
                        ...zoneForm,
                        has_no_max: e.target.checked,
                        max_distance_km: e.target.checked ? null : 15,
                      })
                    }
                    disabled={savingZone}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                  />
                  <span>Sem limite máximo de distância (em diante)</span>
                </label>
              </div>

              <div>
                <Label htmlFor="zone-price" className="text-xs sm:text-sm font-medium mb-1.5 block" style={{ color: 'var(--foreground)' }}>
                  Valor do Frete (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="zone-price"
                  type="number"
                  min="0"
                  step="0.50"
                  required
                  value={zoneForm.price}
                  onChange={(e) =>
                    setZoneForm({ ...zoneForm, price: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  className="rounded-xl h-11"
                  disabled={savingZone}
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Defina 0 para frete grátis nesta faixa.
                </span>
              </div>

              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <Label htmlFor="zone-active" className="text-xs sm:text-sm font-semibold cursor-pointer" style={{ color: 'var(--foreground)' }}>
                  Zona ativa
                </Label>
                <AdminSwitch
                  id="zone-active"
                  checked={zoneForm.is_active}
                  onCheckedChange={(checked) => setZoneForm({ ...zoneForm, is_active: checked })}
                  disabled={savingZone}
                />
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsZoneModalOpen(false)}
                  disabled={savingZone}
                  className="h-10 rounded-xl cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingZone}
                  className="h-10 rounded-xl font-semibold cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {savingZone ? 'Salvando...' : zoneForm.id ? 'Salvar alterações' : 'Criar zona'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
                  className="w-full text-xs h-9 cursor-pointer"
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
                className="h-10 rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleUpdateDirectPassword}
                disabled={resettingPassword}
                className="h-10 rounded-xl font-semibold cursor-pointer"
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
