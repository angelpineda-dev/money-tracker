import { randomInt } from 'node:crypto';
import { LINK_CODE_ALPHABET, LINK_CODE_LENGTH, LINK_CODE_TTL_MS } from '#core/constants/telegram.ts';
import { prisma } from '#lib/prisma.ts';

const generateCode = () =>
    Array.from({ length: LINK_CODE_LENGTH }, () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]).join('');

// Issues a fresh one-time code; any previous code of the user stops working.
export async function createLinkCode(userId: string) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    await prisma.$transaction([
        prisma.telegramLinkCode.deleteMany({ where: { userId } }),
        prisma.telegramLinkCode.create({ data: { code, userId, expiresAt } }),
    ]);
    return { code, expiresAt };
}

// Consumes the code and binds the chat to its user. Returns false for unknown,
// used or expired codes. A chat belongs to one user: linking moves it.
export async function linkChat(code: string, chatId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
        const stored = await tx.telegramLinkCode.findUnique({ where: { code: code.toUpperCase() } });
        if (!stored) return false;
        await tx.telegramLinkCode.delete({ where: { code: stored.code } });
        if (stored.expiresAt <= new Date()) return false;

        await tx.users.updateMany({
            where: { telegramChatId: chatId, id: { not: stored.userId } },
            data: { telegramChatId: null },
        });
        const { count } = await tx.users.updateMany({
            where: { id: stored.userId, active: true },
            data: { telegramChatId: chatId },
        });
        return count > 0;
    });
}

export async function unlinkChat(userId: string) {
    await prisma.users.update({ where: { id: userId }, data: { telegramChatId: null } });
}

export async function findUserIdByChatId(chatId: string): Promise<string | null> {
    const user = await prisma.users.findFirst({
        where: { telegramChatId: chatId, active: true },
        select: { id: true },
    });
    return user?.id ?? null;
}
