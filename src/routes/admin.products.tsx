import { createFileRoute, redirect } from '@tanstack/react-router';
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
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
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
      setError('Erro ao carregar produtos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch =
        !searchQuery.trim() ||
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.sku && prod.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategoryFilter === 'all' || prod.category_id === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategoryFilter]);

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
      errors.stock_quantity = 'Estoque deve ser um número inteiro não negativo';
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
      await fetchData();
    } catch (err) {
      console.error('Error toggling product status:', err);
      toast.error('Erro ao alterar status do produto.');
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
        // Trata erro de constraint de chave estrangeira (ex: pedido com itens deste produto)
        if (deleteError.code === '23503') {
          toast.error('Não é possível excluir o produto pois ele possui vínculos no histórico (ex: pedidos/carrinho). Recomendamos desativá-lo.');
          return;
        }
        throw deleteError;
      }

      toast.success('Produto excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('Erro ao excluir produto. Tente novamente.');
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
              Produtos
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie o catálogo de produtos e estoque da sua loja.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar produto
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
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
              placeholder="Buscar por nome, SKU ou slug..."
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

          <div className="w-full sm:w-56">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <option value="all">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
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
              onClick={fetchData}
              className="text-sm font-medium hover:underline cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            className="p-12 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--muted-foreground)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {searchQuery || selectedCategoryFilter !== 'all'
                ? 'Nenhum produto encontrado'
                : 'Nenhum produto cadastrado'}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {searchQuery || selectedCategoryFilter !== 'all'
                ? 'Tente ajustar os filtros ou os termos de busca.'
                : 'Comece adicionando o primeiro produto da sua loja.'}
            </p>
            {!searchQuery && selectedCategoryFilter === 'all' && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Adicionar produto
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
                      Produto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Preço
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      Estoque
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
                  {filteredProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      style={{
                        borderTop: index > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              style={{ border: '1px solid var(--border)' }}
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
                            >
                              <svg className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>
                              {product.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {product.sku && <span>SKU: {product.sku}</span>}
                              <span>/{product.slug}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block text-xs px-2.5 py-1 rounded-md font-medium"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                        >
                          {product.category?.name || 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(product.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            product.stock_quantity === 0
                              ? 'text-red-500 bg-red-500/10'
                              : product.stock_quantity < 10
                              ? 'text-yellow-600 bg-yellow-500/10'
                              : 'text-emerald-600 bg-emerald-500/10'
                          }`}
                        >
                          {product.stock_quantity} un
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: product.is_active
                              ? 'rgba(22, 163, 74, 0.1)'
                              : 'rgba(220, 38, 38, 0.1)',
                            color: product.is_active
                              ? 'var(--success)'
                              : 'var(--destructive)',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: product.is_active
                                ? 'var(--success)'
                                : 'var(--destructive)',
                            }}
                          />
                          {product.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                            title="Editar produto"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(product)}
                            className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
                            style={{
                              backgroundColor: 'var(--muted)',
                              color: product.is_active ? 'var(--warning)' : 'var(--success)',
                            }}
                            title={product.is_active ? 'Desativar produto' : 'Ativar produto'}
                          >
                            {product.is_active ? (
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
                            onClick={() => handleOpenDelete(product)}
                            className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)' }}
                            title="Excluir produto"
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
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        style={{ border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
                      >
                        <svg className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                          {product.name}
                        </h3>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                          style={{
                            backgroundColor: product.is_active
                              ? 'rgba(22, 163, 74, 0.1)'
                              : 'rgba(220, 38, 38, 0.1)',
                            color: product.is_active ? 'var(--success)' : 'var(--destructive)',
                          }}
                        >
                          {product.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}>
                          {product.category?.name || 'Sem categoria'}
                        </span>
                        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          Estoque: {product.stock_quantity} un
                        </span>
                      </div>
                      <p className="text-sm font-semibold mt-1.5" style={{ color: 'var(--foreground)' }}>
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => handleOpenEdit(product)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleStatus(product)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--muted)',
                        color: product.is_active ? 'var(--warning)' : 'var(--success)',
                      }}
                    >
                      {product.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleOpenDelete(product)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--destructive)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="sm:max-w-xl max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              {editingProduct ? 'Editar produto' : 'Novo produto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name" style={{ color: 'var(--foreground)' }}>
                Nome do produto <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Caixa de Papelão 20x20x10"
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

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="slug" style={{ color: 'var(--foreground)' }}>
                Slug (URL) <span style={{ color: 'var(--destructive)' }}>*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  /product/
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="caixa-de-papelao-20x20x10"
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

            {/* Category and SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="category_id" style={{ color: 'var(--foreground)' }}>
                  Categoria <span style={{ color: 'var(--destructive)' }}>*</span>
                </Label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, category_id: e.target.value }));
                    if (formErrors.category_id) {
                      setFormErrors((prev) => ({ ...prev, category_id: '' }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
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
                  <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                    {formErrors.category_id}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku" style={{ color: 'var(--foreground)' }}>
                  SKU / Código
                </Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="Ex: CX-202010"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Price and Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price" style={{ color: 'var(--foreground)' }}>
                  Preço (R$) <span style={{ color: 'var(--destructive)' }}>*</span>
                </Label>
                <Input
                  id="price"
                  type="text"
                  value={formData.price}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, price: e.target.value }));
                    if (formErrors.price) {
                      setFormErrors((prev) => ({ ...prev, price: '' }));
                    }
                  }}
                  placeholder="Ex: 29.90"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.price ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                {formErrors.price && (
                  <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                    {formErrors.price}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock_quantity" style={{ color: 'var(--foreground)' }}>
                  Quantidade em Estoque <span style={{ color: 'var(--destructive)' }}>*</span>
                </Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, stock_quantity: e.target.value }));
                    if (formErrors.stock_quantity) {
                      setFormErrors((prev) => ({ ...prev, stock_quantity: '' }));
                    }
                  }}
                  placeholder="0"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: formErrors.stock_quantity ? 'var(--destructive)' : 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                {formErrors.stock_quantity && (
                  <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                    {formErrors.stock_quantity}
                  </p>
                )}
              </div>
            </div>

            {/* Image URL */}
            <div className="space-y-1.5">
              <Label htmlFor="image_url" style={{ color: 'var(--foreground)' }}>
                URL da Imagem
              </Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://exemplo.com/imagem-do-produto.jpg"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              {formData.image_url && (
                <div className="mt-2 flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--muted)' }}>
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Prévia da imagem
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" style={{ color: 'var(--foreground)' }}>
                Descrição do Produto
              </Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes, especificações e medidas do produto..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer"
                style={{ backgroundColor: formData.is_active ? 'var(--success)' : 'var(--muted)' }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Produto {formData.is_active ? 'ativo (visível na loja)' : 'inativo (oculto)'}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {saving ? 'Salvando...' : editingProduct ? 'Salvar alterações' : 'Criar produto'}
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
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Tem certeza que deseja excluir o produto{' '}
              <strong style={{ color: 'var(--foreground)' }}>
                {productToDelete?.name}
              </strong>
              ? Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
            >
              {deleting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {deleting ? 'Excluindo...' : 'Excluir produto'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
