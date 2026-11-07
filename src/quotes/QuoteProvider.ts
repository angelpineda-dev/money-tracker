export interface LatestQuote {
    price: number;
    updatedAt: Date;
}

export interface DailyBar {
    date: Date;
    close: number;
}

/** A provider search hit. `currency` is whatever the provider reports (any ISO code). */
export interface SymbolMatch {
    symbol: string;
    name: string;
    currency: string;
    exchange: string;
    type: string;
}

export interface QuoteProvider {
    /** `maxRetries` caps attempts (default 3 with backoff); interactive callers pass 1. */
    getLatest(symbol: string, opts?: { maxRetries?: number }): Promise<LatestQuote>;
    getDailyHistory(symbol: string, from: Date, to: Date): Promise<DailyBar[]>;
    search(query: string): Promise<SymbolMatch[]>;
}
