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
  AlertTriangle,
  Sliders,
  Smartphone,
  FileText,
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
  apple_pay_enabled: boolean;
  google_pay_enabled: boolean;
  boleto_enabled: boolean;
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
  region_label?: string | null;
  zip_start?: string | null;
  zip_end?: string | null;
  estimated_days_min?: number | null;
  estimated_days_max?: number | null;
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
  region_label: string;
  zip_start: string;
  zip_end: string;
  estimated_days_min: number;
  estimated_days_max: number;
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
  apple_pay_enabled: true,
  google_pay_enabled: true,
  boleto_enabled: true,
  cash_on_delivery_enabled: true,
};

const DEFAULT_ORDERS_STOCK: OrdersStockSettings = {
  accept_orders: true,
  prep_time_minutes: 30,
  stock_control: true,
};

const INITIAL_ZONE_FORM: ShippingZoneFormData = {
  name: '',
  region_label: '',
  zip_start: '',
  zip_end: '',
  estimated_days_min: 1,
  estimated_days_max: 3,
  min_distance_km: 0,
  max_distance_km: 10,
  has_no_max: false,
  price: 0,
  is_active: true,
};

// ============================================================
// AdminSwitch — Switch refinado e acessível
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
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: checked ? 'var(--primary)' : 'var(--muted)',
        border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out"
        style={{
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
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

  // Delete Zone Confirmation Dialog
  const [zoneToDelete, setZoneToDelete] = useState<ShippingZone | null>(null);
  const [isDeleteZoneOpen, setIsDeleteZoneOpen] = useState(false);

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
          apple_pay_enabled: savedPayments?.apple_pay_enabled ?? true,
          google_pay_enabled: savedPayments?.google_pay_enabled ?? true,
          boleto_enabled: savedPayments?.boleto_enabled ?? true,
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
      toast.success('Todas as configurações foram salvas com sucesso.');
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
      region_label: zone.region_label || '',
      zip_start: zone.zip_start || '',
      zip_end: zone.zip_end || '',
      estimated_days_min: zone.estimated_days_min ?? 1,
      estimated_days_max: zone.estimated_days_max ?? 3,
      min_distance_km: zone.min_distance_km ?? 0,
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
    const cleanName = zoneForm.name.trim();
    const cleanRegion = zoneForm.region_label.trim();
    const cleanZipStart = zoneForm.zip_start.replace(/\D/g, '');
    const cleanZipEnd = zoneForm.zip_end.replace(/\D/g, '');

    if (!cleanName) {
      toast.error('O nome da zona é obrigatório.');
      return;
    }

    // Validação de Faixa de CEP
    if (cleanZipStart || cleanZipEnd) {
      if (!cleanZipStart || cleanZipStart.length !== 8) {
        toast.error('O CEP inicial deve possuir exatamente 8 dígitos numéricos.');
        return;
      }
      if (!cleanZipEnd || cleanZipEnd.length !== 8) {
        toast.error('O CEP final deve possuir exatamente 8 dígitos numéricos.');
        return;
      }
      if (cleanZipStart > cleanZipEnd) {
        toast.error('O CEP inicial não pode ser maior que o CEP final.');
        return;
      }
      if (!cleanRegion) {
        toast.error('A região/identificação é obrigatória quando a zona utilizar faixa de CEP.');
        return;
      }
    }

    if (zoneForm.price < 0) {
      toast.error('O valor do frete não pode ser negativo.');
      return;
    }

    if (zoneForm.estimated_days_min < 0) {
      toast.error('O prazo mínimo de entrega não pode ser negativo.');
      return;
    }

    if (zoneForm.estimated_days_max < zoneForm.estimated_days_min) {
      toast.error('O prazo máximo de entrega não pode ser menor que o prazo mínimo.');
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

    try {
      setSavingZone(true);
      const payload = {
        name: cleanName,
        region_label: cleanRegion || null,
        zip_start: cleanZipStart || null,
        zip_end: cleanZipEnd || null,
        estimated_days_min: zoneForm.estimated_days_min,
        estimated_days_max: zoneForm.estimated_days_max,
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
            region_label: payload.region_label,
            zip_start: payload.zip_start,
            zip_end: payload.zip_end,
            estimated_days_min: payload.estimated_days_min,
            estimated_days_max: payload.estimated_days_max,
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
          [...prev, data as ShippingZone]
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

  const handleOpenDeleteZone = (zone: ShippingZone) => {
    setZoneToDelete(zone);
    setIsDeleteZoneOpen(true);
  };

  const handleConfirmDeleteZone = async () => {
    if (!zoneToDelete) return;

    try {
      setDeletingZoneId(zoneToDelete.id);
      const { error } = await supabase
        .from('shipping_zones')
        .delete()
        .eq('id', zoneToDelete.id);

      if (error) throw error;
      toast.success(`Zona "${zoneToDelete.name}" excluída com sucesso.`);
      setShippingZones((prev) => prev.filter((z) => z.id !== zoneToDelete.id));
      setIsDeleteZoneOpen(false);
      setZoneToDelete(null);
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
              Gerencie as informações da loja, entrega, pagamentos, estoque e conta de acesso.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSettings}
              disabled={loading || savingAll}
              aria-label="Atualizar configurações"
              title="Atualizar configurações"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={loading || savingAll}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              {savingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando tudo...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar tudo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error State */}
        {fetchError && (
          <div
            className="p-4 rounded-xl border flex items-center justify-between gap-3"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              borderColor: 'rgba(220, 38, 38, 0.25)',
              color: 'var(--destructive)',
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={fetchSettings}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:opacity-80 transition-colors"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--destructive)',
                color: 'var(--destructive)',
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Skeleton Loading */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border space-y-4 animate-pulse"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-48 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-3 w-72 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="h-11 w-full rounded-xl" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-11 w-full rounded-xl" style={{ backgroundColor: 'var(--muted)' }} />
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
              className="rounded-2xl border p-5 sm:p-6 shadow-xs transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--primary)',
                    }}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Informações da Loja
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Dados cadastrais públicos e contatos do estabelecimento.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveSection('store')}
                  disabled={savingSection === 'store' || savingAll}
                  className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {savingSection === 'store' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar informações</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="store-name" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    Nome da Loja <span style={{ color: 'var(--destructive)' }}>*</span>
                  </Label>
                  <Input
                    id="store-name"
                    value={storeInfo.name}
                    onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                    placeholder="Saturno Embalagens"
                    className="h-11 rounded-xl text-sm"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="store-desc" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    Descrição da Loja
                  </Label>
                  <Textarea
                    id="store-desc"
                    rows={2}
                    value={storeInfo.description}
                    onChange={(e) => setStoreInfo({ ...storeInfo, description: e.target.value })}
                    placeholder="Embalagens para delivery com qualidade e praticidade."
                    className="rounded-xl text-sm min-h-[72px] resize-none"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="store-phone" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
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
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="store-email" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>E-mail de Contato</span>
                    </div>
                  </Label>
                  <Input
                    id="store-email"
                    type="email"
                    value={storeInfo.email}
                    onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })}
                    placeholder="contato@saturnoembalagens.com.br"
                    className="h-11 rounded-xl text-sm"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="store-address" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Endereço Completo</span>
                    </div>
                  </Label>
                  <Input
                    id="store-address"
                    value={storeInfo.address}
                    onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                    placeholder="R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140"
                    className="h-11 rounded-xl text-sm"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 2. ENTREGA E RETIRADA */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-xs transition-all space-y-6"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Header da Seção de Entrega */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--primary)',
                    }}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Entrega e Retirada
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Opções de despacho, endereço de retirada no balcão e zonas de entrega.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveSection('delivery')}
                  disabled={savingSection === 'delivery' || savingAll}
                  className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {savingSection === 'delivery' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar entrega</span>
                    </>
                  )}
                </button>
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
                        Entrega no Endereço
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Permite envio de pedidos no endereço informado pelo cliente
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
                        Retirada no Local
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
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
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
                          ? 'Frete padrão configurado como gratuito.'
                          : `Taxa padrão de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delivery.shipping_cost)}`}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="w-full sm:w-48 space-y-1">
                      <Label htmlFor="shipping-cost-input" className="text-xs font-medium block" style={{ color: 'var(--foreground)' }}>
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
                        style={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                        }}
                      />
                    </div>
                    <p className="text-xs flex-1" style={{ color: 'var(--muted-foreground)' }}>
                      Defina 0 para frete grátis por padrão. Caso nenhuma zona de frete específica se aplique, esse valor será utilizado no checkout.
                    </p>
                  </div>
                </div>

                {/* Pickup Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="pickup-address" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Endereço de Retirada no Local</span>
                    </div>
                  </Label>
                  <Input
                    id="pickup-address"
                    value={delivery.pickup_address}
                    onChange={(e) => setDelivery({ ...delivery, pickup_address: e.target.value })}
                    placeholder="R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, 33130-140"
                    className="h-11 rounded-xl text-sm"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
                      <span>Zonas de Entrega e Tarifas</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure regras de entrega baseadas em faixas de CEP/região ou faixas de distância.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenNewZone}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all hover:opacity-90 cursor-pointer self-start sm:self-auto"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar zona</span>
                  </button>
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
                      As entregas utilizarão a taxa de frete padrão configurada acima. Você pode criar faixas de CEP específicas para cobrar valores diferentes conforme a região.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-hidden rounded-xl border shadow-xs" style={{ borderColor: 'var(--border)' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--muted)' }}>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Zona / Região</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Faixa de Atendimento</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Prazo Estimado</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase text-muted-foreground">Valor do Frete</th>
                            <th className="px-4 py-3 text-center font-semibold uppercase text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                          {shippingZones.map((zone) => (
                            <tr
                              key={zone.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3.5">
                                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                  {zone.name}
                                </p>
                                {zone.region_label && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary mt-0.5">
                                    {zone.region_label}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground">
                                {zone.zip_start && zone.zip_end ? (
                                  <span className="font-mono text-[11px]">
                                    CEP {zone.zip_start.slice(0, 5)}-{zone.zip_start.slice(5)} a {zone.zip_end.slice(0, 5)}-{zone.zip_end.slice(5)}
                                  </span>
                                ) : (
                                  <span>{zone.min_distance_km} km {zone.max_distance_km !== null ? `até ${zone.max_distance_km} km` : 'em diante'}</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground">
                                {zone.estimated_days_min !== null && zone.estimated_days_max !== null && zone.estimated_days_min !== undefined && zone.estimated_days_max !== undefined ? (
                                  <span>
                                    {zone.estimated_days_min === zone.estimated_days_max
                                      ? `${zone.estimated_days_min} dia(s) úteis`
                                      : `${zone.estimated_days_min} a ${zone.estimated_days_max} dias úteis`}
                                  </span>
                                ) : (
                                  <span>Padrão</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-bold" style={{ color: 'var(--foreground)' }}>
                                {zone.price === 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Grátis</span>
                                ) : (
                                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(zone.price)
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <AdminSwitch
                                  checked={zone.is_active}
                                  onCheckedChange={() => handleToggleZoneActive(zone)}
                                />
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditZone(zone)}
                                    aria-label={`Editar zona ${zone.name}`}
                                    className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    style={{ borderColor: 'var(--border)' }}
                                    title="Editar zona"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteZone(zone)}
                                    disabled={deletingZoneId === zone.id}
                                    aria-label={`Excluir zona ${zone.name}`}
                                    className="p-1.5 rounded-lg border text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                                    style={{ borderColor: 'var(--border)' }}
                                    title="Excluir zona"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
                          className="p-3.5 rounded-xl border space-y-2.5 shadow-xs"
                          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                                {zone.name}
                              </p>
                              {zone.region_label && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary mt-0.5">
                                  {zone.region_label}
                                </span>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {zone.zip_start && zone.zip_end ? (
                                  <span className="font-mono">
                                    CEP: {zone.zip_start.slice(0, 5)}-{zone.zip_start.slice(5)} a {zone.zip_end.slice(0, 5)}-{zone.zip_end.slice(5)}
                                  </span>
                                ) : (
                                  <span>Distância: {zone.min_distance_km} km {zone.max_distance_km !== null ? `até ${zone.max_distance_km} km` : 'em diante'}</span>
                                )}
                              </p>
                              {zone.estimated_days_min !== null && zone.estimated_days_max !== null && zone.estimated_days_min !== undefined && zone.estimated_days_max !== undefined && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Prazo: {zone.estimated_days_min === zone.estimated_days_max ? `${zone.estimated_days_min} dia(s) úteis` : `${zone.estimated_days_min} a ${zone.estimated_days_max} dias úteis`}
                                </p>
                              )}
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
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditZone(zone)}
                                aria-label={`Editar zona ${zone.name}`}
                                className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteZone(zone)}
                                disabled={deletingZoneId === zone.id}
                                aria-label={`Excluir zona ${zone.name}`}
                                className="p-1.5 rounded-lg border text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
              className="rounded-2xl border p-5 sm:p-6 shadow-xs transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--primary)',
                    }}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Métodos de Pagamento
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Controle quais formas de pagamento estão disponíveis para seus clientes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveSection('payments')}
                  disabled={savingSection === 'payments' || savingAll}
                  className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {savingSection === 'payments' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar pagamentos</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {/* PIX */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-pix" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        PIX
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento instantâneo via PIX com QR Code dinâmico
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
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-card" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Cartão de Crédito / Débito
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Processamento de cartões de crédito e débito online via Stripe
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-card"
                    checked={payments.card_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, card_enabled: checked })}
                  />
                </div>

                {/* Apple Pay */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-apple-pay" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Apple Pay
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento rápido em 1 clique em dispositivos Apple via Stripe
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-apple-pay"
                    checked={payments.apple_pay_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, apple_pay_enabled: checked })}
                  />
                </div>

                {/* Google Pay */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-google-pay" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Google Pay
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento rápido com Carteira do Google via Stripe
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-google-pay"
                    checked={payments.google_pay_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, google_pay_enabled: checked })}
                  />
                </div>

                {/* Boleto */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-boleto" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Boleto Bancário
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Emissão de boleto bancário com compensação automática via Stripe
                      </p>
                    </div>
                  </div>
                  <AdminSwitch
                    id="toggle-boleto"
                    checked={payments.boleto_enabled}
                    onCheckedChange={(checked) => setPayments({ ...payments, boleto_enabled: checked })}
                  />
                </div>

                {/* Dinheiro na entrega */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="toggle-cash" className="text-sm font-semibold cursor-pointer block truncate" style={{ color: 'var(--foreground)' }}>
                        Dinheiro na Entrega
                      </Label>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                        Pagamento em espécie no momento da entrega ou retirada no local
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
              className="rounded-2xl border p-5 sm:p-6 shadow-xs transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--primary)',
                    }}
                  >
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Pedidos e Estoque
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Regras de recebimento de novos pedidos, tempo de preparo e controle de estoque.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveSection('orders')}
                  disabled={savingSection === 'orders' || savingAll}
                  className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {savingSection === 'orders' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar pedidos</span>
                    </>
                  )}
                </button>
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
                        Permitir Novos Pedidos
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Habilita a finalização de compras no catálogo da loja
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
                        Controle de Estoque
                      </Label>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Subtrai automaticamente do estoque a cada pedido confirmado
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
                    <Label htmlFor="prep-time-input" className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 block" style={{ color: 'var(--foreground)' }}>
                      <Clock className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      <span>Tempo Estimado de Preparação (minutos)</span>
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
                        className="h-11 rounded-xl text-sm w-32 font-mono"
                        style={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                        }}
                      />
                      <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        minutos (~{(ordersStock.prep_time_minutes / 60).toFixed(1).replace('.0', '')}h)
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Informa ao cliente a média de tempo para produção e despacho dos pedidos.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 5. CONTA ADMINISTRATIVA */}
            {/* ============================================================ */}
            <section
              className="rounded-2xl border p-5 sm:p-6 shadow-xs transition-all"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--primary)',
                    }}
                  >
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                      Conta Administrativa
                    </h2>
                    <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Dados da sua sessão autenticada e segurança de acesso.
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
                      Nome do Administrador
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
                      E-mail de Acesso
                    </span>
                    <div className="text-sm font-semibold mt-1 truncate" style={{ color: 'var(--foreground)' }}>
                      {user?.email || 'admin@saturnoembalagens.com.br'}
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-medium border transition-colors hover:opacity-80 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span>Alterar senha</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 shadow-xs cursor-pointer"
                    style={{ backgroundColor: 'var(--destructive)' }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── Dialog Criar/Editar Zona de Frete ── */}
        <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
          <DialogContent
            className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <DialogHeader>
              <div className="flex items-center gap-2.5 pr-6">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary)',
                  }}
                >
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                    {zoneForm.id ? 'Editar Zona de Frete' : 'Nova Zona de Frete'}
                  </DialogTitle>
                  <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
                    Configure a faixa de CEP ou distância, prazos e taxa de entrega.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSaveZone} className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="zone-name" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    Nome da Zona <span style={{ color: 'var(--destructive)' }}>*</span>
                  </Label>
                  <Input
                    id="zone-name"
                    required
                    placeholder="Ex: Santa Luzia - Sede / Central"
                    value={zoneForm.name}
                    onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                    className="rounded-xl h-11"
                    disabled={savingZone}
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="zone-region" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    Região / Identificação
                  </Label>
                  <Input
                    id="zone-region"
                    placeholder="Ex: Santa Luzia, BH Centro, Grande BH"
                    value={zoneForm.region_label}
                    onChange={(e) => setZoneForm({ ...zoneForm, region_label: e.target.value })}
                    className="rounded-xl h-11"
                    disabled={savingZone}
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Nome da cidade, bairro ou macrorregião atendida por esta faixa.
                  </span>
                </div>
              </div>

              {/* Faixa de CEP */}
              <div className="p-3.5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                    Faixa de CEP de Atendimento
                  </span>
                  <span className="text-[11px] text-muted-foreground">8 dígitos numéricos</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="zone-zip-start" className="text-xs font-semibold block" style={{ color: 'var(--foreground)' }}>
                      CEP Inicial
                    </Label>
                    <Input
                      id="zone-zip-start"
                      maxLength={9}
                      placeholder="33000-000"
                      value={zoneForm.zip_start}
                      onChange={(e) => setZoneForm({ ...zoneForm, zip_start: e.target.value })}
                      className="rounded-xl h-10 font-mono text-xs"
                      disabled={savingZone}
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="zone-zip-end" className="text-xs font-semibold block" style={{ color: 'var(--foreground)' }}>
                      CEP Final
                    </Label>
                    <Input
                      id="zone-zip-end"
                      maxLength={9}
                      placeholder="33199-999"
                      value={zoneForm.zip_end}
                      onChange={(e) => setZoneForm({ ...zoneForm, zip_end: e.target.value })}
                      className="rounded-xl h-10 font-mono text-xs"
                      disabled={savingZone}
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Prazos de Entrega */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="zone-days-min" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    Prazo Mínimo (dias)
                  </Label>
                  <Input
                    id="zone-days-min"
                    type="number"
                    min="0"
                    value={zoneForm.estimated_days_min}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, estimated_days_min: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="rounded-xl h-11 font-mono"
                    disabled={savingZone}
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="zone-days-max" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                    Prazo Máximo (dias)
                  </Label>
                  <Input
                    id="zone-days-max"
                    type="number"
                    min={zoneForm.estimated_days_min}
                    value={zoneForm.estimated_days_max}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, estimated_days_max: Math.max(zoneForm.estimated_days_min, parseInt(e.target.value) || 0) })
                    }
                    className="rounded-xl h-11 font-mono"
                    disabled={savingZone}
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
              </div>

              {/* Valor do Frete */}
              <div className="space-y-1.5">
                <Label htmlFor="zone-price" className="text-xs sm:text-sm font-semibold block" style={{ color: 'var(--foreground)' }}>
                  Valor do Frete (R$) <span style={{ color: 'var(--destructive)' }}>*</span>
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
                  className="rounded-xl h-11 font-mono"
                  disabled={savingZone}
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <span className="text-[11px] text-muted-foreground block">
                  Defina 0 para frete grátis nesta zona.
                </span>
              </div>

              {/* Compatibilidade Legada: Distância em km */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold text-muted-foreground">
                  Compatibilidade Legada (Distância em km)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="zone-min" className="text-xs text-muted-foreground block">
                      Distância Mín. (km)
                    </Label>
                    <Input
                      id="zone-min"
                      type="number"
                      min="0"
                      step="0.5"
                      value={zoneForm.min_distance_km}
                      onChange={(e) =>
                        setZoneForm({ ...zoneForm, min_distance_km: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      className="rounded-xl h-9 font-mono text-xs"
                      disabled={savingZone}
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="zone-max" className="text-xs text-muted-foreground block">
                      Distância Máx. (km)
                    </Label>
                    <Input
                      id="zone-max"
                      type="number"
                      min={zoneForm.min_distance_km}
                      step="0.5"
                      disabled={zoneForm.has_no_max || savingZone}
                      value={zoneForm.has_no_max ? '' : (zoneForm.max_distance_km ?? '')}
                      onChange={(e) =>
                        setZoneForm({
                          ...zoneForm,
                          max_distance_km: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="Sem limite"
                      className="rounded-xl h-9 font-mono text-xs"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="pt-2 border-t flex items-center justify-between"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <Label htmlFor="zone-active" className="text-xs sm:text-sm font-semibold cursor-pointer block" style={{ color: 'var(--foreground)' }}>
                    Zona Ativa
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Determina se a faixa será aplicada no cálculo de frete
                  </p>
                </div>
                <AdminSwitch
                  id="zone-active"
                  checked={zoneForm.is_active}
                  onCheckedChange={(checked) => setZoneForm({ ...zoneForm, is_active: checked })}
                  disabled={savingZone}
                />
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  disabled={savingZone}
                  className="px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingZone}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {savingZone ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : zoneForm.id ? (
                    'Salvar alterações'
                  ) : (
                    'Criar zona'
                  )}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Excluir Zona de Frete ── */}
        <Dialog open={isDeleteZoneOpen} onOpenChange={setIsDeleteZoneOpen}>
          <DialogContent
            className="sm:max-w-md rounded-2xl"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)', color: 'var(--destructive)' }}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                    Excluir Zona de Frete
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Esta ação removerá a regra de entrega.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-2 text-sm" style={{ color: 'var(--foreground)' }}>
              Tem certeza que deseja excluir a zona de frete <strong>{zoneToDelete?.name}</strong>?
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteZoneOpen(false)}
                disabled={deletingZoneId !== null}
                className="px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors hover:opacity-80 cursor-pointer"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteZone}
                disabled={deletingZoneId !== null}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'var(--destructive)' }}
              >
                {deletingZoneId !== null ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar exclusão</span>
                  </>
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogContent
            className="sm:max-w-md rounded-2xl"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <DialogHeader>
              <div className="flex items-center gap-2.5 pr-6">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary)',
                  }}
                >
                  <KeyRound className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                    Alterar Senha de Acesso
                  </DialogTitle>
                  <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
                    Defina uma nova senha ou solicite o link de recuperação por e-mail.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-new-password" style={{ color: 'var(--foreground)' }}>
                  Nova Senha
                </Label>
                <Input
                  id="admin-new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl h-11"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-confirm-password" style={{ color: 'var(--foreground)' }}>
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="admin-confirm-password"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-xl h-11"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Prefere receber um link de redefinição no seu e-mail cadastrado?
                </p>
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={resettingPassword}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-9 rounded-xl border transition-colors hover:opacity-80 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Enviar e-mail de recuperação para {user?.email}</span>
                </button>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                disabled={resettingPassword}
                className="px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateDirectPassword}
                disabled={resettingPassword}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Atualizando...</span>
                  </>
                ) : (
                  'Atualizar senha'
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
