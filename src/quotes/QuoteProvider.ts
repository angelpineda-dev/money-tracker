export interface LatestQuote {
    price: number;
    updatedAt: Date;
}

export interface DailyBar {
    date: Date;
    close: number;
}

export interface QuoteProvider {
    getLatest(symbol: string): Promise<LatestQuote>;
    getDailyHistory(symbol: string, from: Date, to: Date): Promise<DailyBar[]>;
}
