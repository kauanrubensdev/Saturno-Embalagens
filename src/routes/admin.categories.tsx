import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export const Route = createFileRoute('/admin/categories')({
  beforeLoad: async ({ context }) => {
    const { user, profile } = context as {
      user?: { id: string } | null;
      profile?: { role: 'customer' | 'admin' } | null;
    };
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (profile?.role !== 'admin') {
      throw redirect({ to: '/account' });
    }
  },
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [hasProducts, setHasProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;

      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Erro ao carregar categorias. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(query) ||
        cat.slug.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

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
      errors.name = 'Nome é obrigatório';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug é obrigatório';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors.slug = 'Slug inválido. Use apenas letras minúsculas, números e hífens.';
    }

    const existingSlug = categories.find(
      (c) => c.slug === formData.slug && c.id !== editingCategory?.id
    );
    if (existingSlug) {
      errors.slug = 'Já existe uma categoria com este slug';
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
            toast.error('Já existe uma categoria com este slug.');
            return;
          }
          throw insertError;
        }

        toast.success('Categoria criada com sucesso!');
      }

      setIsDialogOpen(false);
      fetchCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      toast.error('Erro ao salvar categoria. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (updateError) throw updateError;

      toast.success(
        category.is_active
          ? 'Categoria desativada com sucesso!'
          : 'Categoria ativada com sucesso!'
      );
      fetchCategories();
    } catch (err) {
      console.error('Error toggling category status:', err);
      toast.error('Erro ao alterar status. Tente novamente.');
    }
  };

  const handleOpenDelete = async (category: Category) => {
    setCategoryToDelete(category);

    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', category.id)
        .limit(1);

      if (productsError) throw productsError;

      setHasProducts(products && products.length > 0);
    } catch (err) {
      console.error('Error checking products:', err);
      setHasProducts(false);
    }

    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    if (hasProducts) {
      setIsDeleteDialogOpen(false);
      toast.error('Não é possível excluir esta categoria. existem produtos associados a ela.');
      return;
    }

    try {
      setDeleting(true);

      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryToDelete.id);

      if (deleteError) throw deleteError;

      toast.success('Categoria excluída com sucesso!');
      setIsDeleteDialogOpen(false);
      fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Erro ao excluir categoria. Tente novamente.');
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
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Categorias
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie as categorias de produtos da sua loja.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nova categoria
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--muted-foreground)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Buscar categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{ backgroundColor: 'var(--muted)' }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="p-6 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <svg
              className="w-12 h-12 mx-auto mb-3"
              style={{ color: 'var(--destructive)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              {error}
            </p>
            <button
              onClick={fetchCategories}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div
            className="p-12 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <svg
              className="w-16 h-16 mx-auto mb-4"
              style={{ color: 'var(--muted-foreground)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {searchQuery ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {searchQuery
                ? 'Tente buscar com outros termos.'
                : 'Comece adicionando a primeira categoria da sua loja.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova categoria
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--muted)' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Slug
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--card)' }}>
                  {filteredCategories.map((category, index) => (
                    <tr
                      key={category.id}
                      style={{
                        borderTop: index > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                          {category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <code
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          /catalog/{category.slug}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: category.is_active
                              ? 'rgba(22, 163, 74, 0.1)'
                              : 'rgba(220, 38, 38, 0.1)',
                            color: category.is_active
                              ? 'var(--success)'
                              : 'var(--destructive)',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: category.is_active
                                ? 'var(--success)'
                                : 'var(--destructive)',
                            }}
                          />
                          {category.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(category)}
                            className="p-2 rounded-lg transition-colors hover:opacity-80"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(category)}
                            className="p-2 rounded-lg transition-colors hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--muted)',
                              color: category.is_active ? 'var(--warning)' : 'var(--success)',
                            }}
                            title={category.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {category.is_active ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenDelete(category)}
                            className="p-2 rounded-lg transition-colors hover:opacity-80"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)' }}
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {category.name}
                      </h3>
                      <code
                        className="text-xs mt-1 inline-block"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        /catalog/{category.slug}
                      </code>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: category.is_active
                          ? 'rgba(22, 163, 74, 0.1)'
                          : 'rgba(220, 38, 38, 0.1)',
                        color: category.is_active ? 'var(--success)' : 'var(--destructive)',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: category.is_active ? 'var(--success)' : 'var(--destructive)',
                        }}
                      />
                      {category.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(category)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleStatus(category)}
                      className="px-3 py-2 rounded-lg transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--muted)',
                        color: category.is_active ? 'var(--warning)' : 'var(--success)',
                      }}
                      title={category.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {category.is_active ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenDelete(category)}
                      className="px-3 py-2 rounded-lg transition-colors hover:opacity-80"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)' }}
                      title="Excluir"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
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
          className="sm:max-w-md"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: 'var(--foreground)' }}>
                Nome <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Caixas de Hambúrguer"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: formErrors.name ? 'var(--destructive)' : 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              {formErrors.name && (
                <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                  {formErrors.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug" style={{ color: 'var(--foreground)' }}>
                Slug <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  /catalog/
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="caixas-de-hamburguer"
                  className="flex-1 font-mono text-sm"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.slug ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              {formErrors.slug && (
                <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                  {formErrors.slug}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" style={{ color: 'var(--foreground)' }}>
                Descrição
              </Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional da categoria"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
            {editingCategory && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{ backgroundColor: formData.is_active ? 'var(--success)' : 'var(--muted)' }}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                  Categoria {formData.is_active ? 'ativa' : 'inativa'}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {saving ? 'Salvando...' : editingCategory ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              {hasProducts ? 'Não é possível excluir' : 'Excluir categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {hasProducts ? (
              <p style={{ color: 'var(--foreground)' }}>
                Não é possível excluir a categoria <strong>{categoryToDelete?.name}</strong> porque existem produtos associados a ela.
              </p>
            ) : (
              <p style={{ color: 'var(--foreground)' }}>
                Tem certeza que deseja excluir a categoria <strong>{categoryToDelete?.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              {hasProducts ? 'Entendi' : 'Cancelar'}
            </button>
            {!hasProducts && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--destructive)' }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
