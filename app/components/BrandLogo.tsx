'use client';

import { useState } from 'react';
import { getActiveBrandLogo } from '../lib/brandConfig';

interface BrandLogoProps {
  src?: string;
  className?: string;
  imgClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'custom';
  variant?: 'light' | 'dark' | 'glass' | 'white' | 'auto';
  alt?: string;
  showFallbackBadge?: boolean;
}

const SIZE_MAP = {
  xs: 'h-6 max-w-[110px]',
  sm: 'h-8 max-w-[140px]',
  md: 'h-10 max-w-[170px]',
  lg: 'h-14 max-w-[220px]',
  xl: 'h-18 max-w-[260px]',
  hero: 'h-24 max-w-[320px]',
  custom: '',
};

export default function BrandLogo({
  src,
  className = '',
  imgClassName = '',
  size = 'md',
  variant = 'auto',
  alt = 'RIV Margarita Premier',
  showFallbackBadge = true,
}: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);
  const activeLogo = src || getActiveBrandLogo();

  // Si falló la carga del SVG o imagen, renderizar el Badge de lujo de contingencia
  if (hasError && showFallbackBadge) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-xs select-none transition-all ${
          variant === 'light' || variant === 'glass'
            ? 'bg-white/15 border-white/30 text-white backdrop-blur-md'
            : 'bg-[#800020] border-[#D4AF37]/50 text-white'
        } ${className}`}
        title="RIV Margarita Premier"
      >
        <span className="text-[#D4AF37] text-xs leading-none">✦</span>
        <span className="text-[11px] font-extrabold tracking-wider uppercase font-inter leading-none">
          RIV MARGARITA PREMIER
        </span>
      </div>
    );
  }

  const containerSizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={`inline-flex items-center justify-center relative select-none ${containerSizeClass} ${className}`}
    >
      <img
        src={activeLogo}
        alt={alt}
        onError={() => setHasError(true)}
        className={`w-full h-full object-contain max-h-full transition-opacity duration-300 drop-shadow-xs ${imgClassName}`}
        loading="eager"
      />
    </div>
  );
}
