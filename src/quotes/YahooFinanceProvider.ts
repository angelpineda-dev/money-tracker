import YahooFinance from 'yahoo-finance2';
import type { DailyBar, LatestQuote, QuoteProvider, SymbolMatch } from './QuoteProvider.ts';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// Unvalidated daily bar: Yahoo sends `close: null` for days without trading data.
type RawDailyRow = { date: Date; close: number | null | undefined };

const hasClose = (r: RawDailyRow): r is RawDailyRow & { close: number } => r.close !== null && r.close !== undefined;

// Unvalidated search hit and quote row (validateResult: false returns `any`).
type RawSearchHit = {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    exchange?: string;
    quoteType?: string;
    isYahooFinance?: boolean;
};
type RawQuote = { symbol?: string; currency?: string };

// Instruments a portfolio can hold as an asset; options, futures, indices, FX and crypto are skipped.
const SEARCHABLE_TYPES = new Set(['EQUITY', 'ETF', 'MUTUALFUND']);
const SEARCH_RESULTS = 10;

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const waitMs = 1000 * 2 ** (attempt - 1);
                console.error(`[quotes] intento ${attempt} fallido, reintentando en ${waitMs}ms`, err);
                await new Promise((r) => setTimeout(r, waitMs));
            }
        }
    }
    throw lastError;
}

export const yahooFinanceProvider: QuoteProvider = {
    async getLatest(symbol, opts): Promise<LatestQuote> {
        return withRetry(async () => {
            const result = await yf.quote(symbol, {}, { validateResult: false });
            const price = result.regularMarketPrice;
            if (price === undefined || price === null) {
                throw new Error(`Sin precio para ${symbol}`);
            }
            return { price, updatedAt: new Date() };
        }, opts?.maxRetries);
    },

    async getDailyHistory(symbol, from, to): Promise<DailyBar[]> {
        return withRetry(async () => {
            // validateResult: false makes the library return `any`; type the raw rows ourselves.
            const rows: RawDailyRow[] = await yf.historical(
                symbol,
                { period1: from, period2: to, interval: '1d' },
                { validateResult: false },
            );
            return rows.filter(hasClose).map((r) => ({ date: r.date, close: r.close }));
        });
    },

    // Interactive lookup: a single attempt, no retry backoff.
    async search(query): Promise<SymbolMatch[]> {
        // validateResult: false types the search result as `unknown`; it has the shape below.
        const result = (await yf.search(
            query,
            { quotesCount: SEARCH_RESULTS, newsCount: 0 },
            { validateResult: false },
        )) as { quotes?: RawSearchHit[] };
        const hits = (result.quotes ?? []).filter(
            (h): h is RawSearchHit & { symbol: string; quoteType: string } =>
                h.isYahooFinance === true &&
                typeof h.symbol === 'string' &&
                typeof h.quoteType === 'string' &&
                SEARCHABLE_TYPES.has(h.quoteType),
        );
        if (hits.length === 0) return [];

        // Search hits carry no currency; one batched quote call fills it in.
        const quotes: RawQuote[] = await yf.quote(
            hits.map((h) => h.symbol),
            { fields: ['symbol', 'currency'] },
            { validateResult: false },
        );
        const currencyBySymbol = new Map(quotes.map((q) => [q.symbol, q.currency?.toUpperCase()]));

        return hits.flatMap((h) => {
            const currency = currencyBySymbol.get(h.symbol);
            if (!currency) return [];
            return [
                {
                    symbol: h.symbol,
                    name: h.longname ?? h.shortname ?? h.symbol,
                    currency,
                    exchange: h.exchDisp ?? h.exchange ?? '',
                    type: h.quoteType,
                },
            ];
        });
    },
};
