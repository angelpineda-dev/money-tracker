import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CURRENCY } from '#core/constants/currencies.ts';
import AppError from '#errors/AppError.ts';
import type { SymbolMatch } from '#quotes/QuoteProvider.ts';
import { createSymbolSearch } from '#services/symbolSearchService.ts';

const match = (symbol: string, currency: string): SymbolMatch => ({
    symbol,
    name: `${symbol} Inc.`,
    currency,
    exchange: 'TEST',
    type: 'EQUITY',
});

function fakeProvider(results: SymbolMatch[]) {
    const calls: string[] = [];
    return {
        calls,
        search: async (q: string) => {
            calls.push(q);
            return results;
        },
    };
}

describe('createSymbolSearch', () => {
    it('oculta monedas no soportadas', async () => {
        const provider = fakeProvider([
            match('AAPL', CURRENCY.USD),
            match('SAN.MC', 'EUR'),
            match('CUERVO.MX', CURRENCY.MXN),
        ]);
        const search = createSymbolSearch(provider);
        const results = await search('a');
        assert.deepEqual(
            results.map((r) => r.symbol),
            ['AAPL', 'CUERVO.MX'],
        );
    });

    it('cachea por consulta normalizada', async () => {
        const provider = fakeProvider([match('AAPL', CURRENCY.USD)]);
        const search = createSymbolSearch(provider);
        await search('apple');
        await search('  APPLE ');
        assert.deepEqual(provider.calls, ['APPLE']);
    });

    it('vuelve a consultar cuando expira la caché', async () => {
        const provider = fakeProvider([match('AAPL', CURRENCY.USD)]);
        let clock = 0;
        const search = createSymbolSearch(provider, () => clock);
        await search('apple');
        clock += 11 * 60 * 1000;
        await search('apple');
        assert.equal(provider.calls.length, 2);
    });

    it('convierte errores del proveedor en 503', async () => {
        const search = createSymbolSearch({
            search: async () => {
                throw new Error('yahoo caído');
            },
        });
        await assert.rejects(search('apple'), (err: unknown) => err instanceof AppError && err.statusCode === 503);
    });
});
