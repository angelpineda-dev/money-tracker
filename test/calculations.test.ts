import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    calcAverageCost,
    calcInvested,
    calcPerformanceInRange,
    calcPosition,
    isRecentPurchase,
    type PricePoint,
    type TxInput,
    validateSell,
} from '#services/calculations.ts';

const d = (s: string) => new Date(s);

describe('calcPosition', () => {
    it('suma compras', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 10, fees: 0 },
        ];
        assert.equal(calcPosition(txs), 100);
    });

    it('resta ventas', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 10, fees: 0 },
            { type: 'VENTA', operatedAt: d('2025-02-01'), quantity: 40, pricePerShare: 12, fees: 0 },
        ];
        assert.equal(calcPosition(txs), 60);
    });

    it('compras fraccionadas', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 10.5, pricePerShare: 50, fees: 0 },
            { type: 'COMPRA', operatedAt: d('2025-02-01'), quantity: 5.25, pricePerShare: 48, fees: 0 },
        ];
        assert.ok(Math.abs(calcPosition(txs) - 15.75) < 0.0001);
    });
});

describe('calcAverageCost', () => {
    it('costo promedio ponderado con comisiones', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 30, fees: 50 },
            { type: 'COMPRA', operatedAt: d('2025-02-01'), quantity: 200, pricePerShare: 35, fees: 60 },
        ];
        // (100*30+50 + 200*35+60) / 300 = (3050 + 7060) / 300 = 10110/300 = 33.7
        const expected = (100 * 30 + 50 + 200 * 35 + 60) / 300;
        assert.ok(Math.abs(calcAverageCost(txs) - expected) < 0.0001);
    });

    it('ventas no cambian costo promedio', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 30, fees: 0 },
            { type: 'VENTA', operatedAt: d('2025-02-01'), quantity: 50, pricePerShare: 40, fees: 0 },
        ];
        assert.equal(calcAverageCost(txs), 30);
    });
});

describe('calcInvested', () => {
    it('compras menos ventas netas', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 30, fees: 50 },
            { type: 'VENTA', operatedAt: d('2025-06-01'), quantity: 50, pricePerShare: 35, fees: 20 },
        ];
        // compra: 100*30+50=3050 / venta recibido: 50*35-20=1730
        // invertido = 3050 - 1730 = 1320
        assert.equal(calcInvested(txs), 1320);
    });
});

describe('validateSell', () => {
    it('rechaza venta mayor a posición', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 50, pricePerShare: 10, fees: 0 },
        ];
        assert.throws(() => validateSell(txs, 60));
    });

    it('permite venta igual a posición', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 50, pricePerShare: 10, fees: 0 },
        ];
        assert.doesNotThrow(() => validateSell(txs, 50));
    });
});

describe('isRecentPurchase', () => {
    it('true si última compra hace menos de 7 días', () => {
        const today = d('2025-11-01');
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-10-27'), quantity: 10, pricePerShare: 10, fees: 0 },
        ];
        assert.equal(isRecentPurchase(txs, today), true);
    });

    it('false si última compra hace 7 días exactos', () => {
        const today = d('2025-11-01');
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-10-25'), quantity: 10, pricePerShare: 10, fees: 0 },
        ];
        assert.equal(isRecentPurchase(txs, today), false);
    });

    it('false sin compras', () => {
        assert.equal(isRecentPurchase([], d('2025-11-01')), false);
    });
});

describe('calcPerformanceInRange', () => {
    const history: PricePoint[] = [
        { priceDate: d('2025-01-01'), closePrice: 30 },
        { priceDate: d('2025-06-01'), closePrice: 35 },
        { priceDate: d('2025-12-01'), closePrice: 40 },
    ];

    it('rango desde primera operación → valor inicial = 0', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 30, fees: 0 },
        ];
        const from = d('2025-01-01');
        const to = d('2025-12-01');
        const r = calcPerformanceInRange(txs, history, from, to);
        // gain = 100*40 + 0 - 0 - (100*30+0) = 4000 - 3000 = 1000
        assert.ok(Math.abs(r.gain - 1000) < 0.001);
    });

    it('rango posterior a primera operación usa precio de inicio', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 30, fees: 0 },
        ];
        const from = d('2025-06-01');
        const to = d('2025-12-01');
        const r = calcPerformanceInRange(txs, history, from, to);
        // valorInicio = 100*35=3500, valorFinal = 100*40=4000
        // gain = 4000 + 0 - 3500 - 0 = 500
        assert.ok(Math.abs(r.gain - 500) < 0.001);
        assert.ok(r.pct !== null && Math.abs(r.pct - 500 / 3500) < 0.0001);
    });

    it('usa último precio anterior si no hay exacto', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 10, pricePerShare: 30, fees: 0 },
        ];
        const from = d('2025-01-01');
        // fecha sin precio exacto → usa el de 2025-06-01 = 35
        const to = d('2025-08-01');
        const r = calcPerformanceInRange(txs, history, from, to);
        // gain = 10*35 - 10*30 = 350-300 = 50
        assert.ok(Math.abs(r.gain - 50) < 0.001);
    });

    it('venta parcial en el rango suma a ganancia', () => {
        const txs: TxInput[] = [
            { type: 'COMPRA', operatedAt: d('2025-01-01'), quantity: 100, pricePerShare: 30, fees: 0 },
            { type: 'VENTA', operatedAt: d('2025-06-01'), quantity: 50, pricePerShare: 35, fees: 0 },
        ];
        const from = d('2025-01-01');
        const to = d('2025-12-01');
        const r = calcPerformanceInRange(txs, history, from, to);
        // valorFinal: 50 títulos × 40 = 2000
        // ventasRango: 50×35 = 1750
        // comprasRango: 100×30 = 3000
        // gain = 2000 + 1750 - 0 - 3000 = 750
        assert.ok(Math.abs(r.gain - 750) < 0.001);
    });
});
