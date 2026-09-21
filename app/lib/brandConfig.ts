// =============================================================================
// BRANDING CONFIGURATION - RIV MARGARITA PREMIER
// =============================================================================

export const DEFAULT_BRAND_LOGO = '/logo-riv.svg';
export const ALT_BRAND_LOGO = '/LOGO RIV MARGARITA PREMIER.svg';

export const BRAND_COLORS = {
  primary: '#800020',       // Vinotinto RIV
  primaryLight: '#990026',  // Vinotinto suave
  primaryDark: '#4a0012',   // Vinotinto profundo
  gold: '#D4AF37',          // Dorado Premier
  goldLight: '#FFF2B2',     // Dorado brillo
  dark: '#111827',          // Fondo oscuro
  muted: '#6B7280',
};

export const BRAND_NAME = 'RIV Margarita Premier';
export const BRAND_TAGLINE = 'Sistema de Gestión Inmobiliaria';

export const appConfig = {
  brandLogoUrl: DEFAULT_BRAND_LOGO,
  brandName: BRAND_NAME,
  brandColors: BRAND_COLORS,
};

export const DEFAULT_BRAND_CONFIG = appConfig;

const LOGO_STORAGE_KEY = 'riv_custom_agency_logo';

/**
 * Obtiene la URL del logotipo activo:
 * 1. Logotipo personalizado del perfil de usuario/franquicia (si existe)
 * 2. Logotipo guardado en localStorage
 * 3. Logotipo oficial predeterminado (LOGO RIV MARGARITA PREMIER.svg)
 */
export function getActiveBrandLogo(userAgencyLogo?: string | null): string {
  if (userAgencyLogo && userAgencyLogo.trim()) {
    return userAgencyLogo.trim();
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOGO_STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch {
      // ignore localStorage restriction
    }
  }
  return DEFAULT_BRAND_LOGO;
}

/**
 * Permite actualizar y persistir un logo personalizado para la franquicia/asesor
 */
export function setCustomBrandLogo(logoUrlOrBase64: string): void {
  if (typeof window !== 'undefined') {
    try {
      if (logoUrlOrBase64) {
        localStorage.setItem(LOGO_STORAGE_KEY, logoUrlOrBase64);
      } else {
        localStorage.removeItem(LOGO_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('No se pudo guardar el logo personalizado en almacenamiento local:', e);
    }
  }
}
