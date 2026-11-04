-- Portfolio data predates users and has no owner: wipe it before adding the
-- NOT NULL owner column. Reseed with `npm run seed`.
DELETE FROM "reminders_log";
DELETE FROM "price_history";
DELETE FROM "price_cache";
DELETE FROM "transactions";
DELETE FROM "assets";

-- DropIndex
DROP INDEX "assets_symbol_key";

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "userId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "telegram_link_codes" (
    "code" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_userId_symbol_key" ON "assets"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");

-- AddForeignKey
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

