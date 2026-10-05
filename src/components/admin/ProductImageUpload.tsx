import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  UploadCloud,
  Image as ImageIcon,
  Link2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileImage,
  ExternalLink,
} from 'lucide-react';

interface ProductImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  productId?: string;
  disabled?: boolean;
  onUploadStateChange?: (isUploading: boolean) => void;
}

interface ImageMetadata {
  name: string;
  sizeFormatted: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} ${sizes[i]}`;
}

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

function extractFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart) || 'imagem-produto';
  } catch {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1] || 'imagem-produto';
  }
}

export function ProductImageUpload({
  value,
  onChange,
  productId,
  disabled = false,
  onUploadStateChange,
}: ProductImageUploadProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [previewError, setPreviewError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync upload state with parent
  const setUploadState = (uploading: boolean) => {
    setIsUploading(uploading);
    onUploadStateChange?.(uploading);
  };

  // If value changes from outside or has existing image, populate metadata
  useEffect(() => {
    setPreviewError(false);
    if (value && !metadata) {
      const fileName = extractFileNameFromUrl(value);
      setMetadata({
        name: fileName,
        sizeFormatted: '',
      });
    } else if (!value) {
      setMetadata(null);
    }
  }, [value]);

  const validateFile = (file: File): boolean => {
    // Check MIME type
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
    // Check file extension as fallback
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

    if (!isMimeValid && !isExtValid) {
      toast.error('Formato não suportado. Use JPG, PNG ou WEBP.');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('A imagem deve ter no máximo 5 MB.');
      return false;
    }

    return true;
  };

  const handleFileUpload = async (file: File) => {
    if (!validateFile(file)) return;

    try {
      setUploadState(true);
      const oldImageUrl = value;
      const cleanName = sanitizeFileName(file.name);
      const folderId = productId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prod-${Date.now()}`);
      const filePath = `${folderId}/${Date.now()}-${cleanName}`;

      // Get current user and profile for diagnostics
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      let userRole = 'unknown';
      if (currentUser?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle();
        userRole = profile?.role || 'none';
      }

      console.log('[ProductImageUpload] Iniciando upload:', {
        bucket: 'product-images',
        filePath,
        authenticated: Boolean(currentUser),
        userId: currentUser?.id || null,
        userRole,
        fileSize: file.size,
        fileType: file.type,
      });

      // Upload directly to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[ProductImageUpload] Erro completo retornado pelo Supabase Storage:', {
          bucket: 'product-images',
          filePath,
          resultado: 'falha',
          statusUsuario: {
            autenticado: Boolean(currentUser),
            userId: currentUser?.id || null,
            role: userRole,
          },
          erroCompleto: uploadError,
          mensagem: uploadError.message,
          nome: uploadError.name,
        });

        const detailMsg = uploadError.message ? ` (${uploadError.message})` : '';
        toast.error(`Não foi possível enviar a imagem${detailMsg}. Tente novamente.`);
        return;
      }

      console.log('[ProductImageUpload] Upload realizado com sucesso:', {
        bucket: 'product-images',
        filePath,
        resultado: 'sucesso',
        uploadData,
      });

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Update state
      setMetadata({
        name: file.name,
        sizeFormatted: formatFileSize(file.size),
      });
      setPreviewError(false);
      onChange(publicUrl);
      toast.success('Imagem enviada com sucesso!');

      // Attempt cleaning up previous image from product-images bucket if it was replaced
      if (oldImageUrl && oldImageUrl !== publicUrl) {
        const oldStoragePath = getStoragePathFromUrl(oldImageUrl, 'product-images');
        if (oldStoragePath) {
          try {
            await supabase.storage.from('product-images').remove([oldStoragePath]);
          } catch (delErr) {
            console.warn('Non-blocking error deleting previous image:', delErr);
          }
        }
      }
    } catch (err) {
      console.error('Error in handleFileUpload:', err);
      toast.error('Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setUploadState(false);
      // Reset file input value so selecting the same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleRemoveImage = () => {
    if (disabled || isUploading) return;
    onChange('');
    setMetadata(null);
    setPreviewError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFilePicker = () => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  };

  const hasImage = Boolean(value && value.trim());

  return (
    <div className="space-y-3">
      {/* Header with Mode Selection */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
          Imagem do Produto
        </label>
        <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-muted/40 text-xs" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            disabled={disabled || isUploading}
            className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Enviar Imagem</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            disabled={disabled || isUploading}
            className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'url'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Usar URL</span>
          </button>
        </div>
      </div>

      {/* Hidden File Input for Native File/Camera Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      {/* Upload Mode UI */}
      {activeTab === 'upload' && (
        <>
          {hasImage ? (
            /* Selected / Uploaded Image Preview Box */
            <div
              className="relative p-4 rounded-2xl border transition-all"
              style={{
                backgroundColor: 'var(--muted)',
                borderColor: 'var(--border)',
              }}
            >
              {isUploading ? (
                /* Loading State during Upload */
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Enviando imagem...</p>
                    <p className="text-xs text-muted-foreground">Salvando no Supabase Storage com segurança</p>
                  </div>
                </div>
              ) : (
                /* Active Preview with File Details */
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Image Thumbnail */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden border bg-background flex items-center justify-center shadow-xs" style={{ borderColor: 'var(--border)' }}>
                    {previewError ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center text-destructive">
                        <AlertCircle className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-medium leading-tight">Erro ao carregar</span>
                      </div>
                    ) : (
                      <img
                        src={value}
                        alt="Preview do produto"
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        onError={() => setPreviewError(true)}
                      />
                    )}
                  </div>

                  {/* Metadata and Actions */}
                  <div className="flex-1 w-full flex flex-col justify-between gap-3 text-center sm:text-left">
                    <div>
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate max-w-[220px] sm:max-w-[280px]" title={metadata?.name || 'Imagem selecionada'}>
                          {metadata?.name || 'Imagem do produto'}
                        </span>
                      </div>
                      {metadata?.sizeFormatted && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {metadata.sizeFormatted}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-[280px]">
                        URL: {value}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        type="button"
                        onClick={triggerFilePicker}
                        disabled={disabled || isUploading}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-background hover:bg-muted text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Trocar imagem</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={disabled || isUploading}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-destructive/30 hover:bg-destructive/10 text-destructive transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload Dropzone Box */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFilePicker}
              className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'hover:border-primary/50 hover:bg-muted/30'
              } ${disabled || isUploading ? 'opacity-50 pointer-events-none' : ''}`}
              style={{
                borderColor: isDragging ? 'var(--primary)' : 'var(--border)',
                backgroundColor: isDragging ? 'var(--accent)' : 'var(--card)',
              }}
            >
              {isUploading ? (
                <div className="py-4 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-semibold text-foreground">Enviando imagem...</p>
                </div>
              ) : (
                <>
                  {/* Camera / Upload Icon */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: 'var(--muted)',
                      color: 'var(--primary)',
                    }}
                  >
                    <UploadCloud className="w-7 h-7" />
                  </div>

                  {/* Title & Instructions */}
                  <div className="space-y-1">
                    <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                      Envie uma imagem do produto
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Arraste e solte aqui ou clique para selecionar do seu dispositivo
                    </p>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFilePicker();
                    }}
                    disabled={disabled || isUploading}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-98 cursor-pointer flex items-center gap-2"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <FileImage className="w-4 h-4" />
                    <span>Selecionar imagem</span>
                  </button>

                  {/* Format & Size Badge */}
                  <div className="pt-1">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium text-muted-foreground bg-muted/60 border border-border">
                      JPG, PNG ou WEBP • até 5 MB
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Manual URL Mode UI */}
      {activeTab === 'url' && (
        <div className="space-y-2.5 p-3.5 rounded-2xl border bg-muted/20" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <input
              id="product_image_url_input"
              type="url"
              value={value}
              disabled={disabled || isUploading}
              onChange={(e) => {
                const newUrl = e.target.value;
                onChange(newUrl);
                if (newUrl) {
                  setMetadata({
                    name: extractFileNameFromUrl(newUrl),
                    sizeFormatted: '',
                  });
                } else {
                  setMetadata(null);
                }
              }}
              placeholder="https://exemplo.com/imagem-do-produto.jpg"
              className="flex-1 h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            {hasImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={disabled || isUploading}
                title="Limpar URL"
                className="h-10 px-3 rounded-xl border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Cole um link direto para a imagem na web (.jpg, .png, .webp).
          </p>

          {/* URL Preview */}
          {hasImage && (
            <div className="mt-2 flex items-center gap-3 p-2.5 rounded-xl border bg-background shadow-xs" style={{ borderColor: 'var(--border)' }}>
              <div className="w-12 h-12 rounded-lg overflow-hidden border bg-muted shrink-0 flex items-center justify-center" style={{ borderColor: 'var(--border)' }}>
                {previewError ? (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                ) : (
                  <img
                    src={value}
                    alt="Preview URL"
                    className="w-full h-full object-cover"
                    onError={() => setPreviewError(true)}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                  {previewError ? 'URL com erro ao carregar imagem' : 'Prévia da URL informada'}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {value}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
