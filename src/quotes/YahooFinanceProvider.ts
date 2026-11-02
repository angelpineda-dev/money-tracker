import YahooFinance from "yahoo-finance2";
import type { QuoteProvider, LatestQuote, DailyBar } from "./QuoteProvider.ts";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

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
  async getLatest(symbol): Promise<LatestQuote> {
    return withRetry(async () => {
      const result = await yf.quote(symbol, {}, { validateResult: false });
      const price = result.regularMarketPrice;
      if (price === undefined || price === null) {
        throw new Error(`Sin precio para ${symbol}`);
      }
      return { price, updatedAt: new Date() };
    });
  },

  async getDailyHistory(symbol, from, to): Promise<DailyBar[]> {
    return withRetry(async () => {
      const rows = await yf.historical(
        symbol,
        { period1: from, period2: to, interval: "1d" },
        { validateResult: false }
      );
      return rows
        .filter((r) => r.close !== null && r.close !== undefined)
        .map((r) => ({ date: r.date, close: r.close as number }));
    });
  },
};
