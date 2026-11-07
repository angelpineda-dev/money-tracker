import { CURRENCIES } from '#core/constants/currencies.ts';
import { portfolioMessages } from '#core/userMessages/portfolio.ts';
import AppError from '#errors/AppError.ts';
import type { QuoteProvider, SymbolMatch } from '#quotes/QuoteProvider.ts';
import { yahooFinanceProvider } from '#quotes/YahooFinanceProvider.ts';
import type { Currency } from '#types/currency.ts';

export type SupportedSymbolMatch = SymbolMatch & { currency: Currency };

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

const isSupported = (m: SymbolMatch): m is SupportedSymbolMatch =>
    (CURRENCIES as readonly string[]).includes(m.currency);

/**
 * Builds a symbol search over `provider` that keeps only currencies the app supports and
 * caches results per normalized query, so typing in the UI doesn't hammer the provider.
 */
export function createSymbolSearch(provider: Pick<QuoteProvider, 'search'>, now: () => number = Date.now) {
    const cache = new Map<string, { at: number; results: SupportedSymbolMatch[] }>();

    return async function searchSymbols(query: string): Promise<SupportedSymbolMatch[]> {
        const key = query.trim().toUpperCase();
        const hit = cache.get(key);
        if (hit && now() - hit.at < CACHE_TTL_MS) return hit.results;

        let matches: SymbolMatch[];
        try {
            matches = await provider.search(key);
        } catch (err) {
            console.error(`[symbols] error buscando "${key}":`, err);
            throw new AppError(portfolioMessages.SYMBOL_SEARCH_UNAVAILABLE, 503);
        }

        const results = matches.filter(isSupported);
        cache.delete(key);
        cache.set(key, { at: now(), results });
        // Map keeps insertion order: the first key is the oldest entry.
        if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
        return results;
    };
}

export const searchSymbols = createSymbolSearch(yahooFinanceProvider);
