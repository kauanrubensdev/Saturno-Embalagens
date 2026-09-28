import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Package,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  ExternalLink,
  Power,
  PowerOff,
  Boxes,
  AlertCircle,
  Tag,
  SlidersHorizontal,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
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
  category_id: string;
  created_at: string;
  category?: { id: string; name: string; slug: string } | null;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: string;
  stock_quantity: string;
  sku: string;
  image_url: string;
  category_id: string;
  is_active: boolean;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export const Route = createFileRoute('/admin/products')({
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
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    description: '',
    price: '',
    stock_quantity: '0',
    sku: '',
    image_url: '',
    category_id: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, slug, description, price, stock_quantity, sku, image_url, images, is_active, category_id, created_at, category:categories(id, name, slug)')
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id, name, slug')
          .order('name', { ascending: true }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setProducts((productsRes.data as unknown as Product[]) || []);
      setCategories((categoriesRes.data as Category[]) || []);
    } catch (err) {
      console.error('Error fetching products/categories:', err);
      setError('Não foi possível carregar os produtos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        prod.slug.toLowerCase().includes(q) ||
        (prod.sku && prod.sku.toLowerCase().includes(q));

      const matchesCategory =
        selectedCategoryFilter === 'all' || prod.category_id === selectedCategoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && prod.is_active) ||
        (statusFilter === 'inactive' && !prod.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategoryFilter, statusFilter]);

  const handleNameChange = (name: string) => {
    const newFormData = { ...formData, name };
    if (!editingProduct) {
      newFormData.slug = generateSlug(name);
    }
    setFormData(newFormData);
    if (formErrors.name) {
      setFormErrors((prev) => ({ ...prev, name: '' }));
    }
  };

  const handleSlugChange = (slug: string) => {
    const formattedSlug = generateSlug(slug);
    setFormData((prev) => ({ ...prev, slug: formattedSlug }));
    if (formErrors.slug) {
      setFormErrors((prev) => ({ ...prev, slug: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug é obrigatório';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors.slug = 'Slug inválido. Use apenas letras minúsculas, números e hífens.';
    }

    const existingSlug = products.find(
      (p) => p.slug === formData.slug && p.id !== editingProduct?.id
    );
    if (existingSlug) {
      errors.slug = 'Já existe um produto com este slug';
    }

    if (!formData.category_id) {
      errors.category_id = 'Selecione uma categoria';
    }

    const priceNum = parseFloat(formData.price.replace(',', '.'));
    if (!formData.price.trim() || isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Preço deve ser um valor maior que zero';
    }

    const stockNum = parseInt(formData.stock_quantity, 10);
    if (!formData.stock_quantity.trim() || isNaN(stockNum) || stockNum < 0) {
      errors.stock_quantity = 'Estoque deve ser um número inteiro não negativo (≥ 0)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: '',
      stock_quantity: '0',
      sku: '',
      image_url: '',
      category_id: categories[0]?.id || '',
      is_active: true,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      sku: product.sku || '',
      image_url: product.image_url || '',
      category_id: product.category_id,
      is_active: product.is_active,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const priceNum = parseFloat(formData.price.replace(',', '.'));
      const stockNum = parseInt(formData.stock_quantity, 10);

      const payload = {
        name: formData.name.trim(),
        slug: formData.slug,
        description: formData.description.trim() || null,
        price: priceNum,
        stock_quantity: stockNum,
        sku: formData.sku.trim() || null,
        image_url: formData.image_url.trim() || null,
        category_id: formData.category_id,
        is_active: formData.is_active,
      };

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);

        if (updateError) {
          if (updateError.code === '23505') {
            toast.error('Já existe um produto com este slug.');
            return;
          }
          throw updateError;
        }

        toast.success('Produto atualizado com sucesso!');
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert(payload);

        if (insertError) {
          if (insertError.code === '23505') {
            toast.error('Já existe um produto com este slug.');
            return;
          }
          throw insertError;
        }

        toast.success('Produto criado com sucesso!');
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving product:', err);
      toast.error('Erro ao salvar produto. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      setTogglingId(product.id);
      const { error: updateError } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (updateError) throw updateError;

      toast.success(
        product.is_active
          ? 'Produto desativado com sucesso!'
          : 'Produto ativado com sucesso!'
      );
      
      // Update locally to avoid flash
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
      );
    } catch (err) {
      console.error('Error toggling product status:', err);
      toast.error('Erro ao alterar status do produto.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id);

      if (deleteError) {
        if (deleteError.code === '23503') {
          toast.error('Não é possível excluir o produto pois ele possui vínculos no histórico (ex: pedidos/carrinho). Recomendamos desativá-lo.');
          return;
        }
        throw deleteError;
      }

      toast.success('Produto excluído com sucesso!');
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('Erro ao excluir produto. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategoryFilter('all');
    setStatusFilter('all');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                Produtos
              </h1>
              {!loading && (
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)' }}
                >
                  {products.length} {products.length === 1 ? 'item' : 'itens'}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Gerencie o catálogo de produtos, preços, fotos e níveis de estoque da sua loja.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing || loading}
              className="p-2.5 rounded-xl border transition-all hover:bg-muted cursor-pointer disabled:opacity-50 text-foreground"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              title="Atualizar lista de produtos"
              aria-label="Atualizar lista de produtos"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all hover:opacity-90 cursor-pointer shadow-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar produto</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          {/* Search Input (sm:col-span-6) */}
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, SKU ou slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-xl border text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                title="Limpar busca"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter (sm:col-span-3) */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              aria-label="Filtrar por categoria"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter (sm:col-span-3) */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              aria-label="Filtrar por status"
            >
              <option value="all">Todos os status</option>
              <option value="active">Apenas Ativos</option>
              <option value="inactive">Apenas Inativos</option>
            </select>
          </div>
        </div>

        {/* ── Content States ── */}
        {loading ? (
          /* Skeletons */
          <div className="space-y-3 animate-pulse">
            <div className="rounded-2xl border p-4 hidden md:block" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-48 rounded bg-muted" />
                        <div className="h-3 w-32 rounded bg-muted/60" />
                      </div>
                    </div>
                    <div className="h-6 w-24 rounded-full bg-muted/60" />
                    <div className="h-5 w-20 rounded bg-muted" />
                    <div className="h-5 w-16 rounded-full bg-muted/60" />
                    <div className="h-5 w-16 rounded-full bg-muted/60" />
                    <div className="h-8 w-24 rounded-xl bg-muted/60" />
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile skeleton */}
            <div className="md:hidden space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-xl bg-muted flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-3/4 rounded bg-muted" />
                      <div className="h-3 w-1/2 rounded bg-muted/60" />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between">
                    <div className="h-4 w-20 rounded bg-muted" />
                    <div className="h-6 w-24 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div
            className="p-8 sm:p-12 rounded-3xl border text-center max-w-lg mx-auto my-8 space-y-5 shadow-sm"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}
            >
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                {error}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Ocorreu uma falha ao consultar o banco de dados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchData(false)}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white text-xs sm:text-sm transition-all hover:opacity-90 cursor-pointer shadow-sm mx-auto"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty States */
          <div
            className="p-8 sm:p-12 rounded-3xl border text-center space-y-4 shadow-sm"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                {searchQuery || selectedCategoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Nenhum produto encontrado'
                  : 'Nenhum produto cadastrado'}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                {searchQuery || selectedCategoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Nenhum produto corresponde aos filtros atuais. Tente ajustar os termos de busca ou filtros.'
                  : 'Comece cadastrando o primeiro produto para exibir no catálogo da sua loja.'}
              </p>
            </div>

            {searchQuery || selectedCategoryFilter !== 'all' || statusFilter !== 'all' ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold border transition-all hover:bg-muted cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <X className="w-4 h-4" />
                <span>Limpar filtros</span>
              </button>
            ) : (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all hover:opacity-90 cursor-pointer text-white shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar produto</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop Table ── */}
            <div
              className="hidden md:block overflow-hidden rounded-2xl border shadow-sm"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                    <th className="py-3.5 px-4">Produto</th>
                    <th className="py-3.5 px-4">Categoria</th>
                    <th className="py-3.5 px-4">Preço</th>
                    <th className="py-3.5 px-4 text-center">Estoque</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs sm:text-sm" style={{ borderColor: 'var(--border)' }}>
                  {filteredProducts.map((product) => {
                    const isToggling = togglingId === product.id;

                    return (
                      <tr
                        key={product.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        {/* Imagem + Nome + SKU */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-12 h-12 rounded-xl border overflow-hidden flex-shrink-0 flex items-center justify-center bg-muted"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <p className="font-semibold text-foreground truncate" title={product.name}>
                                {product.name}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                {product.sku && (
                                  <span className="font-mono font-medium">
                                    SKU: {product.sku}
                                  </span>
                                )}
                                <span className="font-mono truncate">
                                  /{product.slug}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                          >
                            <Tag className="w-3 h-3 text-primary" />
                            {product.category?.name || 'Sem categoria'}
                          </span>
                        </td>

                        {/* Preço */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-foreground">
                            {formatCurrency(product.price)}
                          </span>
                        </td>

                        {/* Estoque */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor:
                                product.stock_quantity === 0
                                  ? 'rgba(220, 38, 38, 0.12)'
                                  : product.stock_quantity <= 10
                                    ? 'rgba(251, 191, 36, 0.12)'
                                    : 'rgba(22, 163, 74, 0.12)',
                              color:
                                product.stock_quantity === 0
                                  ? '#dc2626'
                                  : product.stock_quantity <= 10
                                    ? '#d97706'
                                    : '#16a34a',
                            }}
                          >
                            {product.stock_quantity === 0
                              ? 'Sem estoque'
                              : `${product.stock_quantity} un`}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: product.is_active
                                ? 'rgba(22, 163, 74, 0.12)'
                                : 'rgba(220, 38, 38, 0.12)',
                              color: product.is_active ? '#16a34a' : '#dc2626',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: product.is_active ? '#16a34a' : '#dc2626',
                              }}
                            />
                            {product.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Link para página pública */}
                            <Link
                              to={`/product/${product.slug}`}
                              target="_blank"
                              className="p-2 rounded-xl border transition-all hover:bg-muted text-muted-foreground hover:text-primary cursor-pointer"
                              style={{ borderColor: 'var(--border)' }}
                              title="Visualizar produto na loja"
                              aria-label="Visualizar produto na loja"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            {/* Botão Editar */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(product)}
                              className="p-2 rounded-xl border transition-all hover:bg-muted text-foreground hover:text-primary cursor-pointer"
                              style={{ borderColor: 'var(--border)' }}
                              title="Editar dados do produto"
                              aria-label="Editar produto"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Botão Ativar/Desativar */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(product)}
                              disabled={isToggling}
                              className="p-2 rounded-xl border transition-all hover:bg-muted cursor-pointer disabled:opacity-50"
                              style={{
                                borderColor: 'var(--border)',
                                color: product.is_active ? '#d97706' : '#16a34a',
                              }}
                              title={product.is_active ? 'Desativar produto' : 'Ativar produto'}
                              aria-label={product.is_active ? 'Desativar produto' : 'Ativar produto'}
                            >
                              {isToggling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : product.is_active ? (
                                <PowerOff className="w-3.5 h-3.5" />
                              ) : (
                                <Power className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Botão Excluir */}
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(product)}
                              className="p-2 rounded-xl border transition-all hover:bg-destructive/10 text-destructive cursor-pointer"
                              style={{ borderColor: 'var(--border)' }}
                              title="Excluir produto"
                              aria-label="Excluir produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile Cards ── */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map((product) => {
                const isToggling = togglingId === product.id;

                return (
                  <div
                    key={product.id}
                    className="p-4 rounded-2xl border space-y-3 shadow-xs"
                    style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-14 h-14 rounded-xl border overflow-hidden flex-shrink-0 flex items-center justify-center bg-muted"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {product.name}
                          </h3>
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: product.is_active
                                ? 'rgba(22, 163, 74, 0.12)'
                                : 'rgba(220, 38, 38, 0.12)',
                              color: product.is_active ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {product.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-muted text-foreground text-[11px] font-medium">
                            {product.category?.name || 'Sem categoria'}
                          </span>
                          <span
                            className="font-bold text-[11px]"
                            style={{
                              color:
                                product.stock_quantity === 0
                                  ? '#dc2626'
                                  : product.stock_quantity <= 10
                                    ? '#d97706'
                                    : '#16a34a',
                            }}
                          >
                            Estoque: {product.stock_quantity} un
                          </span>
                        </div>

                        <p className="font-black text-sm text-primary pt-0.5">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <Link
                        to={`/product/${product.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground no-underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ver na loja</span>
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(product)}
                          className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 hover:bg-muted text-foreground cursor-pointer"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(product)}
                          disabled={isToggling}
                          className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 hover:bg-muted cursor-pointer disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            color: product.is_active ? '#d97706' : '#16a34a',
                          }}
                        >
                          {isToggling ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : product.is_active ? (
                            <span>Desativar</span>
                          ) : (
                            <span>Ativar</span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDelete(product)}
                          className="p-1.5 rounded-lg border text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                          style={{ borderColor: 'var(--border)' }}
                          title="Excluir"
                          aria-label="Excluir produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit Product Modal Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <DialogHeader className="pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
              {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Nome do produto <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Caixa de Papelão 20x20x10"
                disabled={saving}
                className="h-10 rounded-xl text-sm"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: formErrors.name ? 'var(--destructive)' : 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              {formErrors.name && (
                <p className="text-xs font-medium text-destructive">
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="slug" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Slug (URL amigável) <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-2 rounded-xl bg-muted text-muted-foreground border border-border">
                  /product/
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="caixa-de-papelao-20x20x10"
                  disabled={saving}
                  className="flex-1 font-mono text-xs sm:text-sm h-10 rounded-xl"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.slug ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              {formErrors.slug && (
                <p className="text-xs font-medium text-destructive">
                  {formErrors.slug}
                </p>
              )}
            </div>

            {/* Categoria e SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="category_id" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Categoria <span style={{ color: 'var(--destructive)' }}>*</span>
                </Label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  disabled={saving}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, category_id: e.target.value }));
                    if (formErrors.category_id) {
                      setFormErrors((prev) => ({ ...prev, category_id: '' }));
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.category_id ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {formErrors.category_id && (
                  <p className="text-xs font-medium text-destructive">
                    {formErrors.category_id}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  SKU / Código Interno
                </Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="Ex: CX-202010"
                  disabled={saving}
                  className="h-10 rounded-xl text-sm font-mono"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Preço e Estoque */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Preço de Venda (R$) <span style={{ color: 'var(--destructive)' }}>*</span>
                </Label>
                <Input
                  id="price"
                  type="text"
                  value={formData.price}
                  disabled={saving}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, price: e.target.value }));
                    if (formErrors.price) {
                      setFormErrors((prev) => ({ ...prev, price: '' }));
                    }
                  }}
                  placeholder="Ex: 29.90"
                  className="h-10 rounded-xl text-sm"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.price ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                {formErrors.price && (
                  <p className="text-xs font-medium text-destructive">
                    {formErrors.price}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock_quantity" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Estoque Disponível <span style={{ color: 'var(--destructive)' }}>*</span>
                </Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  disabled={saving}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, stock_quantity: e.target.value }));
                    if (formErrors.stock_quantity) {
                      setFormErrors((prev) => ({ ...prev, stock_quantity: '' }));
                    }
                  }}
                  placeholder="0"
                  className="h-10 rounded-xl text-sm font-mono"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.stock_quantity ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                {formErrors.stock_quantity && (
                  <p className="text-xs font-medium text-destructive">
                    {formErrors.stock_quantity}
                  </p>
                )}
              </div>
            </div>

            {/* Imagem do Produto */}
            <div className="space-y-1.5">
              <Label htmlFor="image_url" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                URL da Imagem do Produto
              </Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url}
                disabled={saving}
                onChange={(e) => setFormData((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://exemplo.com/imagem-do-produto.jpg"
                className="h-10 rounded-xl text-sm"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              {formData.image_url && (
                <div className="mt-2 flex items-center gap-3 p-2.5 rounded-xl border bg-muted/40" style={{ borderColor: 'var(--border)' }}>
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Prévia da imagem</p>
                    <p className="text-[11px]">Verifique se a imagem carrega corretamente.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Descrição Detalhada
              </Label>
              <textarea
                id="description"
                value={formData.description}
                disabled={saving}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Especificações, dimensões, gramatura e recomendações do produto..."
                rows={3}
                className="w-full p-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Toggle Ativo */}
            <div className="flex items-center gap-3 pt-2 p-3 rounded-xl border bg-muted/20" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                disabled={saving}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: formData.is_active ? 'var(--success)' : 'var(--muted)' }}
                aria-label="Alternar visibilidade do produto"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div className="text-xs sm:text-sm">
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {formData.is_active ? 'Produto Ativo' : 'Produto Inativo'}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {formData.is_active
                    ? 'Visível para os clientes no catálogo e busca.'
                    : 'Oculto na loja pública (não pode ser comprado).'}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando produto...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingProduct ? 'Salvar alterações' : 'Criar produto'}</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent
          className="sm:max-w-md rounded-3xl"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span>Confirmar exclusão de produto</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Deseja realmente excluir o produto{' '}
              <strong className="text-foreground">
                "{productToDelete?.name}"
              </strong>
              ?
            </p>
            <p className="text-xs text-muted-foreground">
              Esta ação removerá permanentemente o produto do banco de dados caso ele não possua histórico em pedidos anteriores.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              style={{ backgroundColor: 'var(--destructive)' }}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir produto</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
