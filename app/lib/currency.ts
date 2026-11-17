// =============================================================================
// UTILIDAD DE MONEDA — RIV MARGARITA PREMIER (es-VE)
// =============================================================================

export interface CurrencyFormatOptions {
  /** Mostrar símbolo de moneda '$' (default: true) */
  showCurrency?: boolean;
  /** Símbolo de moneda personalizado (default: '$') */
  currencySymbol?: string;
  /** Sufijo posterior, ej: ' USD' (default: '') */
  suffix?: string;
  /** Cantidad de decimales (default: 0) */
  decimals?: number;
}

/**
 * Formatea un número como moneda local (Venezuela / es-VE):
 * - Separador de miles: punto (.)
 * - Separador de decimales: coma (,)
 *
 * Ejemplos:
 *  formatPrice(105000) => "$105.000"
 *  formatPrice(105000, { showCurrency: false }) => "105.000"
 *  formatPrice(105000, { suffix: ' USD' }) => "$105.000 USD"
 *  formatPrice(105000.5, { decimals: 2 }) => "$105.000,50"
 */
export function formatPrice(
  amount: number | string | null | undefined,
  options?: CurrencyFormatOptions
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '$0';
  }

  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) {
    return '$0';
  }

  const {
    showCurrency = true,
    currencySymbol = '$',
    suffix = '',
    decimals = 0,
  } = options || {};

  // Formateo determinista garantizado con punto (.) para miles y coma (,) para decimales
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Separar miles con punto
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  let result = formattedInt;
  if (decimals > 0 && decPart) {
    result += `,${decPart}`;
  }

  if (num < 0) {
    result = `-${result}`;
  }

  const prefix = showCurrency ? currencySymbol : '';
  return `${prefix}${result}${suffix}`;
}

/**
 * Alias abreviado para plantillas y vistas rápidas (retorna ej: "105.000")
 */
export const fmt = (n: number | string | null | undefined): string =>
  formatPrice(n, { showCurrency: false });
