import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../prisma/.env") });
config({ path: resolve(__dirname, "../../.env") });
import { PrismaClient } from "../../generated/prisma/client.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("Limpiando datos previos...");
  await prisma.reminderLog.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.priceCache.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.asset.deleteMany();

  console.log("Creando activos...");
  const cuervo = await prisma.asset.create({
    data: { symbol: "CUERVO.MX", name: "José Cuervo", currency: "MXN" },
  });
  const eww = await prisma.asset.create({
    data: { symbol: "EWW", name: "iShares MSCI Mexico ETF", currency: "USD" },
  });

  console.log("Creando transacciones...");
  // CUERVO.MX — 3 compras, 1 venta parcial
  await prisma.transaction.createMany({
    data: [
      {
        assetId: cuervo.id,
        type: "COMPRA",
        operatedAt: new Date("2025-01-10"),
        quantity: 100,
        pricePerShare: 32.5,
        fees: 45.0,
        notes: "Primera compra",
      },
      {
        assetId: cuervo.id,
        type: "COMPRA",
        operatedAt: new Date("2025-03-15"),
        quantity: 200,
        pricePerShare: 30.0,
        fees: 60.0,
      },
      {
        assetId: cuervo.id,
        type: "COMPRA",
        operatedAt: new Date("2025-06-01"),
        quantity: 50,
        pricePerShare: 33.0,
        fees: 30.0,
      },
      {
        assetId: cuervo.id,
        type: "VENTA",
        operatedAt: new Date("2025-09-20"),
        quantity: 100,
        pricePerShare: 35.0,
        fees: 50.0,
      },
    ],
  });

  // EWW — 2 compras con fracciones
  await prisma.transaction.createMany({
    data: [
      {
        assetId: eww.id,
        type: "COMPRA",
        operatedAt: new Date("2025-02-01"),
        quantity: 10.5,
        pricePerShare: 58.25,
        fees: 2.5,
      },
      {
        assetId: eww.id,
        type: "COMPRA",
        operatedAt: new Date("2025-07-10"),
        quantity: 5.25,
        pricePerShare: 55.0,
        fees: 1.75,
      },
    ],
  });

  // Precios históricos de ejemplo
  const cuervoHistory = [
    { date: "2025-01-10", price: 32.5 },
    { date: "2025-03-15", price: 30.0 },
    { date: "2025-06-01", price: 33.0 },
    { date: "2025-09-20", price: 35.0 },
    { date: "2025-10-01", price: 34.5 },
  ];

  for (const h of cuervoHistory) {
    await prisma.priceHistory.upsert({
      where: { assetId_priceDate: { assetId: cuervo.id, priceDate: new Date(h.date) } },
      update: { closePrice: h.price },
      create: { assetId: cuervo.id, priceDate: new Date(h.date), closePrice: h.price },
    });
  }

  const ewwHistory = [
    { date: "2025-02-01", price: 58.25 },
    { date: "2025-07-10", price: 55.0 },
    { date: "2025-10-01", price: 57.5 },
  ];

  for (const h of ewwHistory) {
    await prisma.priceHistory.upsert({
      where: { assetId_priceDate: { assetId: eww.id, priceDate: new Date(h.date) } },
      update: { closePrice: h.price },
      create: { assetId: eww.id, priceDate: new Date(h.date), closePrice: h.price },
    });
  }

  // Price cache con último precio conocido
  await prisma.priceCache.createMany({
    data: [
      { assetId: cuervo.id, price: 34.5 },
      { assetId: eww.id, price: 57.5 },
    ],
  });

  console.log("Seed completo.");
  console.log(`  CUERVO.MX id=${cuervo.id}`);
  console.log(`  EWW id=${eww.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
