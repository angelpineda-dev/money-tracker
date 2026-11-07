import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toAssetListItem } from '#services/assetService.ts';

const base = { id: 1, symbol: 'CUERVO.MX', name: 'Becle', currency: 'MXN' };

describe('toAssetListItem', () => {
    it('devuelve currentPrice null cuando no hay precio en caché', () => {
        assert.deepEqual(toAssetListItem({ ...base, priceCache: null }), { ...base, currentPrice: null });
    });

    it('convierte el Decimal de Prisma a número y quita priceCache', () => {
        const item = toAssetListItem({ ...base, priceCache: { price: { toString: () => '32.5000' } } });
        assert.equal(item.currentPrice, 32.5);
        assert.equal('priceCache' in item, false);
    });
});
