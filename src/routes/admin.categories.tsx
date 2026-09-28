import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
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
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Layers,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
  ExternalLink,
  FolderTree,
  Calendar,
  Folder,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  product_count?: number;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
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

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

export const Route = createFileRoute('/admin/categories')({
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
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [checkingProducts, setCheckingProducts] = useState(false);
  const [hasProducts, setHasProducts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchCategories = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;

      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Não foi possível carregar as categorias.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Status counts for filter tabs
  const activeCount = useMemo(() => categories.filter((c) => c.is_active).length, [categories]);
  const inactiveCount = useMemo(() => categories.filter((c) => !c.is_active).length, [categories]);

  const filteredCategories = useMemo(() => {
    let result = categories;

    // Filter by status tab
    if (statusFilter === 'active') {
      result = result.filter((c) => c.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter((c) => !c.is_active);
    }

    // Filter by search term
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (cat) =>
          cat.name.toLowerCase().includes(query) ||
          cat.slug.toLowerCase().includes(query) ||
          (cat.description && cat.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [categories, statusFilter, searchQuery]);

  const handleNameChange = (name: string) => {
    const newFormData = { ...formData, name };
    if (!editingCategory) {
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
      errors.name = 'Nome é obrigatório.';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug é obrigatório.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors.slug = 'Slug inválido. Use apenas letras minúsculas, números e hífens.';
    }

    const existingSlug = categories.find(
      (c) => c.slug === formData.slug && c.id !== editingCategory?.id
    );
    if (existingSlug) {
      errors.slug = 'Já existe uma categoria com este slug.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      is_active: true,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      is_active: category.is_active,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      if (editingCategory) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            slug: formData.slug,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          })
          .eq('id', editingCategory.id);

        if (updateError) {
          if (updateError.code === '23505') {
            setFormErrors((prev) => ({ ...prev, slug: 'Já existe uma categoria com este slug.' }));
            toast.error('Já existe uma categoria com este slug.');
            return;
          }
          throw updateError;
        }

        toast.success('Categoria atualizada com sucesso!');
      } else {
        const maxSortOrder = categories.reduce(
          (max, c) => Math.max(max, c.sort_order || 0),
          0
        );

        const { error: insertError } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            slug: formData.slug,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            sort_order: maxSortOrder + 1,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setFormErrors((prev) => ({ ...prev, slug: 'Já existe uma categoria com este slug.' }));
            toast.error('Já existe uma categoria com este slug.');
            return;
          }
          throw insertError;
        }

        toast.success('Categoria criada com sucesso!');
      }

      setIsDialogOpen(false);
      fetchCategories(true);
    } catch (err) {
      console.error('Error saving category:', err);
      toast.error('Erro ao salvar categoria. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      setTogglingId(category.id);
      const nextStatus = !category.is_active;

      const { error: updateError } = await supabase
        .from('categories')
        .update({ is_active: nextStatus })
        .eq('id', category.id);

      if (updateError) throw updateError;

      // Update state locally for fast feedback
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, is_active: nextStatus } : c))
      );

      toast.success(
        nextStatus ? 'Categoria ativada com sucesso!' : 'Categoria desativada com sucesso!'
      );
    } catch (err) {
      console.error('Error toggling category status:', err);
      toast.error('Erro ao alterar status. Tente novamente.');
      fetchCategories(true);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenDelete = async (category: Category) => {
    setCategoryToDelete(category);
    setCheckingProducts(true);
    setIsDeleteDialogOpen(true);

    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', category.id)
        .limit(1);

      if (productsError) throw productsError;

      setHasProducts(Boolean(products && products.length > 0));
    } catch (err) {
      console.error('Error checking products:', err);
      setHasProducts(false);
    } finally {
      setCheckingProducts(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    if (hasProducts) {
      setIsDeleteDialogOpen(false);
      toast.error('Esta categoria possui produtos vinculados e não pode ser excluída.');
      return;
    }

    try {
      setDeleting(true);

      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryToDelete.id);

      if (deleteError) throw deleteError;

      // Update locally
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));

      toast.success('Categoria excluída com sucesso!');
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Erro ao excluir categoria. Tente novamente.');
      fetchCategories(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                Categorias
              </h1>
              {!loading && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie as categorias para organizar os produtos do seu catálogo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCategories(true)}
              disabled={isRefreshing || loading}
              aria-label="Atualizar categorias"
              title="Atualizar lista"
              className="inline-flex items-center justify-center p-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Nova categoria</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          className="p-3 sm:p-4 rounded-xl border flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Search Box */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Buscar categoria por nome, slug ou descrição..."
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

          {/* Quick Status Filter Tabs */}
          <div
            className="inline-flex p-1 rounded-lg border self-start md:self-auto"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
            }}
          >
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'all' ? 'font-semibold shadow-xs' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: statusFilter === 'all' ? 'var(--card)' : 'transparent',
                color: statusFilter === 'all' ? 'var(--foreground)' : 'var(--muted-foreground)',
                border: statusFilter === 'all' ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              Todas ({categories.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'active' ? 'font-semibold shadow-xs' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: statusFilter === 'active' ? 'var(--card)' : 'transparent',
                color: statusFilter === 'active' ? 'var(--success)' : 'var(--muted-foreground)',
                border: statusFilter === 'active' ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              Ativas ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'inactive' ? 'font-semibold shadow-xs' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: statusFilter === 'inactive' ? 'var(--card)' : 'transparent',
                color: statusFilter === 'inactive' ? 'var(--destructive)' : 'var(--muted-foreground)',
                border: statusFilter === 'inactive' ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              Inativas ({inactiveCount})
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          /* Skeletons */
          <div className="space-y-4">
            {/* Desktop skeleton */}
            <div
              className="hidden md:block rounded-xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="h-11 border-b" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }} />
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 border-b last:border-0 animate-pulse"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                  </div>
                  <div className="h-4 w-28 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-6 w-16 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile skeleton */}
            <div className="md:hidden space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border p-4 space-y-3 animate-pulse"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-5 w-14 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="h-3 w-48 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-9 w-full rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
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
              Não foi possível carregar as categorias.
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={() => fetchCategories()}
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
        ) : filteredCategories.length === 0 ? (
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
              {searchQuery || statusFilter !== 'all' ? (
                <Search className="w-7 h-7" />
              ) : (
                <FolderTree className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Nenhuma categoria encontrada'
                : 'Nenhuma categoria cadastrada'}
            </h3>

            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {searchQuery
                ? `Nenhum resultado corresponde à busca "${searchQuery}".`
                : statusFilter !== 'all'
                ? 'Não há categorias cadastradas com este filtro de status.'
                : 'Comece adicionando a primeira categoria para organizar seus produtos no catálogo.'}
            </p>

            {searchQuery || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
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
            ) : (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                <Plus className="w-4 h-4" />
                Nova categoria
              </button>
            )}
          </div>
        ) : (
          /* Categories List */
          <>
            {/* Desktop Table */}
            <div
              className="hidden md:block rounded-xl border overflow-hidden shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="overflow-x-auto">
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
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Slug no Catálogo</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Criação</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {filteredCategories.map((category) => (
                      <tr
                        key={category.id}
                        className="transition-colors hover:bg-muted/40"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {/* Name & Description */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center border shrink-0"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--primary)',
                              }}
                            >
                              <Folder className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-sm block truncate">
                                {category.name}
                              </span>
                              {category.description ? (
                                <span
                                  className="text-xs line-clamp-1 mt-0.5"
                                  style={{ color: 'var(--muted-foreground)' }}
                                  title={category.description}
                                >
                                  {category.description}
                                </span>
                              ) : (
                                <span
                                  className="text-xs italic mt-0.5 block"
                                  style={{ color: 'var(--muted-foreground)' }}
                                >
                                  Sem descrição
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Slug */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <code
                              className="text-xs font-mono px-2 py-1 rounded border"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            >
                              /catalog/{category.slug}
                            </code>
                            <Link
                              to="/catalogo"
                              search={{ categoria: category.slug }}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver produtos desta categoria no catálogo público"
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: category.is_active
                                ? 'rgba(22, 163, 74, 0.12)'
                                : 'rgba(220, 38, 38, 0.1)',
                              borderColor: category.is_active
                                ? 'rgba(22, 163, 74, 0.25)'
                                : 'rgba(220, 38, 38, 0.25)',
                              color: category.is_active
                                ? 'var(--success)'
                                : 'var(--destructive)',
                            }}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                category.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                              }`}
                            />
                            {category.is_active ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(category.created_at)}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(category)}
                              aria-label={`Editar categoria ${category.name}`}
                              title="Editar categoria"
                              className="p-2 rounded-lg border transition-all hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(category)}
                              disabled={togglingId === category.id}
                              aria-label={category.is_active ? 'Desativar categoria' : 'Ativar categoria'}
                              title={category.is_active ? 'Desativar categoria' : 'Ativar categoria'}
                              className="p-2 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: category.is_active ? 'var(--warning)' : 'var(--success)',
                              }}
                            >
                              {togglingId === category.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : category.is_active ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              onClick={() => handleOpenDelete(category)}
                              aria-label={`Excluir categoria ${category.name}`}
                              title="Excluir categoria"
                              className="p-2 rounded-lg border transition-all hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--destructive)',
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-xl border p-4 space-y-3 shadow-xs"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: 'var(--primary)',
                        }}
                      >
                        <Folder className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm leading-tight truncate" style={{ color: 'var(--foreground)' }}>
                          {category.name}
                        </h3>
                        <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          /catalog/{category.slug}
                        </p>
                      </div>
                    </div>

                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 border"
                      style={{
                        backgroundColor: category.is_active
                          ? 'rgba(22, 163, 74, 0.12)'
                          : 'rgba(220, 38, 38, 0.1)',
                        borderColor: category.is_active
                          ? 'rgba(22, 163, 74, 0.25)'
                          : 'rgba(220, 38, 38, 0.25)',
                        color: category.is_active ? 'var(--success)' : 'var(--destructive)',
                      }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          category.is_active ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      {category.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  {category.description && (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                      {category.description}
                    </p>
                  )}

                  <div
                    className="flex items-center justify-between pt-2 border-t text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  >
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(category.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(category)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleToggleStatus(category)}
                        disabled={togglingId === category.id}
                        aria-label={category.is_active ? 'Desativar' : 'Ativar'}
                        title={category.is_active ? 'Desativar' : 'Ativar'}
                        className="p-1.5 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: category.is_active ? 'var(--warning)' : 'var(--success)',
                        }}
                      >
                        {togglingId === category.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : category.is_active ? (
                          <PowerOff className="w-3.5 h-3.5" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenDelete(category)}
                        aria-label="Excluir"
                        title="Excluir"
                        className="p-1.5 rounded-lg border transition-all hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: 'var(--destructive)',
                        }}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="sm:max-w-lg"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center border"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                }}
              >
                <Folder className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
            </div>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
              {editingCategory
                ? 'Atualize as informações da categoria.'
                : 'Preencha os campos abaixo para cadastrar uma nova categoria.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4 py-2"
          >
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Nome da Categoria <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Caixas de Hambúrguer"
                disabled={saving}
                className="transition-all"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: formErrors.name ? 'var(--destructive)' : 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              {formErrors.name && (
                <p className="text-xs font-medium flex items-center gap-1 mt-1" style={{ color: 'var(--destructive)' }}>
                  <AlertCircle className="w-3 h-3" />
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="slug" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Slug / URL amigável <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-mono px-2.5 py-2 rounded-lg border select-none shrink-0"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  /catalog/
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="caixas-de-hamburguer"
                  disabled={saving}
                  className="flex-1 font-mono text-xs transition-all"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.slug ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              {formErrors.slug && (
                <p className="text-xs font-medium flex items-center gap-1 mt-1" style={{ color: 'var(--destructive)' }}>
                  <AlertCircle className="w-3 h-3" />
                  {formErrors.slug}
                </p>
              )}
              <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                Identificador único utilizado na URL dos produtos.
              </p>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Descrição (Opcional)
              </Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição da categoria ou orientações de uso..."
                rows={3}
                disabled={saving}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Status Switch */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
              }}
            >
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Status da Categoria
                </p>
                <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formData.is_active
                    ? 'Visível para os clientes na navegação da loja'
                    : 'Oculta na listagem pública do catálogo'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                disabled={saving}
                aria-label="Alternar status ativo da categoria"
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                style={{
                  backgroundColor: formData.is_active ? 'var(--success)' : 'var(--muted)',
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50"
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
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando categoria...</span>
                  </>
                ) : editingCategory ? (
                  'Salvar alterações'
                ) : (
                  'Criar categoria'
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: hasProducts
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(220, 38, 38, 0.15)',
                  color: hasProducts ? 'var(--warning)' : 'var(--destructive)',
                }}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                {hasProducts ? 'Não é possível excluir' : 'Excluir categoria'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3">
            {checkingProducts ? (
              <div className="flex items-center gap-2 py-4 justify-center" style={{ color: 'var(--muted-foreground)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Verificando vínculos da categoria...</span>
              </div>
            ) : hasProducts ? (
              <div
                className="p-3.5 rounded-xl border text-sm space-y-2"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  Esta categoria possui produtos vinculados e não pode ser excluída.
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  A categoria <strong>{categoryToDelete?.name}</strong> possui um ou mais produtos cadastrados.
                  Para excluí-la, transfira ou remova esses produtos primeiro.
                </p>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                Tem certeza que deseja excluir a categoria <strong>{categoryToDelete?.name}</strong>?
                Esta ação é irreversível e removerá permanentemente o registro.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:opacity-80"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              {hasProducts ? 'Entendi' : 'Cancelar'}
            </button>

            {!hasProducts && !checkingProducts && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--destructive)',
                  color: '#ffffff',
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  'Excluir categoria'
                )}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
