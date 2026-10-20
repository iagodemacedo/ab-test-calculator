import type { Fmt } from '../i18n/content/types';
import type { Currency, Locale } from '../stats/types';

const locales = { pt: 'pt-BR', en: 'en-US' };
export interface Formatter extends Fmt {
  pp: (fraction: number) => string;
  currency: (n: number, currency: Currency) => string;
  pvalue: (n: number) => string;
  date: (iso: string) => string;
}
function createFormatter(locale: Locale): Formatter {
  const cache = new Map<string, Intl.NumberFormat>();
  const format = (n: number, options: Intl.NumberFormatOptions) => {
    if (!Number.isFinite(n)) return '—';
    const key = JSON.stringify(options);
    let formatter = cache.get(key);
    if (!formatter) { formatter = new Intl.NumberFormat(locales[locale], options); cache.set(key, formatter); }
    return formatter.format(n);
  };
  return {
    pct: (n, digits = 2) => format(n, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }),
    num: (n, digits = 2) => format(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    int: n => format(n, { maximumFractionDigits: 0 }),
    pp: n => `${format(n * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`,
    currency: (n, currency) => format(n, { style: 'currency', currency }),
    pvalue: n => n < 0.0001 ? `< ${format(0.0001, { minimumFractionDigits: 4 })}` : format(n, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
    date: iso => new Intl.DateTimeFormat(locales[locale], { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)),
  };
}
export const formatters: Record<Locale, Formatter> = { pt: createFormatter('pt'), en: createFormatter('en') };
