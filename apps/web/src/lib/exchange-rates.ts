/**
 * Exchange rate utilities for currency conversion.
 * Uses Frankfurter as primary API with Fawaz Ahmed's Exchange API as fallback.
 * Caches rates in KV storage if available.
 */

export interface ExchangeRateResult {
  rate: number;
  source: 'frankfurter' | 'fawaz' | 'cache';
  date: string;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * Fetch exchange rate from primary API (Frankfurter) with fallback.
 */
export async function getExchangeRate(
  from: string,
  to: string,
  env?: { EXCHANGE_RATE_CACHE?: KVNamespace }
): Promise<ExchangeRateResult | null> {
  const normalizedFrom = from.toUpperCase();
  const normalizedTo = to.toUpperCase();

  // Same currency, no conversion needed
  if (normalizedFrom === normalizedTo) {
    return { rate: 1, source: 'cache', date: new Date().toISOString().split('T')[0] };
  }

  const cacheKey = `rate:${normalizedFrom}:${normalizedTo}`;

  // Check cache first
  if (env?.EXCHANGE_RATE_CACHE) {
    try {
      const cached = await env.EXCHANGE_RATE_CACHE.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as ExchangeRateResult;
        return { ...data, source: 'cache' };
      }
    } catch {
      // Cache miss or error, continue to fetch
    }
  }

  // Try primary API (Frankfurter)
  try {
    const result = await fetchFrankfurterRate(normalizedFrom, normalizedTo);
    if (result) {
      await cacheRate(env?.EXCHANGE_RATE_CACHE, cacheKey, result);
      return result;
    }
  } catch (e) {
    // Fall through to fallback
  }

  // Fallback API (Fawaz Ahmed)
  try {
    const result = await fetchFawazRate(normalizedFrom, normalizedTo);
    if (result) {
      await cacheRate(env?.EXCHANGE_RATE_CACHE, cacheKey, result);
      return result;
    }
  } catch (e) {
    // Both APIs failed
  }

  return null;
}

async function fetchFrankfurterRate(from: string, to: string): Promise<ExchangeRateResult | null> {
  const response = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
    { cf: { cacheTtl: 300 } } // Cloudflare cache 5 minutes
  );

  if (!response.ok) return null;

  const data = await response.json() as { rates: Record<string, number>; date: string };
  const rate = data.rates[to];

  if (!rate) return null;

  return {
    rate,
    source: 'frankfurter',
    date: data.date,
  };
}

async function fetchFawazRate(from: string, to: string): Promise<ExchangeRateResult | null> {
  // Try primary CDN first
  let response = await fetch(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/exchange-api@latest/v1/currencies/${from.toLowerCase()}.json`,
    { cf: { cacheTtl: 300 } }
  );

  // Fallback to Cloudflare Pages if jsdelivr fails
  if (!response.ok) {
    response = await fetch(
      `https://latest.currency-api.pages.dev/v1/currencies/${from.toLowerCase()}.json`,
      { cf: { cacheTtl: 300 } }
    );
  }

  if (!response.ok) return null;

  const data = await response.json() as Record<string, Record<string, number>>;
  const rate = data[from.toLowerCase()]?.[to.toLowerCase()];

  if (!rate) return null;

  return {
    rate,
    source: 'fawaz',
    date: new Date().toISOString().split('T')[0],
  };
}

async function cacheRate(
  cache: KVNamespace | undefined,
  key: string,
  result: ExchangeRateResult
): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(key, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Convert amount using exchange rate.
 */
export function convertCurrency(amount: number, rate: number): number {
  return amount * rate;
}

/**
 * Format currency amount with symbol.
 * Uses Intl.NumberFormat for proper localization.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for invalid currency codes
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/**
 * Format currency amount without cents if whole number.
 */
export function formatCurrencySmart(amount: number, currency: string): string {
  const hasCents = amount % 1 !== 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: hasCents ? 2 : 0 })}`;
  }
}

/**
 * Get currency symbol only.
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'Fr',
    SEK: 'kr',
    NZD: 'NZ$',
    SGD: 'S$',
    HKD: 'HK$',
    NOK: 'kr',
    KRW: '₩',
    TRY: '₺',
    RUB: '₽',
    INR: '₹',
    BRL: 'R$',
    ZAR: 'R',
    MXN: '$',
    PHP: '₱',
    THB: '฿',
    IDR: 'Rp',
    MYR: 'RM',
    VND: '₫',
    PLN: 'zł',
    DKK: 'kr',
  };
  return symbols[currency.toUpperCase()] || currency;
}
