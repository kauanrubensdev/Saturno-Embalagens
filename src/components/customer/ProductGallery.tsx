import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Package,
  Sparkles,
  Maximize2,
} from 'lucide-react';

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);

  // Normalize image list (remove empty/null strings)
  const validImages = images.filter((img) => Boolean(img && img.trim()));

  // Reset index when images list changes
  useEffect(() => {
    setSelectedIndex(0);
    setHasError(false);
  }, [images]);

  const currentImage = validImages[selectedIndex] || validImages[0] || '';

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setHasError(false);
  };

  const handlePrev = () => {
    if (validImages.length <= 1) return;
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
    setHasError(false);
  };

  const handleNext = () => {
    if (validImages.length <= 1) return;
    setSelectedIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
    setHasError(false);
  };

  const scrollThumbnails = (direction: 'up' | 'down') => {
    if (thumbnailsContainerRef.current) {
      const scrollAmount = direction === 'up' ? -180 : 180;
      thumbnailsContainerRef.current.scrollBy({
        top: scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // If no images are available
  if (validImages.length === 0) {
    return (
      <div
        className="rounded-3xl border flex flex-col items-center justify-center p-12 text-center aspect-square sm:min-h-[440px] shadow-xs"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 shadow-inner"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <Package className="w-10 h-10 opacity-60" />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {productName}
        </p>
        <span className="text-xs text-muted-foreground mt-1">
          Foto ilustrativa em breve
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-3 sm:gap-4 select-none">
      {/* ── DESKTOP THUMBNAILS COLUMN (Shopee style on Left) ── */}
      {validImages.length > 1 && (
        <div className="hidden md:flex flex-col items-center justify-between w-20 shrink-0 gap-1.5">
          {/* Scroll Up button if many images */}
          {validImages.length > 4 && (
            <button
              type="button"
              onClick={() => scrollThumbnails('up')}
              aria-label="Rolar miniaturas para cima"
              className="w-full py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}

          {/* Vertical Thumbnail List */}
          <div
            ref={thumbnailsContainerRef}
            className="flex flex-col gap-2.5 max-h-[440px] overflow-y-auto scrollbar-none py-1 w-full"
            style={{ scrollBehavior: 'smooth' }}
          >
            {validImages.map((img, idx) => {
              const isSelected = selectedIndex === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onMouseEnter={() => handleSelect(idx)}
                  onClick={() => handleSelect(idx)}
                  aria-label={`Ver imagem ${idx + 1} de ${validImages.length}`}
                  className={`group relative w-18 h-18 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer shrink-0 bg-card ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-md scale-102'
                      : 'border-border hover:border-primary/50 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${productName} miniatura ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Scroll Down button if many images */}
          {validImages.length > 4 && (
            <button
              type="button"
              onClick={() => scrollThumbnails('down')}
              aria-label="Rolar miniaturas para baixo"
              className="w-full py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ── MAIN LARGE IMAGE CONTAINER ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div
          className="group relative rounded-3xl overflow-hidden border aspect-square sm:aspect-auto sm:min-h-[420px] md:min-h-[460px] flex items-center justify-center bg-card shadow-xs transition-all duration-300"
          style={{ borderColor: 'var(--border)' }}
        >
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Package className="w-16 h-16 mb-2 opacity-50" />
              <span className="text-xs">Não foi possível carregar a imagem</span>
            </div>
          ) : (
            <img
              key={currentImage}
              src={currentImage}
              alt={`${productName} - Imagem ${selectedIndex + 1}`}
              onError={() => setHasError(true)}
              className="w-full h-full object-contain sm:object-cover max-h-[500px] md:max-h-[540px] transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )}

          {/* Navigation Arrows for Main Image */}
          {validImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                aria-label="Imagem anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-md cursor-pointer hover:scale-105"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                aria-label="Próxima imagem"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-md cursor-pointer hover:scale-105"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Counter Badge */}
              <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-[11px] font-mono font-semibold shadow-xs">
                {selectedIndex + 1} / {validImages.length}
              </div>
            </>
          )}
        </div>

        {/* ── MOBILE / TABLET THUMBNAIL ROW (Underneath main image) ── */}
        {validImages.length > 1 && (
          <div className="flex md:hidden gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
            {validImages.map((img, idx) => {
              const isSelected = selectedIndex === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  aria-label={`Ver imagem ${idx + 1}`}
                  className={`snap-start relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer shrink-0 bg-card ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-sm scale-102'
                      : 'border-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${productName} ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
