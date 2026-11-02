export type TxType = "COMPRA" | "VENTA";

export interface TxInput {
  type: TxType;
  operatedAt: Date;
  quantity: number;
  pricePerShare: number;
  fees: number;
}

export interface PricePoint {
  priceDate: Date;
  closePrice: number;
}

export interface PerformanceResult {
  gain: number;
  pct: number | null;
}

export function calcPosition(txs: TxInput[]): number {
  return txs.reduce((acc, tx) => {
    return tx.type === "COMPRA" ? acc + tx.quantity : acc - tx.quantity;
  }, 0);
}

export function calcAverageCost(txs: TxInput[]): number {
  const buys = txs.filter((t) => t.type === "COMPRA");
  const totalQty = buys.reduce((s, t) => s + t.quantity, 0);
  if (totalQty === 0) return 0;
  const totalCost = buys.reduce((s, t) => s + t.quantity * t.pricePerShare + t.fees, 0);
  return totalCost / totalQty;
}

export function calcInvested(txs: TxInput[]): number {
  return txs.reduce((acc, tx) => {
    if (tx.type === "COMPRA") return acc + tx.quantity * tx.pricePerShare + tx.fees;
    return acc - (tx.quantity * tx.pricePerShare - tx.fees);
  }, 0);
}

export function isRecentPurchase(txs: TxInput[], today: Date): boolean {
  const buys = txs.filter((t) => t.type === "COMPRA");
  if (buys.length === 0) return false;
  const lastBuy = buys.reduce((latest, t) =>
    t.operatedAt > latest.operatedAt ? t : latest
  );
  const diffMs = today.getTime() - lastBuy.operatedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < 7;
}

export function validateSell(txs: TxInput[], sellQty: number): void {
  const current = calcPosition(txs);
  if (current - sellQty < 0) {
    throw new Error(
      `Venta inválida: posición actual ${current}, intento vender ${sellQty}`
    );
  }
}

function getPriceAt(history: PricePoint[], date: Date): number | null {
  const dateMs = date.getTime();
  const candidates = history
    .filter((h) => h.priceDate.getTime() <= dateMs)
    .sort((a, b) => b.priceDate.getTime() - a.priceDate.getTime());
  return candidates.length > 0 ? candidates[0].closePrice : null;
}

function positionAt(txs: TxInput[], date: Date): number {
  const before = txs.filter((t) => t.operatedAt.getTime() <= date.getTime());
  return calcPosition(before);
}

export function calcPerformanceInRange(
  txs: TxInput[],
  history: PricePoint[],
  from: Date,
  to: Date
): PerformanceResult {
  const firstOpDate =
    txs.length > 0
      ? txs.reduce((min, t) => (t.operatedAt < min ? t.operatedAt : min), txs[0].operatedAt)
      : null;

  const isDefaultFrom = firstOpDate !== null && from.getTime() === firstOpDate.getTime();

  const priceAtTo = getPriceAt(history, to) ?? 0;
  const priceAtFrom = getPriceAt(history, from) ?? 0;

  const qtyAtTo = positionAt(txs, to);
  const qtyAtFrom = positionAt(txs, from);

  const valorFinal = qtyAtTo * priceAtTo;
  const valorInicio = isDefaultFrom ? 0 : qtyAtFrom * priceAtFrom;

  const rangoTxs = txs.filter(
    (t) => t.operatedAt >= from && t.operatedAt <= to
  );

  const comprasRango = rangoTxs
    .filter((t) => t.type === "COMPRA")
    .reduce((s, t) => s + t.quantity * t.pricePerShare + t.fees, 0);

  const ventasRango = rangoTxs
    .filter((t) => t.type === "VENTA")
    .reduce((s, t) => s + t.quantity * t.pricePerShare - t.fees, 0);

  const gain = valorFinal + ventasRango - valorInicio - comprasRango;
  const base = valorInicio + comprasRango;
  const pct = base !== 0 ? gain / base : null;

  return { gain, pct };
}
