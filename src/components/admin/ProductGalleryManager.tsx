import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  UploadCloud,
  Plus,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Link2,
  Loader2,
  AlertCircle,
  FileImage,
  Sparkles,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ProductImageItem {
  id?: string;
  product_id?: string;
  image_url: string;
  storage_path?: string | null;
  sort_order: number;
  is_primary: boolean;
  isUploading?: boolean;
}

interface ProductGalleryManagerProps {
  productId?: string;
  images: ProductImageItem[];
  onChange: (images: ProductImageItem[]) => void;
  disabled?: boolean;
  onUploadStateChange?: (isUploading: boolean) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');
}

function getStoragePathFromUrl(url: string, bucket = 'product-images'): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    if (url.includes(marker)) {
      const parts = url.split(marker);
      if (parts[1]) {
        return decodeURIComponent(parts[1].split('?')[0]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function ProductGalleryManager({
  productId,
  images,
  onChange,
  disabled = false,
  onUploadStateChange,
}: ProductGalleryManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Dialog state for deleting an image
  const [imageToDelete, setImageToDelete] = useState<{ item: ProductImageItem; index: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setUploadState = (uploading: boolean) => {
    setIsUploading(uploading);
    onUploadStateChange?.(uploading);
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

    if (!isMimeValid && !isExtValid) {
      return { valid: false, error: 'Formato não suportado. Use JPG, PNG ou WEBP.' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'A imagem deve ter no máximo 5 MB.' };
    }

    return { valid: true };
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (disabled || isUploading) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    try {
      setUploadState(true);

      const newUploadedItems: ProductImageItem[] = [];
      let failureCount = 0;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const validation = validateFile(file);
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.error}`);
          failureCount++;
          continue;
        }

        const cleanName = sanitizeFileName(file.name);
        const folderId = productId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prod-${Date.now()}`);
        const filePath = `${folderId}/${Date.now()}-${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error(`[ProductGalleryManager] Erro no upload de ${file.name}:`, uploadError);
          toast.error(`Falha no upload de ${file.name}: ${uploadError.message}`);
          failureCount++;
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        newUploadedItems.push({
          image_url: publicUrl,
          storage_path: filePath,
          sort_order: images.length + newUploadedItems.length,
          is_primary: false,
        });
      }

      if (newUploadedItems.length > 0) {
        let updatedList = [...images, ...newUploadedItems];

        // Ensure at least one primary image
        const hasPrimary = updatedList.some((img) => img.is_primary);
        if (!hasPrimary && updatedList.length > 0) {
          updatedList = updatedList.map((img, idx) => ({
            ...img,
            is_primary: idx === 0,
            sort_order: idx,
          }));
        } else {
          updatedList = updatedList.map((img, idx) => ({
            ...img,
            sort_order: idx,
          }));
        }

        onChange(updatedList);
        toast.success(
          newUploadedItems.length === 1
            ? 'Imagem adicionada à galeria!'
            : `${newUploadedItems.length} imagens adicionadas à galeria!`
        );
      } else if (failureCount > 0) {
        toast.error('Nenhuma imagem pôde ser enviada. Verifique os erros e tente novamente.');
      }
    } catch (err) {
      console.error('[ProductGalleryManager] Erro inesperado no upload múltiplo:', err);
      toast.error('Erro ao enviar imagens para o Storage.');
    } finally {
      setUploadState(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const cleanUrl = urlInput.trim();

    const newItem: ProductImageItem = {
      image_url: cleanUrl,
      storage_path: getStoragePathFromUrl(cleanUrl),
      sort_order: images.length,
      is_primary: images.length === 0,
    };

    const updated = [...images, newItem].map((img, idx) => ({
      ...img,
      sort_order: idx,
      is_primary: images.length === 0 ? idx === 0 : img.is_primary,
    }));

    onChange(updated);
    setUrlInput('');
    setShowUrlInput(false);
    toast.success('Imagem via URL adicionada!');
  };

  const handleSetPrimary = (index: number) => {
    if (disabled || isUploading) return;
    const updated = images.map((img, idx) => ({
      ...img,
      is_primary: idx === index,
    }));
    onChange(updated);
    toast.success('Imagem definida como principal!');
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (disabled || isUploading) return;
    if (toIndex < 0 || toIndex >= images.length) return;

    const list = [...images];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    const reindexed = list.map((item, idx) => ({
      ...item,
      sort_order: idx,
    }));

    onChange(reindexed);
  };

  const confirmDeleteImage = async () => {
    if (!imageToDelete) return;
    const { item, index } = imageToDelete;

    const remaining = images.filter((_, idx) => idx !== index);

    // If the removed image was primary, make the first remaining image primary
    let updated: ProductImageItem[] = [];
    if (item.is_primary && remaining.length > 0) {
      updated = remaining.map((img, idx) => ({
        ...img,
        sort_order: idx,
        is_primary: idx === 0,
      }));
    } else {
      updated = remaining.map((img, idx) => ({
        ...img,
        sort_order: idx,
      }));
    }

    onChange(updated);
    setImageToDelete(null);
    toast.success('Imagem removida da galeria.');

    // Attempt deleting from storage in background if it belongs to product-images
    const storagePath = item.storage_path || getStoragePathFromUrl(item.image_url);
    if (storagePath) {
      try {
        await supabase.storage.from('product-images').remove([storagePath]);
      } catch (delErr) {
        console.warn('[ProductGalleryManager] Non-blocking storage delete error:', delErr);
      }
    }
  };

  // Drag and Drop handlers for gallery cards
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled || isUploading) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCard = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null || draggedIndex === index) return;
    handleMove(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Drag and drop for outer dropzone
  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDraggingOver(true);
    }
  };

  const handleZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const triggerPicker = () => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Hidden Multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesUpload(e.target.files);
          }
        }}
      />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">
              Galeria de Imagens do Produto
            </label>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Adicione várias fotos. A primeira ou com estrela será a foto principal no catálogo e na loja.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={triggerPicker}
            disabled={disabled || isUploading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar imagens</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowUrlInput((prev) => !prev)}
            disabled={disabled || isUploading}
            className="px-3 py-2 rounded-xl text-xs font-medium border transition-all hover:bg-muted text-foreground cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            style={{ borderColor: 'var(--border)' }}
            title="Adicionar por link/URL"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Usar URL</span>
          </button>
        </div>
      </div>

      {/* Optional URL Input drawer */}
      {showUrlInput && (
        <div
          className="p-3 rounded-2xl border bg-muted/20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              disabled={disabled || isUploading}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddUrl();
                }
              }}
              placeholder="Cole a URL da imagem (https://.../foto.jpg)"
              className="flex-1 h-9 px-3 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={disabled || isUploading || !urlInput.trim()}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUrlInput('');
                setShowUrlInput(false);
              }}
              className="h-9 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground border transition-colors cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Gallery Grid or Empty Dropzone */}
      {images.length > 0 ? (
        <div
          onDragOver={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          className={`relative p-3.5 rounded-2xl border transition-all ${
            isDraggingOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'bg-muted/15'
          }`}
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Active Gallery Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, index) => {
              const isPrimary = img.is_primary || (index === 0 && !images.some((i) => i.is_primary));

              return (
                <div
                  key={img.id || `${img.image_url}-${index}`}
                  draggable={!disabled && !isUploading}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOverCard(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group relative rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between bg-card select-none ${
                    isPrimary
                      ? 'ring-2 ring-amber-500 border-amber-500 shadow-md scale-[1.01]'
                      : 'hover:border-primary/50 shadow-xs'
                  } ${draggedIndex === index ? 'opacity-40 scale-95' : ''}`}
                  style={{ borderColor: isPrimary ? '#f59e0b' : 'var(--border)' }}
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-square w-full bg-background overflow-hidden flex items-center justify-center">
                    <img
                      src={img.image_url}
                      alt={`Imagem ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.opacity = '0.3';
                      }}
                    />

                    {/* Primary Badge */}
                    {isPrimary && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 text-white font-bold text-[10px] shadow-sm tracking-wide uppercase">
                        <Star className="w-3 h-3 fill-white" />
                        <span>Principal</span>
                      </div>
                    )}

                    {/* Drag Handle Indicator */}
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-black/60 text-white cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Position Number Pill */}
                    <div className="absolute bottom-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-black/60 text-white font-mono text-[10px] font-bold">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Card Controls Bar */}
                  <div className="p-2 border-t flex items-center justify-between gap-1 bg-muted/40" style={{ borderColor: 'var(--border)' }}>
                    {/* Move Left / Right */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMove(index, index - 1)}
                        disabled={disabled || isUploading || index === 0}
                        title="Mover para a esquerda"
                        className="p-1 rounded-lg border bg-background hover:bg-muted text-foreground transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, index + 1)}
                        disabled={disabled || isUploading || index === images.length - 1}
                        title="Mover para a direita"
                        className="p-1 rounded-lg border bg-background hover:bg-muted text-foreground transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Set Primary Button */}
                    {!isPrimary ? (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        disabled={disabled || isUploading}
                        title="Definir como foto principal"
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold border bg-background hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground transition-all flex items-center gap-1 cursor-pointer"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <Star className="w-3 h-3" />
                        <span className="hidden sm:inline">Principal</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 px-1">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span className="hidden sm:inline">Capa</span>
                      </span>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setImageToDelete({ item: img, index })}
                      disabled={disabled || isUploading}
                      title="Excluir imagem"
                      className="p-1 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Quick Add More Tile */}
            <div
              onClick={triggerPicker}
              className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
            >
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-foreground">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold">Adicionar mais</span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State Dropzone */
        <div
          onDragOver={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          onClick={triggerPicker}
          className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
            isDraggingOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/50 hover:bg-muted/30'
          } ${disabled || isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          style={{
            borderColor: isDraggingOver ? 'var(--primary)' : 'var(--border)',
            backgroundColor: isDraggingOver ? 'var(--accent)' : 'var(--card)',
          }}
        >
          {isUploading ? (
            <div className="py-4 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">Enviando imagens...</p>
            </div>
          ) : (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: 'var(--muted)',
                  color: 'var(--primary)',
                }}
              >
                <UploadCloud className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  Envie as imagens do produto
                </p>
                <p className="text-xs text-muted-foreground">
                  Arraste e solte fotos aqui ou clique para selecionar do computador/celular
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerPicker();
                }}
                disabled={disabled || isUploading}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-98 cursor-pointer flex items-center gap-2"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <FileImage className="w-4 h-4" />
                <span>Selecionar fotos</span>
              </button>

              <div className="pt-1">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium text-muted-foreground bg-muted/60 border border-border">
                  JPG, PNG ou WEBP • até 5 MB por foto
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Image Removal */}
      <AlertDialog
        open={Boolean(imageToDelete)}
        onOpenChange={(open) => {
          if (!open) setImageToDelete(null);
        }}
      >
        <AlertDialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remover esta imagem?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              A imagem será excluída da galeria deste produto. Se esta for a foto principal, a primeira imagem restante se tornará a nova foto de capa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setImageToDelete(null)}
              className="cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteImage}
              className="cursor-pointer text-white"
              style={{ backgroundColor: 'var(--destructive)' }}
            >
              Remover imagem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
